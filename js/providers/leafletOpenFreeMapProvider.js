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

// positron 스타일: POI/3D 건물 레이어가 없는 가벼운 2D 스타일이라
// liberty(기본) 대비 로딩이 빠르고, 굳이 필요 없는 "3D 느낌"도 없다.
const OPENFREEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

// 지명 라벨에 어떤 언어 필드를 몇 줄로 보여줄지 (OpenMapTiles 스키마 기준).
// 작은 지명은 name:en/name:ja/name:ko 데이터 자체가 없을 수 있어,
// 그 경우 해당 줄이 비어 보일 수 있다 (OSM 데이터 완성도에 따라 달라짐).
const LABEL_LANGUAGE_PRESETS = {
  ko: [["name:ko", "name"]], // 한국어만 1줄
  "en-ja-ko": [
    ["name:en", "name:latin"], // 1줄: 영문
    ["name:ja", "name"], // 2줄: 일본어(로컬 표기)
    ["name:ko"], // 3줄: 한국어(데이터가 있는 경우만)
  ],
  default: [["name:latin", "name"], ["name:nonlatin"]], // OpenFreeMap 기본과 비슷한 2줄
};

export function createLeafletOpenFreeMapProvider() {
  /** @type {L.Map | null} */
  let map = null;
  /** @type {Map<string, L.Marker>} */
  const markers = new Map();
  /** @type {L.Marker | null} */
  let userMarker = null;
  /** @type {L.Marker | null} */
  let pickerMarker = null;
  let selectedId = null;
  /** @type {any} maplibre-gl-leaflet 레이어 (getMaplibreMap()으로 내부 MapLibre 인스턴스 접근) */
  let glLayer = null;
  // onMapClick은 지도가 아직 준비되기 전에도 호출될 수 있으므로(버튼 바인딩이
  // 지도 로딩을 기다리지 않도록 app.js에서 먼저 실행됨) 핸들러를 큐에 쌓아두고,
  // 실제 Leaflet map이 생기면 그때 한 번에 연결한다.
  const clickHandlers = [];

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
      glLayer = L.maplibreGL({
        style: OPENFREEMAP_STYLE_URL,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors, tiles by <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>',
        // 회전/기울기(pitch)를 막아서 "3D로 기울어지는" 느낌을 원천 차단하고,
        // 불필요한 재계산을 줄여 체감 속도를 높인다.
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        touchZoomRotate: { rotate: false },
        fadeDuration: 0,
      }).addTo(map);

      map.touchZoomRotate?.disableRotate?.();

      map.on("click", (e) => {
        clickHandlers.forEach((h) => h({ lat: e.latlng.lat, lng: e.latlng.lng }));
      });
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
      clickHandlers.push(handler);
    },

    // 맛집 등록 폼에서 "지도에서 위치 선택"할 때 쓰는 임시 마커.
    setPickerMarker(lat, lng) {
      if (!map) return;
      if (!pickerMarker) {
        pickerMarker = L.marker([lat, lng], {
          icon: L.divIcon({
            className: "",
            html: `<div class="picker-marker">📍</div>`,
            iconSize: [34, 34],
            iconAnchor: [17, 34],
          }),
          interactive: false,
        }).addTo(map);
      } else {
        pickerMarker.setLatLng([lat, lng]);
      }
    },

    clearPickerMarker() {
      if (pickerMarker) {
        map?.removeLayer(pickerMarker);
        pickerMarker = null;
      }
    },

    // 지명 라벨 언어 전환. preset: "ko" | "en-ja-ko" | "default"
    // 내부 MapLibre 인스턴스가 스타일을 다 불러온 뒤에만 레이어를 건드릴 수 있어서,
    // 아직 준비 전이면 'load' 이벤트를 기다렸다가 적용한다.
    setLabelLanguages(preset = "default") {
      const glMap = glLayer?.getMaplibreMap?.();
      if (!glMap) return;

      const apply = () => {
        const lines = LABEL_LANGUAGE_PRESETS[preset] || LABEL_LANGUAGE_PRESETS.default;
        const style = glMap.getStyle();
        if (!style?.layers) return;

        style.layers.forEach((layer) => {
          const textField = layer.layout?.["text-field"];
          if (!textField) return;
          // 이름(name) 관련 라벨 레이어만 골라서 바꾼다 (도로 shield 숫자 등은 건드리지 않음)
          if (!JSON.stringify(textField).includes("name")) return;

          const lineExprs = lines.map((fields) => [
            "coalesce",
            ...fields.map((f) => ["get", f]),
            "",
          ]);
          const expression =
            lineExprs.length === 1
              ? lineExprs[0]
              : ["concat", ...lineExprs.flatMap((expr, i) => (i === 0 ? [expr] : ["\n", expr]))];

          try {
            glMap.setLayoutProperty(layer.id, "text-field", expression);
          } catch {
            /* 일부 레이어는 text-field 형식이 달라 실패할 수 있음 — 무시하고 계속 */
          }
        });
      };

      if (glMap.isStyleLoaded()) apply();
      else glMap.once("load", apply);
    },
  };
}
