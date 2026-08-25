// js/csvImport.js
// 사용자가 미리 전처리한 CSV를 파싱해 restaurants 문서 형태로 변환한다.
// (쉼표/따옴표/줄바꿈이 섞인 필드도 처리하는 간단한 CSV 파서 — 외부 라이브러리 없음)

export const CSV_HEADERS = [
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
];

export function buildCsvTemplate() {
  const header = CSV_HEADERS.join(",");
  const example1 =
    '스시 사카바 사시스,JP,Osaka,Umeda,大阪府大阪市...,34.7024,135.4959,sushi|japanese,want,google,4.6,1284,https://maps.google.com/?q=...,11:30-22:00,웨이팅 있음';
  const example2 =
    '성수 곱창이야기,KR,Seoul,Seongsu,서울특별시 성동구...,37.5446,127.0559,korean|yakiniku,visited,naver,4.4,2033,https://map.naver.com/...,"월,화,수,목,금 16:00-24:00",곱창 두툼함';
  return [header, example1, example2].join("\n");
}

/** 아주 단순한 RFC4180풍 CSV 파서 (쌍따옴표 escape, 줄바꿈 포함 필드 지원) */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      pushField();
    } else if (c === "\n") {
      pushRow();
    } else if (c === "\r") {
      // skip, \n에서 처리
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) pushRow();

  const [headerRow, ...dataRows] = rows.filter((r) => r.length > 1 || r[0] !== "");
  if (!headerRow) return [];

  const headers = headerRow.map((h) => h.trim());
  return dataRows
    .filter((r) => r.some((cell) => cell.trim() !== ""))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
}

/**
 * CSV 한 행(raw object)을 restaurants 문서 스키마로 변환한다.
 * @returns {{data: object} | {error: string}}
 */
export function rowToRestaurant(raw, rowIndex) {
  const name = raw.name?.trim();
  const country = raw.country?.trim().toUpperCase();
  const latitude = parseFloat(raw.latitude);
  const longitude = parseFloat(raw.longitude);
  const status = raw.status?.trim() || "want";
  const categories = (raw.categories || "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!name) return { error: `${rowIndex}행: 이름(name)이 비어있음` };
  if (!["KR", "JP"].includes(country)) return { error: `${rowIndex}행: country는 KR 또는 JP만 가능` };
  if (Number.isNaN(latitude) || Number.isNaN(longitude))
    return { error: `${rowIndex}행: 위도/경도가 숫자가 아님` };
  if (categories.length === 0) return { error: `${rowIndex}행: categories가 비어있음` };
  if (!["want", "visited", "avoid"].includes(status))
    return { error: `${rowIndex}행: status는 want/visited/avoid만 가능` };

  const ratingRaw = raw.externalRating ? parseFloat(raw.externalRating) : null;
  const ratingCountRaw = raw.externalRatingCount ? parseInt(raw.externalRatingCount, 10) : null;

  return {
    data: {
      name,
      country,
      region: raw.region?.trim() || "etc",
      district: raw.district?.trim() || "",
      address: raw.address?.trim() || "",
      latitude,
      longitude,
      categories,
      status,
      external: {
        provider: raw.provider?.trim() || (country === "KR" ? "naver" : "google"),
        rating: Number.isNaN(ratingRaw) ? null : ratingRaw,
        ratingCount: Number.isNaN(ratingCountRaw) ? null : ratingCountRaw,
        url: raw.externalUrl?.trim() || "",
      },
      openingHours: (raw.openingHours || "")
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean),
      my: { memo: raw.memo?.trim() || "" },
    },
  };
}
