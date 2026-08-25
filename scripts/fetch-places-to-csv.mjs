#!/usr/bin/env node
// scripts/fetch-places-to-csv.mjs
//
// ============================================================
// 로컬 전용 오프라인 도구 (배포되는 웹앱과 완전히 분리됨)
// ============================================================
// 이 스크립트는 GitHub Pages에 올라가는 웹앱의 일부가 아니다.
// 원래 설계 원칙("웹앱에서는 Google/Naver Places API를 호출하지 않는다")을
// 지키기 위해, "본인 컴퓨터에서 본인 API 키로 한 번 돌려서 CSV를 만드는" 용도로만
// 존재한다. 결과 CSV는 앱의 "📄 CSV 등록" 기능으로 Firestore에 올리면 된다.
//
// 사용법:
//   node scripts/fetch-places-to-csv.mjs --provider=google --in=queries.txt --out=google.csv
//   node scripts/fetch-places-to-csv.mjs --provider=naver  --in=queries.txt --out=naver.csv
//
// queries.txt: 검색어를 한 줄에 하나씩 (예: "스시 사카바 사시스 오사카 우메다")
//
// 필요 환경변수:
//   GOOGLE_PLACES_API_KEY   (Google Cloud Console에서 Places API (New) 활성화 후 발급)
//   NAVER_CLIENT_ID / NAVER_CLIENT_SECRET  (네이버 개발자센터 → 검색 API 애플리케이션 등록)
//
// Node 18 이상 필요 (내장 fetch 사용). 실행 전 `node -v`로 확인하세요.
//
// ⚠️ 반드시 확인할 것:
// - Google/Naver 모두 API 이용약관(ToS)이 있고, 응답 데이터의 캐싱/재게시 방식에
//   제한이 있을 수 있다. 상업적 재배포가 아닌 "개인 맛집 지도 사전 준비" 용도인지
//   본인 프로젝트 성격에 맞게 다시 한 번 확인할 것.
// - 이 스크립트는 이 문서 작성 시점 기준 공식 문서를 참고해 작성했다.
//   요금/요청 형식은 바뀔 수 있으니 실행 전 최신 문서를 다시 확인하는 걸 권장한다.
//   Google: https://developers.google.com/maps/documentation/places/web-service/text-search
//   Naver:  https://developers.naver.com/docs/serviceapi/search/local/local.md
// - 네이버 지역 검색 API의 mapx/mapy 좌표계는 시점에 따라 KATECH/WGS84 등으로
//   바뀐 이력이 있어(공식 공지 확인 필요), 이 스크립트는 좌표 변환을 임의로
//   하지 않고 원본 mapx/mapy를 raw 컬럼으로만 남긴다. 위도/경도(latitude/longitude)는
//   비워두니, 앱의 "주소로 좌표 찾기" 버튼이나 별도 지오코더로 채워 넣을 것.

import { readFile, writeFile } from "node:fs/promises";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=");
    return [key, value ?? true];
  })
);

const PROVIDER = args.provider; // "google" | "naver"
const IN_FILE = args.in;
const OUT_FILE = args.out || `${PROVIDER}-output.csv`;
const DEFAULT_COUNTRY = args.country || (PROVIDER === "naver" ? "KR" : "JP");

if (!PROVIDER || !IN_FILE) {
  console.error(
    "사용법: node fetch-places-to-csv.mjs --provider=google|naver --in=queries.txt [--out=result.csv] [--country=KR|JP]"
  );
  process.exit(1);
}

const CSV_HEADERS = [
  "name",
  "country",
  "region",
  "district",
  "address",
  "latitude",
  "longitude",
  "categories",
  "status",
  "provider",
  "externalRating",
  "externalRatingCount",
  "externalUrl",
  "openingHours",
  "memo",
  "raw_mapx", // 네이버 전용 참고용 원본 값 (좌표계 미확정 상태로 그대로 보존)
  "raw_mapy",
];

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toRow(obj) {
  return CSV_HEADERS.map((h) => csvEscape(obj[h] ?? "")).join(",");
}

async function fetchGoogle(query) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY 환경변수가 없습니다.");

  // Text Search (New): https://developers.google.com/maps/documentation/places/web-service/text-search
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri",
    },
    body: JSON.stringify({ textQuery: query, languageCode: "ja" }),
  });

  if (!res.ok) throw new Error(`Google API 오류 ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const place = data.places?.[0];
  if (!place) return null;

  return {
    name: place.displayName?.text || query,
    country: DEFAULT_COUNTRY,
    region: "",
    district: "",
    address: place.formattedAddress || "",
    latitude: place.location?.latitude ?? "",
    longitude: place.location?.longitude ?? "",
    categories: "",
    status: "want",
    provider: "google",
    externalRating: place.rating ?? "",
    externalRatingCount: place.userRatingCount ?? "",
    externalUrl: place.googleMapsUri || "",
    openingHours: "",
    memo: "",
  };
}

async function fetchNaver(query) {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 없습니다.");
  }

  // 지역 검색 API: https://developers.naver.com/docs/serviceapi/search/local/local.md
  const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(
    query
  )}&display=1`;

  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
  });

  if (!res.ok) throw new Error(`Naver API 오류 ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return null;

  const stripTags = (s) => (s || "").replace(/<[^>]*>/g, "");

  return {
    name: stripTags(item.title),
    country: DEFAULT_COUNTRY,
    region: "",
    district: "",
    address: item.roadAddress || item.address || "",
    latitude: "", // 좌표계 미확정 — 위 주석 참고, 직접 확인 후 채울 것
    longitude: "",
    categories: "",
    status: "want",
    provider: "naver",
    externalRating: "",
    externalRatingCount: "",
    externalUrl: item.link || "",
    openingHours: "",
    memo: "",
    raw_mapx: item.mapx || "",
    raw_mapy: item.mapy || "",
  };
}

async function main() {
  const queries = (await readFile(IN_FILE, "utf-8"))
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const fetchFn = PROVIDER === "google" ? fetchGoogle : PROVIDER === "naver" ? fetchNaver : null;
  if (!fetchFn) {
    console.error(`알 수 없는 provider: ${PROVIDER} (google 또는 naver만 지원)`);
    process.exit(1);
  }

  const rows = [];
  for (const [i, query] of queries.entries()) {
    process.stdout.write(`[${i + 1}/${queries.length}] ${query} ... `);
    try {
      const row = await fetchFn(query);
      if (row) {
        rows.push(row);
        console.log("OK");
      } else {
        console.log("검색 결과 없음");
      }
    } catch (err) {
      console.log(`실패: ${err.message}`);
    }
    // 두 서비스 모두 요청 빈도 제한이 있으므로 요청 사이에 짧게 대기한다.
    await new Promise((r) => setTimeout(r, 300));
  }

  const csv = [CSV_HEADERS.join(","), ...rows.map(toRow)].join("\n");
  await writeFile(OUT_FILE, csv, "utf-8");
  console.log(`\n완료: ${rows.length}건 → ${OUT_FILE}`);
  console.log(
    "저장된 CSV의 region/categories/status/openingHours는 비어있거나 기본값이니, 웹앱에 올리기 전에 스프레드시트에서 채워 넣어주세요."
  );
}

main();
