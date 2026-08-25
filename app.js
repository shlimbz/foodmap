// app.js
// 앱의 진입점. 이 파일은 다음 역할만 한다:
//   1) Firebase Firestore에서 restaurants를 1회 로드해 메모리에 캐시 (요구사항 20)
//   2) 필터/검색은 이미 로드된 데이터를 클라이언트에서 처리
//   3) js/mapProvider.js가 제공하는 인터페이스로만 지도를 그림 (지도 구현 세부사항을 모름)
//   4) 지도 ↔ 리스트 선택 상태를 서로 동기화
//   5) 길찾기는 js/directions.js가 만들어주는 외부 URL을 여는 것으로 끝 (직접 계산 X)

import { firebaseConfig, COLLECTIONS } from "./firebase-config.js";
import { createMapProvider } from "./js/mapProvider.js";
import {
  getCategoryMeta,
  getStatusMeta,
  COUNTRY_META,
  REGION_LABELS,
} from "./js/constants.js";
import {
  distanceMeters,
  formatDistance,
  getCurrentPosition,
  watchPosition,
} from "./js/geo.js";
import { buildDirectionsLinks, getExternalMapUrl } from "./js/directions.js";
import { TEST_RESTAURANTS } from "./js/testData.js";

// ------------------------------------------------------------
// 전역 상태
// ------------------------------------------------------------
const state = {
  restaurants: [],
  filters: { country: "all", status: "all", category: "all", region: "all", nearby: "all" },
  search: "",
  selectedId: null,
  userLocation: null, // { lat, lng } — Firebase에는 저장하지 않음 (요구사항 16, 22)
  dataSource: null, // "firestore" | "fallback"
};

let mapProvider;
let watchId = null;

// ------------------------------------------------------------
// DOM 참조
// ------------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const els = {
  searchInput: $("#search-input"),
  locateBtn: $("#locate-btn"),
  filterbar: $("#filterbar"),
  main: $("#main"),
  list: $("#restaurant-list"),
  listEmpty: $("#list-empty"),
  resultCount: $("#result-count"),
  mapError: $("#map-error"),
  mobileSwitch: $("#mobile-switch"),
  detailPanel: $("#detail-panel"),
  detailBackdrop: $("#detail-backdrop"),
  detailContent: $("#detail-content"),
  detailClose: $("#detail-close"),
  toast: $("#toast"),
};

// ------------------------------------------------------------
// 초기화
// ------------------------------------------------------------
init();

async function init() {
  // 지도 provider는 여기서 딱 한 곳만 이름으로 지정한다.
  // 다른 타일 서비스로 교체할 때는 이 문자열만 바꾸면 된다 (js/mapProvider.js 참고).
  mapProvider = createMapProvider("leaflet-openfreemap");

  // 한국-일본을 모두 아우르는 기본 시야로 시작 (요구사항 6)
  try {
    await mapProvider.init({ containerId: "map", center: [35.5, 132.5], zoom: 5 });
    mapProvider.onMapClick(() => closeDetailPanel());
  } catch (err) {
    console.error("지도 초기화 실패:", err);
    els.mapError.textContent = "지도를 불러오지 못했습니다. 네트워크 연결을 확인해주세요.";
    els.mapError.hidden = false;
  }

  setupFilterBar();
  setupSearch();
  setupLocate();
  setupMobileSwitch();
  setupDetailPanelClose();

  await loadRestaurants();
  renderAll();
}

// ------------------------------------------------------------
// 데이터 로드 (Firestore, 실패 시 테스트 데이터로 폴백)
// ------------------------------------------------------------
async function loadRestaurants() {
  const isConfigured = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_");

  if (!isConfigured) {
    useFallbackData(
      "Firebase 설정이 비어 있어 테스트 데이터로 실행 중입니다. firebase-config.js를 채워주세요."
    );
    return;
  }

  try {
    const { initializeApp } = await import(
      "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"
    );
    const { getFirestore, collection, getDocs } = await import(
      "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"
    );

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const snapshot = await getDocs(collection(db, COLLECTIONS.restaurants));

    if (snapshot.empty) {
      useFallbackData("Firestore에 맛집 데이터가 아직 없어 테스트 데이터로 보여드려요.");
      return;
    }

    state.restaurants = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    state.dataSource = "firestore";
  } catch (err) {
    console.error("Firestore 로드 실패:", err);
    useFallbackData("맛집 데이터를 불러오지 못했습니다. 테스트 데이터로 보여드려요.");
  }
}

function useFallbackData(message) {
  state.restaurants = TEST_RESTAURANTS;
  state.dataSource = "fallback";
  showToast(message, 6000);
}

// ------------------------------------------------------------
// 필터링 / 검색 (전부 클라이언트 사이드, 요구사항 20)
// ------------------------------------------------------------
function getFilteredRestaurants() {
  const { country, status, category, region, nearby } = state.filters;
  const query = state.search.trim().toLowerCase();

  return state.restaurants
    .filter((r) => country === "all" || r.country === country)
    .filter((r) => status === "all" || r.status === status)
    .filter((r) => category === "all" || (r.categories || []).includes(category))
    .filter((r) => region === "all" || r.region === region)
    .filter((r) => {
      if (nearby === "all") return true;
      if (!state.userLocation) return true; // 위치 없으면 거리 필터 무시
      const d = distanceMeters(
        state.userLocation.lat,
        state.userLocation.lng,
        r.latitude,
        r.longitude
      );
      return d <= Number(nearby);
    })
    .filter((r) => {
      if (!query) return true;
      const haystack = [r.name, r.region, r.district, r.address, ...(r.categories || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    })
    .map((r) => {
      if (!state.userLocation) return r;
      return {
        ...r,
        _distance: distanceMeters(
          state.userLocation.lat,
          state.userLocation.lng,
          r.latitude,
          r.longitude
        ),
      };
    })
    .sort((a, b) => (a._distance ?? Infinity) - (b._distance ?? Infinity));
}

// ------------------------------------------------------------
// 렌더링: 지도 마커 + 리스트를 동시에 갱신 (요구사항 25)
// ------------------------------------------------------------
function renderAll() {
  const filtered = getFilteredRestaurants();

  renderMarkers(filtered);
  renderList(filtered);

  els.resultCount.textContent = `${filtered.length}개의 맛집`;
  els.listEmpty.hidden = filtered.length !== 0;
}

function renderMarkers(filtered) {
  mapProvider.clearMarkers();
  filtered.forEach((r) => {
    mapProvider.addOrUpdateMarker(r, { onClick: (id) => selectRestaurant(id, { fromMap: true }) });
  });
}

function renderList(filtered) {
  els.list.innerHTML = "";
  const fragment = document.createDocumentFragment();

  filtered.forEach((r) => {
    const category = getCategoryMeta(r.categories?.[0]);
    const status = getStatusMeta(r.status);
    const regionLabel = REGION_LABELS[r.region] || r.region;

    const li = document.createElement("li");
    li.className = "restaurant-card";
    li.dataset.id = r.id;
    li.dataset.status = r.status;
    if (r.id === state.selectedId) li.classList.add("is-selected");

    li.innerHTML = `
      <div class="restaurant-card__icon">${category.icon}</div>
      <div class="restaurant-card__body">
        <p class="restaurant-card__name">${escapeHtml(r.name)}</p>
        <p class="restaurant-card__meta">${COUNTRY_META[r.country]?.flag || ""} ${escapeHtml(
          regionLabel || ""
        )}${r.district ? " / " + escapeHtml(r.district) : ""}</p>
        <div class="restaurant-card__row">
          <span class="restaurant-card__status">${status.icon} ${status.label}</span>
          ${
            r.external?.rating
              ? `<span class="restaurant-card__rating">${
                  r.external.provider === "naver" ? "네이버" : "구글"
                } ⭐ ${r.external.rating}</span>`
              : ""
          }
          ${
            r.my?.rating
              ? `<span class="restaurant-card__rating restaurant-card__rating--mine">내 평점 ⭐ ${r.my.rating}</span>`
              : ""
          }
          ${
            r._distance != null
              ? `<span class="restaurant-card__distance">${formatDistance(r._distance)}</span>`
              : ""
          }
        </div>
      </div>
    `;

    li.addEventListener("click", () => selectRestaurant(r.id, { fromMap: false }));
    fragment.appendChild(li);
  });

  els.list.appendChild(fragment);
}

// ------------------------------------------------------------
// 선택 상태 동기화 (지도 ↔ 리스트, 요구사항 13)
// ------------------------------------------------------------
function selectRestaurant(id, { fromMap } = {}) {
  const restaurant = state.restaurants.find((r) => r.id === id);
  if (!restaurant) return;

  state.selectedId = id;
  mapProvider.setSelected(id);
  mapProvider.focusOn(restaurant.latitude, restaurant.longitude, 16);

  document.querySelectorAll(".restaurant-card").forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.id === id);
  });

  if (!fromMap) {
    document
      .querySelector(`.restaurant-card[data-id="${cssEscape(id)}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  } else {
    document
      .querySelector(`.restaurant-card[data-id="${cssEscape(id)}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  openDetailPanel(restaurant);
}

// ------------------------------------------------------------
// 상세 정보 패널 (요구사항 12)
// ------------------------------------------------------------
function openDetailPanel(r) {
  const category = getCategoryMeta(r.categories?.[0]);
  const status = getStatusMeta(r.status);
  const regionLabel = REGION_LABELS[r.region] || r.region;
  const nav = buildDirectionsLinks(r, state.userLocation);
  const externalUrl = getExternalMapUrl(r);

  els.detailContent.innerHTML = `
    <div class="detail-hero">
      <div class="detail-hero__icon">${category.icon}</div>
      <div>
        <p class="detail-hero__name">${escapeHtml(r.name)}</p>
        <p class="detail-hero__location">${COUNTRY_META[r.country]?.flag || ""} ${escapeHtml(
          regionLabel || ""
        )}${r.district ? " / " + escapeHtml(r.district) : ""}</p>
      </div>
    </div>

    <div class="status-pill" data-status="${r.status}">${status.icon} ${status.label}</div>

    <div class="rating-row">
      <div class="rating-box">
        <div class="rating-box__label">${r.external?.provider === "naver" ? "Naver" : "Google"}</div>
        <div class="rating-box__value">${
          r.external?.rating ? `⭐ ${r.external.rating} (${r.external.ratingCount ?? 0})` : "정보 없음"
        }</div>
      </div>
      <div class="rating-box rating-box--mine">
        <div class="rating-box__label">내 평가</div>
        <div class="rating-box__value">${r.my?.rating ? `⭐ ${r.my.rating}` : "미평가"}</div>
      </div>
    </div>

    <div class="detail-section">
      <p class="detail-section__label">음식 종류</p>
      <div class="detail-section__categories">
        ${(r.categories || [])
          .map((c) => `<span class="category-tag">${getCategoryMeta(c).icon} ${getCategoryMeta(c).label}</span>`)
          .join("")}
      </div>
    </div>

    ${
      r.openingHours?.length
        ? `<div class="detail-section"><p class="detail-section__label">🕐 영업시간</p><p>${r.openingHours
            .map(escapeHtml)
            .join(" · ")}</p></div>`
        : ""
    }

    ${
      r.address
        ? `<div class="detail-section"><p class="detail-section__label">주소</p><p>${escapeHtml(r.address)}</p></div>`
        : ""
    }

    ${
      r.my?.memo
        ? `<div class="detail-section"><p class="detail-section__label">내 메모</p><p>${escapeHtml(r.my.memo)}</p></div>`
        : ""
    }

    <div class="detail-actions">
      ${externalUrl ? `<a class="btn btn--ghost" href="${externalUrl}" target="_blank" rel="noopener">지도 보기</a>` : ""}
      <a class="btn btn--primary" href="${nav.primaryUrl}" target="_blank" rel="noopener">🧭 ${nav.primaryLabel}</a>
    </div>
    ${
      nav.fallbackUrl
        ? `<p style="margin-top:8px;font-size:11.5px;color:var(--ink-soft);">앱이 없다면 <a href="${nav.fallbackUrl}" target="_blank" rel="noopener">${nav.fallbackLabel}</a></p>`
        : ""
    }
  `;

  els.detailPanel.hidden = false;
  els.detailBackdrop.hidden = window.innerWidth > 860 ? true : false;
}

function closeDetailPanel() {
  els.detailPanel.hidden = true;
  els.detailBackdrop.hidden = true;
}

function setupDetailPanelClose() {
  els.detailClose.addEventListener("click", closeDetailPanel);
  els.detailBackdrop.addEventListener("click", closeDetailPanel);
}

// ------------------------------------------------------------
// 필터 바 (요구사항 14)
// ------------------------------------------------------------
function setupFilterBar() {
  els.filterbar.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const group = chip.closest("[data-filter-group]");
    const filterKey = group.dataset.filterGroup;
    const value = chip.dataset.value;

    if (filterKey === "nearby" && value !== "all" && !state.userLocation) {
      showToast("먼저 내 위치를 확인해주세요.", 3000);
      return;
    }

    group.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-active", c === chip));
    state.filters[filterKey] = value;
    renderAll();
  });
}

// ------------------------------------------------------------
// 검색 (요구사항 15)
// ------------------------------------------------------------
function setupSearch() {
  let debounceTimer;
  els.searchInput.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.search = e.target.value;
      renderAll();
    }, 150);
  });
}

// ------------------------------------------------------------
// 내 위치 (요구사항 16, 17)
// ------------------------------------------------------------
function setupLocate() {
  els.locateBtn.addEventListener("click", async () => {
    try {
      els.locateBtn.classList.add("is-active");
      const pos = await getCurrentPosition();
      state.userLocation = pos;
      mapProvider.setUserLocation(pos.lat, pos.lng);
      mapProvider.focusOn(pos.lat, pos.lng, 13);
      renderAll();

      if (watchId == null) {
        watchId = watchPosition(
          (updated) => {
            state.userLocation = updated;
            mapProvider.setUserLocation(updated.lat, updated.lng);
          },
          () => {
            /* 워치 중 에러는 조용히 무시 (최초 권한 요청에서 이미 안내함) */
          }
        );
      }
    } catch (err) {
      console.warn("위치 조회 실패:", err);
      showToast("현재 위치를 사용할 수 없습니다.", 4000);
      els.locateBtn.classList.remove("is-active");
    }
  });
}

// ------------------------------------------------------------
// 모바일 지도/리스트 전환 (요구사항 23)
// ------------------------------------------------------------
function setupMobileSwitch() {
  els.mobileSwitch.addEventListener("click", (e) => {
    const btn = e.target.closest(".mobile-switch__btn");
    if (!btn) return;
    els.mobileSwitch
      .querySelectorAll(".mobile-switch__btn")
      .forEach((b) => b.classList.toggle("is-active", b === btn));
    els.main.dataset.mobileView = btn.dataset.view;
  });
  els.main.dataset.mobileView = "map";
}

// ------------------------------------------------------------
// 유틸
// ------------------------------------------------------------
function showToast(message, duration = 3000) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    els.toast.hidden = true;
  }, duration);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

function cssEscape(str) {
  return window.CSS?.escape ? window.CSS.escape(str) : str.replace(/"/g, '\\"');
}
