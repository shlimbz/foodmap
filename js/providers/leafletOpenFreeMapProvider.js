// js/providers/leafletOpenFreeMapProvider.js
//
// MapProvider 인터페이스(js/mapProvider.js 참고)의 구체적인 구현체.
// Leaflet + OpenFreeMap(MapLibre 스타일 벡터 타일)을 사용한다.
//
// OpenFreeMap은 XYZ 래스터 타일이 아니라 MapLibre 스타일(JSON) 기반의
// 벡터 타일 서비스이므로, Leaflet에서 그대로 L.tileLayer로 붙일 수 없다.
// 공식 가이드(https://openfreemap.org/quick_start/)에 따라
// "@maplibre/maplibre-gl-leaflet" 플러그인으로 MapLibre GL 레이어를
// Leaflet 지도 위에 얹는 방식을 사용한다. (index.html에서 CDN으로 로드)
//
// 이 파일이 OpenFreeMap/MapLibre를 알고 있는 유일한 곳이며,
// 다른 provider로 교체할 때는 이 파일과 동일한 인터페이스를 구현하는
// 새 파일만 추가하면 된다 (app.js는 전혀 수정 불필요).

import { getCategoryMeta, getStatusMeta } from "../constants.js";

const OPENFREEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export function createLeafletOpenFreeMapProvider() {
  /** @type {L.Map | null} */
  let map = null;
  /** @type {Map<string, L.Marker>} */
  const markers = new Map();
  /** @type {L.Marker | null} */
  let userMarker = null;
  let selectedId = null;

  function buildDivIcon(restaurant, isSelected) {
    const category = getCategoryMeta(restaurant.categories?.[0]);
    const status = getStatusMeta(restaurant.status);
    return L.divIcon({
      className: "",
      html: `
        <div class="map-marker ${isSelected ? "map-marker--selected" : ""}"
             style="--marker-color:${status.color}">
          <span class="map-marker__emoji">${category.icon}</span>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 34],
      popupAnchor: [0, -32],
    });
  }

  function buildUserIcon() {
    return L.divIcon({
      className: "",
      html: `<div class="user-marker"><div class="user-marker__dot"></div></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }

  return {
    async init({ containerId, center, zoom }) {
      map = L.map(containerId, {
        zoomControl: false,
        attributionControl: true,
      }).setView(center, zoom);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // OpenFreeMap(MapLibre style)을 Leaflet 위에 렌더링.
      // 이 한 줄만 다른 style URL / provider로 바꾸면 지도 배경 교체 가능.
      L.maplibreGL({
        style: OPENFREEMAP_STYLE_URL,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors, tiles by <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>',
      }).addTo(map);
    },

    addOrUpdateMarker(restaurant, { onClick } = {}) {
      if (!map) return;
      const existing = markers.get(restaurant.id);
      const latlng = [restaurant.latitude, restaurant.longitude];
      const icon = buildDivIcon(restaurant, restaurant.id === selectedId);

      if (existing) {
        existing.setLatLng(latlng);
        existing.setIcon(icon);
        return;
      }

      const marker = L.marker(latlng, { icon }).addTo(map);
      if (onClick) {
        marker.on("click", () => onClick(restaurant.id));
      }
      markers.set(restaurant.id, marker);
    },

    removeMarker(id) {
      const marker = markers.get(id);
      if (marker) {
        map?.removeLayer(marker);
        markers.delete(id);
      }
    },

    clearMarkers() {
      markers.forEach((marker) => map?.removeLayer(marker));
      markers.clear();
    },

    setSelected(id) {
      const prevSelected = selectedId;
      selectedId = id;
      // 아이콘을 다시 그려 선택 상태를 반영 (마커 자체 데이터는 app.js가 갖고 있으므로
      // 여기서는 CSS 클래스만 토글해도 충분하다)
      [prevSelected, id].forEach((markerId) => {
        const marker = markers.get(markerId);
        if (!marker) return;
        const el = marker.getElement();
        const node = el?.querySelector(".map-marker");
        if (node) {
          node.classList.toggle("map-marker--selected", markerId === id);
        }
      });
    },

    focusOn(lat, lng, zoom = 16) {
      map?.flyTo([lat, lng], zoom, { duration: 0.6 });
    },

    fitToMarkers(restaurants) {
      if (!map || restaurants.length === 0) return;
      const bounds = L.latLngBounds(
        restaurants.map((r) => [r.latitude, r.longitude])
      );
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
    },

    setUserLocation(lat, lng) {
      if (!map) return;
      if (userMarker) {
        userMarker.setLatLng([lat, lng]);
      } else {
        userMarker = L.marker([lat, lng], {
          icon: buildUserIcon(),
          zIndexOffset: 1000,
          interactive: false,
        }).addTo(map);
      }
    },

    clearUserLocation() {
      if (userMarker) {
        map?.removeLayer(userMarker);
        userMarker = null;
      }
    },

    onMapClick(handler) {
      map?.on("click", () => handler());
    },
  };
}
