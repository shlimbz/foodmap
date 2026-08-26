// admin.js
// 관리자 전용 페이지. app.js(일반 사용자용)와 완전히 분리돼 있고,
// Firebase Authentication으로 로그인해야만 데이터를 쓸 수 있다.
// (회원가입 UI는 의도적으로 없음 — Firebase 콘솔에서 관리자 계정을 직접 만들어야 함)

import { getAuth, getAuthFns, isFirebaseConfigured } from "./js/firebaseClient.js";
import {
  fetchCustomRegions,
  fetchCustomCategories,
  createRegion,
  deleteRegion,
  createCategory,
  deleteCategory,
} from "./js/taxonomyWrite.js";
import { fetchAllRestaurants, updateRestaurant, deleteRestaurant } from "./js/restaurantWrite.js";
import { REGIONS_BY_COUNTRY, REGION_LABELS, COUNTRY_META, STATUS_META } from "./js/constants.js";

const $ = (sel) => document.querySelector(sel);
const els = {
  loginView: $("#login-view"),
  loginForm: $("#login-form"),
  loginError: $("#login-error"),
  adminView: $("#admin-view"),
  logoutBtn: $("#logout-btn"),
  tabs: document.querySelectorAll(".admin-tab"),
  tabRegions: $("#tab-regions"),
  tabCategories: $("#tab-categories"),
  tabRestaurants: $("#tab-restaurants"),
};

let auth;
let authFns;
let restaurantsCache = [];

async function main() {
  // Firebase 설정이 안 돼 있어도 폼 제출 시 페이지가 새로고침되지 않도록,
  // 이 리스너는 아래 isFirebaseConfigured() 체크보다 먼저 무조건 붙인다.
  els.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.loginError.hidden = true;

    if (!auth || !authFns) {
      els.loginError.textContent = "Firebase 설정이 완료되지 않았습니다. firebase-config.js를 확인해주세요.";
      els.loginError.hidden = false;
      return;
    }

    const fd = new FormData(els.loginForm);
    try {
      await authFns.signInWithEmailAndPassword(auth, fd.get("email"), fd.get("password"));
    } catch (err) {
      console.error(err);
      els.loginError.textContent = "로그인에 실패했어요. 이메일/비밀번호를 확인해주세요.";
      els.loginError.hidden = false;
    }
  });

  if (!isFirebaseConfigured()) {
    els.loginError.textContent = "firebase-config.js가 설정되지 않았습니다. 먼저 Firebase 연동을 완료해주세요.";
    els.loginError.hidden = false;
    return;
  }

  auth = await getAuth();
  authFns = await getAuthFns();

  if (!auth || !authFns) {
    els.loginError.textContent = "Firebase Authentication을 초기화하지 못했어요. 콘솔에서 이메일/비밀번호 로그인이 켜져 있는지 확인해주세요.";
    els.loginError.hidden = false;
    return;
  }

  authFns.onAuthStateChanged(auth, (user) => {
    if (user) {
      els.loginView.hidden = true;
      els.adminView.hidden = false;
      els.logoutBtn.hidden = false;
      loadTab("regions");
    } else {
      els.loginView.hidden = false;
      els.adminView.hidden = true;
      els.logoutBtn.hidden = true;
    }
  });

  els.logoutBtn.addEventListener("click", () => authFns.signOut(auth));

  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      els.tabs.forEach((t) => t.classList.toggle("is-active", t === tab));
      [els.tabRegions, els.tabCategories, els.tabRestaurants].forEach((p) => (p.hidden = true));
      loadTab(tab.dataset.tab);
    });
  });
}

function loadTab(name) {
  if (name === "regions") {
    els.tabRegions.hidden = false;
    renderRegionsTab();
  } else if (name === "categories") {
    els.tabCategories.hidden = false;
    renderCategoriesTab();
  } else if (name === "restaurants") {
    els.tabRestaurants.hidden = false;
    renderRestaurantsTab();
  }
}

// ============================================================
// 지역 관리
// ============================================================
async function renderRegionsTab() {
  els.tabRegions.innerHTML = `<p class="admin-empty">불러오는 중...</p>`;
  const customRegions = await fetchCustomRegions();

  const builtinRows = Object.entries(REGIONS_BY_COUNTRY)
    .flatMap(([country, slugs]) => slugs.map((slug) => ({ country, slug })))
    .filter((r) => r.slug !== "etc")
    .map(
      (r) =>
        `<tr><td>${COUNTRY_META[r.country]?.flag || r.country}</td><td>${REGION_LABELS[r.slug] || r.slug}</td><td>${r.slug}</td><td>기본값</td></tr>`
    )
    .join("");

  const customRows = customRegions
    .map(
      (r) =>
        `<tr>
          <td>${COUNTRY_META[r.country]?.flag || r.country}</td>
          <td>${escapeHtml(r.label)}</td>
          <td>${escapeHtml(r.slug)}</td>
          <td><button class="btn btn--ghost" data-delete-region="${r.id}">삭제</button></td>
        </tr>`
    )
    .join("");

  els.tabRegions.innerHTML = `
    <p class="admin-section-title">새 지역 추가</p>
    <form class="admin-form-row" id="region-form">
      <div class="field">
        <label class="field__label">국가</label>
        <select name="country"><option value="KR">🇰🇷 한국</option><option value="JP">🇯🇵 일본</option></select>
      </div>
      <div class="field">
        <label class="field__label">slug (영문, 필터 저장값)</label>
        <input type="text" name="slug" placeholder="예) Incheon" required />
      </div>
      <div class="field">
        <label class="field__label">표시 이름</label>
        <input type="text" name="label" placeholder="예) 인천" required />
      </div>
      <button type="submit" class="btn btn--primary">추가</button>
    </form>

    <p class="admin-section-title">전체 지역 목록</p>
    <table class="admin-table">
      <thead><tr><th>국가</th><th>표시 이름</th><th>slug</th><th></th></tr></thead>
      <tbody>${builtinRows}${customRows || ""}</tbody>
    </table>
    ${customRegions.length === 0 ? "" : ""}
  `;

  els.tabRegions.querySelector("#region-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await createRegion({ country: fd.get("country"), slug: fd.get("slug").trim(), label: fd.get("label").trim() });
      renderRegionsTab();
    } catch (err) {
      alert("추가 실패: " + err.message);
    }
  });

  els.tabRegions.querySelectorAll("[data-delete-region]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("이 지역을 삭제할까요? (이미 이 지역으로 등록된 맛집의 region 값은 그대로 남습니다)")) return;
      try {
        await deleteRegion(btn.dataset.deleteRegion);
        renderRegionsTab();
      } catch (err) {
        alert("삭제 실패: " + err.message);
      }
    });
  });
}

// ============================================================
// 음식 태그 관리
// ============================================================
async function renderCategoriesTab() {
  els.tabCategories.innerHTML = `<p class="admin-empty">불러오는 중...</p>`;
  const customCategories = await fetchCustomCategories();

  const customRows = customCategories
    .map(
      (c) =>
        `<tr>
          <td>${c.icon || "🍽️"}</td>
          <td>${escapeHtml(c.label)}</td>
          <td>${escapeHtml(c.slug)}</td>
          <td><button class="btn btn--ghost" data-delete-category="${c.id}">삭제</button></td>
        </tr>`
    )
    .join("");

  els.tabCategories.innerHTML = `
    <p class="admin-section-title">새 음식 태그 추가</p>
    <form class="admin-form-row" id="category-form">
      <div class="field">
        <label class="field__label">아이콘 (이모지, 선택)</label>
        <input type="text" name="icon" placeholder="🍜" maxlength="4" style="width:70px;" />
      </div>
      <div class="field">
        <label class="field__label">slug (영문, 필터 저장값)</label>
        <input type="text" name="slug" placeholder="예) naengmyeon" required />
      </div>
      <div class="field">
        <label class="field__label">표시 이름</label>
        <input type="text" name="label" placeholder="예) 냉면" required />
      </div>
      <button type="submit" class="btn btn--primary">추가</button>
    </form>

    <p class="admin-section-title">직접 추가한 태그 목록</p>
    <table class="admin-table">
      <thead><tr><th>아이콘</th><th>표시 이름</th><th>slug</th><th></th></tr></thead>
      <tbody>${customRows || `<tr><td colspan="4" class="admin-empty">아직 추가한 태그가 없어요. 기본 태그(스시/라멘/야키니쿠 등)는 코드에 있어 여기 표시되지 않습니다.</td></tr>`}</tbody>
    </table>
  `;

  els.tabCategories.querySelector("#category-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await createCategory({
        slug: fd.get("slug").trim(),
        label: fd.get("label").trim(),
        icon: fd.get("icon").trim(),
      });
      renderCategoriesTab();
    } catch (err) {
      alert("추가 실패: " + err.message);
    }
  });

  els.tabCategories.querySelectorAll("[data-delete-category]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("이 태그를 삭제할까요?")) return;
      try {
        await deleteCategory(btn.dataset.deleteCategory);
        renderCategoriesTab();
      } catch (err) {
        alert("삭제 실패: " + err.message);
      }
    });
  });
}

// ============================================================
// 맛집 관리 (검색, 수정, 삭제)
// ============================================================
async function renderRestaurantsTab() {
  els.tabRestaurants.innerHTML = `<p class="admin-empty">불러오는 중...</p>`;
  restaurantsCache = await fetchAllRestaurants();
  renderRestaurantsList(restaurantsCache);
}

function renderRestaurantsList(list) {
  els.tabRestaurants.innerHTML = `
    <input type="search" id="restaurant-search" class="admin-search" placeholder="이름으로 검색" />
    <p class="admin-section-title">총 ${list.length}개</p>
    <table class="admin-table" id="restaurant-table">
      <thead><tr><th>이름</th><th>국가/지역</th><th>상태</th><th>외부 평점</th><th></th></tr></thead>
      <tbody>${list.map(restaurantRow).join("") || `<tr><td colspan="5" class="admin-empty">맛집이 없습니다.</td></tr>`}</tbody>
    </table>
  `;

  els.tabRestaurants.querySelector("#restaurant-search").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    const filtered = restaurantsCache.filter((r) => r.name?.toLowerCase().includes(q));
    document.querySelector("#restaurant-table tbody").innerHTML =
      filtered.map(restaurantRow).join("") || `<tr><td colspan="5" class="admin-empty">검색 결과가 없습니다.</td></tr>`;
    wireRestaurantRowButtons();
  });

  wireRestaurantRowButtons();
}

function restaurantRow(r) {
  const status = STATUS_META[r.status] || STATUS_META.want;
  return `
    <tr data-row-id="${r.id}">
      <td>${escapeHtml(r.name)}</td>
      <td>${COUNTRY_META[r.country]?.flag || r.country} ${escapeHtml(REGION_LABELS[r.region] || r.region || "")}</td>
      <td>${status.icon} ${status.label}</td>
      <td>${r.external?.rating ? `⭐ ${r.external.rating}` : "-"}</td>
      <td style="display:flex;gap:6px;">
        <button class="btn btn--ghost" data-edit="${r.id}">수정</button>
        <button class="btn btn--ghost" data-delete="${r.id}">삭제</button>
      </td>
    </tr>
  `;
}

function wireRestaurantRowButtons() {
  document.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => toggleEditRow(btn.dataset.edit));
  });
  document.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const r = restaurantsCache.find((x) => x.id === btn.dataset.delete);
      if (!confirm(`"${r?.name}"을(를) 삭제할까요? 되돌릴 수 없습니다.`)) return;
      try {
        await deleteRestaurant(btn.dataset.delete);
        restaurantsCache = restaurantsCache.filter((x) => x.id !== btn.dataset.delete);
        renderRestaurantsList(restaurantsCache);
      } catch (err) {
        alert("삭제 실패: " + err.message);
      }
    });
  });
}

function toggleEditRow(id) {
  const existing = document.querySelector(`tr[data-edit-row="${id}"]`);
  if (existing) {
    existing.remove();
    return;
  }
  document.querySelectorAll("tr[data-edit-row]").forEach((el) => el.remove());

  const r = restaurantsCache.find((x) => x.id === id);
  if (!r) return;

  const row = document.createElement("tr");
  row.dataset.editRow = id;
  row.className = "admin-edit-row";
  row.innerHTML = `
    <td colspan="5">
      <div class="admin-edit-grid">
        <div class="field"><label class="field__label">이름</label><input type="text" name="name" value="${escapeAttr(r.name)}" /></div>
        <div class="field"><label class="field__label">국가</label>
          <select name="country"><option value="KR" ${r.country === "KR" ? "selected" : ""}>한국</option><option value="JP" ${r.country === "JP" ? "selected" : ""}>일본</option></select>
        </div>
        <div class="field"><label class="field__label">지역(slug)</label><input type="text" name="region" value="${escapeAttr(r.region)}" /></div>
        <div class="field"><label class="field__label">동네/구</label><input type="text" name="district" value="${escapeAttr(r.district || "")}" /></div>
        <div class="field"><label class="field__label">위도</label><input type="text" name="latitude" value="${r.latitude}" /></div>
        <div class="field"><label class="field__label">경도</label><input type="text" name="longitude" value="${r.longitude}" /></div>
        <div class="field"><label class="field__label">상태</label>
          <select name="status">
            <option value="want" ${r.status === "want" ? "selected" : ""}>가고싶은</option>
            <option value="visited" ${r.status === "visited" ? "selected" : ""}>가본곳</option>
            <option value="avoid" ${r.status === "avoid" ? "selected" : ""}>피할곳</option>
          </select>
        </div>
        <div class="field"><label class="field__label">카테고리(쉼표구분)</label><input type="text" name="categories" value="${escapeAttr((r.categories || []).join(", "))}" /></div>
        <div class="field"><label class="field__label">외부 provider</label>
          <select name="provider"><option value="naver" ${r.external?.provider === "naver" ? "selected" : ""}>네이버</option><option value="google" ${r.external?.provider === "google" ? "selected" : ""}>구글</option></select>
        </div>
        <div class="field"><label class="field__label">외부 평점</label><input type="number" step="0.1" name="rating" value="${r.external?.rating ?? ""}" /></div>
        <div class="field"><label class="field__label">외부 리뷰수</label><input type="number" name="ratingCount" value="${r.external?.ratingCount ?? ""}" /></div>
        <div class="field" style="grid-column:1/-1;"><label class="field__label">주소</label><input type="text" name="address" value="${escapeAttr(r.address || "")}" /></div>
        <div class="field" style="grid-column:1/-1;"><label class="field__label">외부 링크</label><input type="url" name="url" value="${escapeAttr(r.external?.url || "")}" /></div>
        <div class="field" style="grid-column:1/-1;"><label class="field__label">영업시간 (줄바꿈으로 여러 개)</label><textarea name="openingHours" rows="2">${escapeHtml((r.openingHours || []).join("\n"))}</textarea></div>
        <div class="field" style="grid-column:1/-1;"><label class="field__label">메모</label><textarea name="memo" rows="2">${escapeHtml(r.my?.memo || "")}</textarea></div>
      </div>
      <div class="admin-edit-actions">
        <button class="btn btn--primary" data-save="${id}">저장</button>
        <button class="btn btn--ghost" data-cancel="${id}">취소</button>
      </div>
    </td>
  `;

  document.querySelector(`tr[data-row-id="${id}"]`).after(row);

  row.querySelector(`[data-cancel="${id}"]`).addEventListener("click", () => row.remove());
  row.querySelector(`[data-save="${id}"]`).addEventListener("click", async () => {
    const inputs = row.querySelectorAll("[name]");
    const get = (name) => [...inputs].find((el) => el.name === name)?.value ?? "";

    const payload = {
      name: get("name").trim(),
      country: get("country"),
      region: get("region").trim(),
      district: get("district").trim(),
      latitude: parseFloat(get("latitude")),
      longitude: parseFloat(get("longitude")),
      status: get("status"),
      categories: get("categories").split(",").map((s) => s.trim()).filter(Boolean),
      address: get("address").trim(),
      openingHours: get("openingHours").split("\n").map((s) => s.trim()).filter(Boolean),
      "external.provider": get("provider"),
      "external.rating": get("rating") ? parseFloat(get("rating")) : null,
      "external.ratingCount": get("ratingCount") ? parseInt(get("ratingCount"), 10) : null,
      "external.url": get("url").trim(),
      "my.memo": get("memo").trim(),
    };

    try {
      await updateRestaurant(id, payload);
      Object.assign(r, {
        ...payload,
        external: { ...r.external, provider: payload["external.provider"], rating: payload["external.rating"], ratingCount: payload["external.ratingCount"], url: payload["external.url"] },
        my: { ...r.my, memo: payload["my.memo"] },
      });
      row.remove();
      renderRestaurantsList(restaurantsCache);
    } catch (err) {
      alert("저장 실패: " + err.message);
    }
  });
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(str) {
  return escapeHtml(str);
}

main();
