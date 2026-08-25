// js/mapProvider.js
//
// ============================================================
// 지도 Provider 추상 레이어
// ============================================================
// 이 파일은 "지도를 어떻게 그릴 것인가"를 앱의 나머지 부분(app.js)과
// 완전히 분리하기 위한 인터페이스 정의입니다.
//
// app.js는 아래 인터페이스(createMapProvider가 반환하는 객체)에만 의존하고,
// Leaflet, OpenFreeMap, MapLibre 같은 구체적인 라이브러리 이름을
// 절대 직접 알지 못합니다.
//
// 나중에 OpenFreeMap 정책이 바뀌거나 다른 타일 provider(예: MapTiler,
// Stadia Maps, 자체 타일 서버 등)로 교체해야 할 경우
//   1) js/providers/ 아래에 새 provider 파일을 하나 추가하고
//   2) 아래 PROVIDERS 맵에 등록하고
//   3) index.html에서 현재 사용할 provider 이름만 바꾸면 됩니다.
// Firebase 데이터 구조, 필터 로직, 리스트 UI 등 나머지 코드는
// 전혀 수정할 필요가 없습니다.
//
// ------------------------------------------------------------
// MapProvider 인터페이스 (모든 provider가 구현해야 하는 계약)
// ------------------------------------------------------------
// interface MapProvider {
//   init({ containerId, center: [lat, lng], zoom }): Promise<void>
//     - 지도를 생성하고 화면에 렌더링한다.
//
//   addOrUpdateMarker(restaurant, { onClick }): void
//     - restaurant.id 를 key로 마커를 추가하거나, 이미 있으면 갱신한다.
//     - 아이콘/색상은 restaurant.categories[0], restaurant.status 기반으로 provider가 그린다.
//     - 마커를 클릭하면 onClick(restaurant.id) 를 호출해야 한다.
//
//   removeMarker(id): void
//   clearMarkers(): void
//     - 현재 표시된 모든 맛집 마커를 제거한다. (필터 변경 시 재사용)
//
//   setSelected(id): void
//     - 특정 마커를 "선택됨" 상태로 시각적으로 강조한다. (리스트 클릭과 연동)
//
//   focusOn(lat, lng, zoom?): void
//     - 특정 좌표로 지도를 이동/확대한다. (리스트 항목 클릭 시 사용)
//
//   fitToMarkers(restaurants): void
//     - 여러 마커가 모두 보이도록 지도 범위를 자동 조정한다.
//
//   setUserLocation(lat, lng): void
//   clearUserLocation(): void
//     - 내 위치 마커를 표시/제거한다.
//
//   onMapClick(handler): void
//     - 지도의 빈 공간 클릭 시 호출할 콜백을 등록한다. (상세 패널 닫기 등에 사용)
// }
// ------------------------------------------------------------

import { createLeafletOpenFreeMapProvider } from "./providers/leafletOpenFreeMapProvider.js";

// 새로운 provider를 추가하면 여기에 등록하기만 하면 됩니다.
const PROVIDERS = {
  "leaflet-openfreemap": createLeafletOpenFreeMapProvider,
  // 예시) 향후 다른 타일 서비스로 교체할 경우:
  // "leaflet-maptiler": createLeafletMapTilerProvider,
};

/**
 * @param {string} providerName - PROVIDERS 에 등록된 provider key
 * @returns {MapProvider}
 */
export function createMapProvider(providerName = "leaflet-openfreemap") {
  const factory = PROVIDERS[providerName];
  if (!factory) {
    throw new Error(
      `알 수 없는 지도 provider입니다: "${providerName}". js/mapProvider.js의 PROVIDERS 목록을 확인하세요.`
    );
  }
  return factory();
}
