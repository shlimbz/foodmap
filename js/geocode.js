// js/geocode.js
//
// 주소 문자열 → 좌표(lat/lng) 변환. Google/Naver Places API가 아니라
// OpenStreetMap 커뮤니티가 운영하는 Nominatim(무료 지오코더)을 쓴다.
// 이미 지도 타일도 OSM 기반(OpenFreeMap)을 쓰고 있어서, "맛집 정보"를 가져오는 게
// 아니라 "주소 → 좌표"만 구하는 용도로는 원래 설계 원칙(웹앱에서 Google/Naver
// 맛집 API 호출 금지)과 충돌하지 않는다.
//
// ⚠️ Nominatim 사용 정책(https://operations.osmfoundation.org/policies/nominatim/)상
// 초당 1회 이하의 "가벼운" 사용만 허용된다. 대량 자동화(수백~수천 건 일괄 지오코딩)에는
// 쓰지 말 것 — 그런 경우 CSV 일괄 등록 시 위도/경도를 미리 채워서 가져오는 걸 권장한다.

let lastCallAt = 0;
const MIN_INTERVAL_MS = 1100; // Nominatim 정책: 초당 1회 이하

export async function geocodeAddress(query) {
  const trimmed = query?.trim();
  if (!trimmed) throw new Error("empty-query");

  const wait = Math.max(0, lastCallAt + MIN_INTERVAL_MS - Date.now());
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
    trimmed
  )}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`geocode-http-${res.status}`);

  const results = await res.json();
  if (!results?.length) throw new Error("no-results");

  return {
    lat: parseFloat(results[0].lat),
    lng: parseFloat(results[0].lon),
    displayName: results[0].display_name,
  };
}
