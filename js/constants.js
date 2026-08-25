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

// 국가를 고르면 그 국가의 지역만 보여주기 위한 목록.
// 여기 없는 지역은 등록 폼에서 "기타(직접입력)"으로 자유 입력할 수 있다.
export const REGIONS_BY_COUNTRY = {
  KR: ["Seoul", "Busan", "Jeju", "etc"],
  JP: ["Tokyo", "Osaka", "Kyoto", "Fukuoka", "etc"],
};

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

// 맛집 등록 폼의 영업시간 요일 선택에 사용
export const DAY_META = [
  { key: "mon", label: "월" },
  { key: "tue", label: "화" },
  { key: "wed", label: "수" },
  { key: "thu", label: "목" },
  { key: "fri", label: "금" },
  { key: "sat", label: "토" },
  { key: "sun", label: "일" },
];
