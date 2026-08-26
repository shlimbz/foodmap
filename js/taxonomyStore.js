// js/taxonomyStore.js
//
// 지역(region)과 음식 태그(category)는 두 종류로 나뉜다.
//   - 기본값: js/constants.js에 하드코딩 (REGIONS_BY_COUNTRY, CATEGORY_META, REGION_LABELS)
//   - 커스텀: Firestore의 regions / categories 컬렉션에 관리자가 추가한 것 (admin.html에서 관리)
//
// 이 파일은 앱이 켜질 때 Firestore의 커스텀 값을 읽어와 constants.js가 내보내는
// 객체(REGIONS_BY_COUNTRY 등)에 "그대로 합쳐(mutate)" 넣는다. 객체 참조를 그대로
// 공유하기 때문에, mapProvider나 app.js 등 이미 constants.js에서 값을 import해 쓰고
// 있는 다른 모든 파일도 코드를 바꿀 필요 없이 자동으로 최신 목록을 보게 된다.

import { REGIONS_BY_COUNTRY, REGION_LABELS, CATEGORY_META } from "./constants.js";

let customRegionDocs = [];
let customCategoryDocs = [];

export function applyCustomRegions(docs) {
  customRegionDocs = docs;
  docs.forEach((d) => {
    if (!d.country || !d.slug) return;
    if (!REGIONS_BY_COUNTRY[d.country]) REGIONS_BY_COUNTRY[d.country] = [];
    if (!REGIONS_BY_COUNTRY[d.country].includes(d.slug)) {
      // "기타"는 항상 목록 맨 끝에 오도록, 그 앞에 끼워 넣는다.
      const etcIndex = REGIONS_BY_COUNTRY[d.country].indexOf("etc");
      if (etcIndex === -1) REGIONS_BY_COUNTRY[d.country].push(d.slug);
      else REGIONS_BY_COUNTRY[d.country].splice(etcIndex, 0, d.slug);
    }
    REGION_LABELS[d.slug] = d.label;
  });
}

export function applyCustomCategories(docs) {
  customCategoryDocs = docs;
  docs.forEach((d) => {
    if (!d.slug || !d.label) return;
    CATEGORY_META[d.slug] = { icon: d.icon || "🍽️", label: d.label };
  });
}

export function getCustomRegionDocs() {
  return customRegionDocs;
}
export function getCustomCategoryDocs() {
  return customCategoryDocs;
}
