// js/directions.js
//
// 웹앱은 길찾기 알고리즘을 직접 구현하지 않는다 (요구사항 18).
// 대신 "출발지 + 목적지 좌표"로 Google Maps / Naver Map의
// 공식 길찾기 URL을 만들어서 새 탭으로 열어주는 역할만 한다.
//
// ⚠️ 확인 필요:
// Google/Naver의 URL 형식은 서비스 정책에 따라 바뀔 수 있습니다.
// 아래 구현은 이 문서를 작성한 시점 기준으로 확인된 공식 스펙을 따랐습니다.
//   - Google: https://developers.google.com/maps/documentation/urls/get-started
//   - Naver:  https://guide.ncloud-docs.com/docs/application-maps-url-scheme-vpc
// 실제 배포 전, 위 공식 문서에서 최신 스펙을 다시 한번 확인하세요.

/**
 * Google Maps 길찾기 URL (Google 공식 "Urls API", api=1 방식).
 * 앱이 설치되어 있으면 모바일에서 자동으로 앱으로 연결되고,
 * 없으면 브라우저에서 Google 지도가 열린다.
 */
export function buildGoogleDirectionsUrl({ originLat, originLng, destLat, destLng, travelMode = "transit" }) {
  const params = new URLSearchParams({
    api: "1",
    destination: `${destLat},${destLng}`,
    travelmode: travelMode, // driving | walking | bicycling | transit
  });
  if (originLat != null && originLng != null) {
    params.set("origin", `${originLat},${originLng}`);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Naver 지도 앱 길찾기 (nmap:// URL Scheme, 도보 기준).
 * 네이버 지도 앱이 설치되어 있는 기기에서만 동작한다.
 * appname에는 이 웹앱을 식별할 수 있는 문자열(배포 URL 등)을 넣어야 한다.
 */
export function buildNaverAppDirectionsUrl({
  originLat,
  originLng,
  destLat,
  destLng,
  destName,
  appName = window.location.hostname || "matjip-map",
}) {
  const params = new URLSearchParams({
    dlat: String(destLat),
    dlng: String(destLng),
    dname: destName || "목적지",
    appname: appName,
  });
  if (originLat != null && originLng != null) {
    params.set("slat", String(originLat));
    params.set("slng", String(originLng));
  }
  return `nmap://route/walk?${params.toString()}`;
}

/**
 * Naver 지도 웹(브라우저) fallback.
 * nmap:// 스킴은 네이버 지도 앱이 없으면 아무 반응이 없기 때문에,
 * 앱이 없는 PC/브라우저 환경을 위해 장소 검색 결과 페이지로 대체 연결한다.
 * (정밀한 웹 길찾기 URL은 네이버 정책상 자주 바뀌므로,
 *  가장 안정적인 "장소 검색" 페이지를 fallback으로 사용한다.)
 */
export function buildNaverWebSearchUrl({ destName, address }) {
  const query = encodeURIComponent(destName || address || "");
  return `https://map.naver.com/p/search/${query}`;
}

/**
 * 국가(country)에 따라 적절한 길찾기 URL을 하나로 묶어서 반환한다.
 * app.js는 이 함수 하나만 호출하면 된다.
 */
export function buildDirectionsLinks(restaurant, userLocation) {
  const origin = userLocation
    ? { originLat: userLocation.lat, originLng: userLocation.lng }
    : { originLat: null, originLng: null };

  if (restaurant.country === "KR") {
    return {
      primaryLabel: "네이버 지도 길찾기",
      primaryUrl: buildNaverAppDirectionsUrl({
        ...origin,
        destLat: restaurant.latitude,
        destLng: restaurant.longitude,
        destName: restaurant.name,
      }),
      fallbackLabel: "네이버 지도에서 검색",
      fallbackUrl: buildNaverWebSearchUrl({
        destName: restaurant.name,
        address: restaurant.address,
      }),
    };
  }

  // 기본값(JP 등): Google Maps
  return {
    primaryLabel: "구글 지도 길찾기",
    primaryUrl: buildGoogleDirectionsUrl({
      ...origin,
      destLat: restaurant.latitude,
      destLng: restaurant.longitude,
      travelMode: "transit",
    }),
    fallbackLabel: null,
    fallbackUrl: null,
  };
}

/** restaurant.external.url (원본 지도 링크)로 이동하는 "지도 보기" 버튼용 헬퍼 */
export function getExternalMapUrl(restaurant) {
  return restaurant.external?.url || null;
}
