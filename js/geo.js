// js/geo.js
// 브라우저 Geolocation 래퍼 + 클라이언트 사이드 거리 계산(Haversine).
// 별도의 거리 계산 API를 사용하지 않는다 (요구사항 17).

const EARTH_RADIUS_M = 6371000;

/** 두 좌표 사이의 직선 거리(m)를 계산한다. */
export function distanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

export function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * 현재 위치를 1회 가져온다. 실패 시(권한 거부 등) reason과 함께 reject한다.
 * 위치 정보는 브라우저에서만 사용하고 Firebase에는 저장하지 않는다 (요구사항 16, 22).
 */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("geolocation-unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  });
}

/**
 * 위치 변경을 지속적으로 구독한다 (요구사항 16: "위치가 변경되면 현재 위치 마커도 업데이트").
 * @returns {number} watchId - clearWatchPosition에 전달할 id
 */
export function watchPosition(onUpdate, onError) {
  if (!("geolocation" in navigator)) {
    onError?.(new Error("geolocation-unsupported"));
    return null;
  }
  return navigator.geolocation.watchPosition(
    (pos) => onUpdate({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    (err) => onError?.(err),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
  );
}

export function clearWatchPosition(watchId) {
  if (watchId != null) {
    navigator.geolocation.clearWatch(watchId);
  }
}
