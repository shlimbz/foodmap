// js/constants.js
// 카테고리 아이콘, 상태별 색상/라벨 등 앱 전역에서 공유하는 상수 모음.
// 지도 마커(js/providers/*)와 리스트/필터 UI(app.js)가 동일한 값을 참조합니다.

export const CATEGORY_META = {
  sushi: { icon: "🍣", label: "스시" },
  ramen: { icon: "🍜", label: "라멘" },
  yakiniku: { icon: "🥩", label: "야키니쿠" },
  izakaya: { icon: "🍺", label: "이자카야" },
  curry: { icon: "🍛", label: "카레" },
  cafe: { icon: "☕", label: "카페" },
  dessert: { icon: "🍰", label: "디저트" },
  korean: { icon: "🍚", label: "한식" },
  chinese: { icon: "🥟", label: "중식" },
  japanese: { icon: "🇯🇵", label: "일본요리" },
  etc: { icon: "🍽️", label: "기타" },
};

export function getCategoryMeta(categoryKey) {
  return CATEGORY_META[categoryKey] || CATEGORY_META.etc;
}

export const STATUS_META = {
  want: { icon: "🟡", label: "가보고 싶은 곳", color: "#F5A623" },
  visited: { icon: "🟢", label: "가본 곳", color: "#2FA86A" },
  avoid: { icon: "🔴", label: "가면 안될 곳", color: "#E24C4C" },
};

export function getStatusMeta(statusKey) {
  return STATUS_META[statusKey] || STATUS_META.want;
}

export const COUNTRY_META = {
  KR: { flag: "🇰🇷", label: "한국" },
  JP: { flag: "🇯🇵", label: "일본" },
};

export const REGIONS = [
  "Seoul",
  "Busan",
  "Jeju",
  "Tokyo",
  "Osaka",
  "Kyoto",
  "Fukuoka",
  "etc",
];

export const REGION_LABELS = {
  Seoul: "서울",
  Busan: "부산",
  Jeju: "제주",
  Tokyo: "도쿄",
  Osaka: "오사카",
  Kyoto: "교토",
  Fukuoka: "후쿠오카",
  etc: "기타",
};

export const NEARBY_RADII_M = [500, 1000, 3000, 5000];

// 국가별 외부 지도/길찾기 provider 매핑 (요구사항 8, 18)
export const NAV_PROVIDER_BY_COUNTRY = {
  KR: "naver",
  JP: "google",
};
