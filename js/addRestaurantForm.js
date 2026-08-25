// js/addRestaurantForm.js
// "맛집 등록" 패널의 폼 UI와 제출 로직.
// app.js에서 initAddRestaurantForm(...)로 한 번 초기화하고, open()/close()만 호출한다.

import { CATEGORY_META, DAY_META, REGIONS_BY_COUNTRY, REGION_LABELS, NAV_PROVIDER_BY_COUNTRY } from "./constants.js";
import { createRestaurant } from "./restaurantWrite.js";
import { geocodeAddress } from "./geocode.js";

export function initAddRestaurantForm({ els, mapProvider, onCreated, showToast }) {
  let picking = false;
  let hoursEntries = []; // "월,화 11:00-21:00" 형식의 문자열 배열

  renderForm();

  els.addRestaurantBtn.addEventListener("click", open);
  els.addPanelClose.addEventListener("click", close);
  els.addPanelBackdrop.addEventListener("click", close);
  els.pickingBanner.addEventListener("click", cancelPicking);

  mapProvider.onMapClick(({ lat, lng }) => {
    if (!picking) return;
    mapProvider.setPickerMarker(lat, lng);
    stopPickingUI();
    els.addForm.querySelector('[name="latitude"]').value = lat.toFixed(6);
    els.addForm.querySelector('[name="longitude"]').value = lng.toFixed(6);
  });

  function open() {
    els.addPanel.hidden = false;
    els.addPanelBackdrop.hidden = window.innerWidth > 860;
  }

  function close() {
    els.addPanel.hidden = true;
    els.addPanelBackdrop.hidden = true;
    cancelPicking();
  }

  function startPicking() {
    picking = true;
    els.addPanel.hidden = true;
    els.addPanelBackdrop.hidden = true;
    els.pickingBanner.hidden = false;
  }

  function stopPickingUI() {
    picking = false;
    els.pickingBanner.hidden = true;
    els.addPanel.hidden = false;
    els.addPanelBackdrop.hidden = window.innerWidth > 860;
  }

  function cancelPicking() {
    if (!picking) return;
    stopPickingUI();
  }

  function renderForm() {
    const categoryChips = Object.entries(CATEGORY_META)
      .filter(([key]) => key !== "etc")
      .map(([key, meta]) => `<button type="button" class="chip-option" data-value="${key}">${meta.icon} ${meta.label}</button>`)
      .join("");

    const dayChips = DAY_META.map(
      (d) => `<button type="button" class="chip-option day-chip" data-value="${d.key}">${d.label}</button>`
    ).join("");

    els.addForm.innerHTML = `
      <div class="field">
        <label class="field__label">가게 이름 <span class="required">*</span></label>
        <input type="text" name="name" required placeholder="예) 스시 사카바 사시스" />
      </div>

      <div class="field__row">
        <div class="field">
          <label class="field__label">국가 <span class="required">*</span></label>
          <select name="country">
            <option value="KR">🇰🇷 한국</option>
            <option value="JP">🇯🇵 일본</option>
          </select>
        </div>
        <div class="field">
          <label class="field__label">지역</label>
          <select name="region" id="region-select"></select>
        </div>
      </div>

      <div class="field" id="custom-region-field" hidden>
        <label class="field__label">지역 직접 입력</label>
        <input type="text" name="customRegion" placeholder="목록에 없는 지역명을 입력하세요" />
      </div>

      <div class="field__row">
        <div class="field">
          <label class="field__label">동네 / 구</label>
          <input type="text" name="district" placeholder="예) Umeda, 성수동" />
        </div>
      </div>

      <div class="field">
        <label class="field__label">주소</label>
        <div class="geocode-row">
          <input type="text" name="address" placeholder="예) 서울 마포구 합정동 123-4" />
          <button type="button" id="geocode-btn" class="geocode-btn">📍 주소로 좌표 찾기</button>
        </div>
        <p class="geocode-hint">OpenStreetMap 기반으로 대략적인 좌표를 찾아줘요. 정확도가 걱정되면 아래 "지도에서 위치 선택"으로 확인/보정하세요.</p>
      </div>

      <div class="field">
        <label class="field__label">위치 좌표 <span class="required">*</span></label>
        <div class="field__row">
          <input type="text" name="latitude" inputmode="decimal" placeholder="위도 (예: 37.5665)" required />
          <input type="text" name="longitude" inputmode="decimal" placeholder="경도 (예: 126.9780)" required />
        </div>
        <button type="button" id="pick-location-btn" class="pick-location-btn">📍 지도에서 위치 선택</button>
      </div>

      <div class="field">
        <label class="field__label">상태</label>
        <div class="chip-select chip-select--status" data-name="status">
          <button type="button" class="chip-option is-on" data-value="want">🟡 가고싶은</button>
          <button type="button" class="chip-option" data-value="visited">🟢 가본곳</button>
          <button type="button" class="chip-option" data-value="avoid">🔴 피할곳</button>
        </div>
      </div>

      <div class="field">
        <label class="field__label">음식 종류 (여러 개 선택 가능)</label>
        <div class="chip-select" data-name="categories">${categoryChips}</div>
        <input type="text" name="customCategories" placeholder="목록에 없다면 쉼표로 직접 입력 (예: 냉면, 브런치)" />
      </div>

      <div class="field">
        <label class="field__label">외부 평점</label>
        <div class="field__row">
          <select name="provider">
            <option value="naver">네이버</option>
            <option value="google">구글</option>
          </select>
          <input type="number" name="externalRating" step="0.1" min="0" max="5" placeholder="평점 (예: 4.5)" />
          <input type="number" name="externalRatingCount" min="0" placeholder="리뷰 수" />
        </div>
        <input type="url" name="externalUrl" placeholder="원본 지도 링크 (선택)" />
      </div>

      <div class="field">
        <label class="field__label">영업시간</label>
        <div class="chip-select" data-name="days">${dayChips}</div>
        <div class="field__row">
          <input type="time" name="openTime" value="11:00" />
          <input type="time" name="closeTime" value="21:00" />
          <button type="button" id="add-hours-btn" class="btn btn--ghost" style="flex:none;padding:9px 14px;">추가</button>
        </div>
        <div class="hours-list" id="hours-list"></div>
      </div>

      <div class="field">
        <label class="field__label">메모</label>
        <textarea name="memo" placeholder="선택 입력"></textarea>
      </div>

      <p class="add-form__error" id="add-form-error" hidden></p>
      <button type="submit" class="btn btn--primary add-form__submit">맛집 등록</button>
    `;

    renderRegionSelect("KR");

    // 국가 바꾸면 지역 목록 + 외부 평점 provider 기본값도 맞춰준다
    els.addForm.querySelector('[name="country"]').addEventListener("change", (e) => {
      els.addForm.querySelector('[name="provider"]').value = NAV_PROVIDER_BY_COUNTRY[e.target.value] || "google";
      renderRegionSelect(e.target.value);
    });
    els.addForm.querySelector('[name="provider"]').value = NAV_PROVIDER_BY_COUNTRY.KR;

    els.addForm.querySelector("#region-select").addEventListener("change", (e) => {
      els.addForm.querySelector("#custom-region-field").hidden = e.target.value !== "etc";
    });

    els.addForm.querySelector("#geocode-btn").addEventListener("click", handleGeocode);

    // chip-select 토글 (단일: status / 다중: categories, days)
    els.addForm.querySelectorAll(".chip-select").forEach((group) => {
      const isSingle = group.dataset.name === "status";
      group.addEventListener("click", (e) => {
        const btn = e.target.closest(".chip-option");
        if (!btn) return;
        if (isSingle) {
          group.querySelectorAll(".chip-option").forEach((b) => b.classList.toggle("is-on", b === btn));
        } else {
          btn.classList.toggle("is-on");
        }
      });
    });

    els.addForm.querySelector("#pick-location-btn").addEventListener("click", startPicking);

    els.addForm.querySelector("#add-hours-btn").addEventListener("click", () => {
      const selectedDays = [...els.addForm.querySelectorAll('.chip-select[data-name="days"] .chip-option.is-on')].map(
        (b) => b.dataset.value
      );
      const openTime = els.addForm.querySelector('[name="openTime"]').value;
      const closeTime = els.addForm.querySelector('[name="closeTime"]').value;
      if (selectedDays.length === 0 || !openTime || !closeTime) return;

      const dayLabels = DAY_META.filter((d) => selectedDays.includes(d.key)).map((d) => d.label).join(",");
      hoursEntries.push(`${dayLabels} ${openTime}-${closeTime}`);
      renderHoursList();
    });

    els.addForm.addEventListener("submit", handleSubmit);
    renderHoursList();
  }

  // 국가에 맞는 지역만 select 옵션으로 보여준다 (한국 고르면 한국 지역만, 등)
  function renderRegionSelect(country) {
    const select = els.addForm.querySelector("#region-select");
    const regions = REGIONS_BY_COUNTRY[country] || [];
    select.innerHTML = regions
      .map((r) => `<option value="${r}">${r === "etc" ? "기타 (직접입력)" : REGION_LABELS[r] || r}</option>`)
      .join("");
    els.addForm.querySelector("#custom-region-field").hidden = true;
  }

  async function handleGeocode() {
    const addressInput = els.addForm.querySelector('[name="address"]');
    const btn = els.addForm.querySelector("#geocode-btn");
    const address = addressInput.value.trim();
    if (!address) {
      addressInput.focus();
      return;
    }
    btn.disabled = true;
    btn.textContent = "찾는 중...";
    try {
      const { lat, lng } = await geocodeAddress(address);
      els.addForm.querySelector('[name="latitude"]').value = lat.toFixed(6);
      els.addForm.querySelector('[name="longitude"]').value = lng.toFixed(6);
      mapProvider.setPickerMarker(lat, lng);
      mapProvider.focusOn(lat, lng, 16);
      showToast("좌표를 찾았어요. 지도에서 위치가 맞는지 확인해보세요.", 3000);
    } catch (err) {
      console.warn(err);
      showToast("좌표를 찾지 못했어요. 주소를 더 구체적으로 입력하거나 지도에서 직접 선택해주세요.", 4000);
    } finally {
      btn.disabled = false;
      btn.textContent = "📍 주소로 좌표 찾기";
    }
  }

  function renderHoursList() {
    const list = els.addForm.querySelector("#hours-list");
    list.innerHTML = hoursEntries
      .map(
        (entry, i) =>
          `<div class="hours-list__item"><span>${entry}</span><button type="button" class="hours-list__remove" data-index="${i}">삭제</button></div>`
      )
      .join("");
    list.querySelectorAll(".hours-list__remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        hoursEntries.splice(Number(btn.dataset.index), 1);
        renderHoursList();
      });
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errorEl = els.addForm.querySelector("#add-form-error");
    errorEl.hidden = true;

    const fd = new FormData(els.addForm);
    const name = fd.get("name")?.trim();
    const latitude = parseFloat(fd.get("latitude"));
    const longitude = parseFloat(fd.get("longitude"));

    const selectedCategories = [
      ...els.addForm.querySelectorAll('.chip-select[data-name="categories"] .chip-option.is-on'),
    ].map((b) => b.dataset.value);
    const customCategories = (fd.get("customCategories") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const categories = [...selectedCategories, ...customCategories];

    const status = els.addForm.querySelector(".chip-select--status .chip-option.is-on")?.dataset.value || "want";

    if (!name || Number.isNaN(latitude) || Number.isNaN(longitude) || categories.length === 0) {
      errorEl.textContent = "가게 이름, 위치 좌표, 음식 종류는 최소 1개 이상 입력해주세요.";
      errorEl.hidden = false;
      return;
    }

    const submitBtn = els.addForm.querySelector(".add-form__submit");
    submitBtn.disabled = true;
    submitBtn.textContent = "등록 중...";

    const externalRating = fd.get("externalRating") ? parseFloat(fd.get("externalRating")) : null;
    const externalRatingCount = fd.get("externalRatingCount") ? parseInt(fd.get("externalRatingCount"), 10) : null;

    const data = {
      name,
      country: fd.get("country"),
      region: fd.get("region") === "etc" ? fd.get("customRegion")?.trim() || "etc" : fd.get("region"),
      district: fd.get("district")?.trim() || "",
      address: fd.get("address")?.trim() || "",
      latitude,
      longitude,
      categories,
      status,
      external: {
        provider: fd.get("provider"),
        rating: externalRating,
        ratingCount: externalRatingCount,
        url: fd.get("externalUrl")?.trim() || "",
      },
      openingHours: hoursEntries,
      my: { memo: fd.get("memo")?.trim() || "" },
    };

    try {
      const id = await createRestaurant(data);
      onCreated({
        id,
        ...data,
        my: { ratingSum: 0, ratingCount: 0, memo: data.my.memo },
      });
      showToast(`"${name}" 등록 완료!`, 3000);
      resetForm();
      close();
    } catch (err) {
      console.error(err);
      errorEl.textContent = "등록에 실패했어요. Firebase 연동 상태와 firestore.rules를 확인해주세요.";
      errorEl.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "맛집 등록";
    }
  }

  function resetForm() {
    els.addForm.reset();
    hoursEntries = [];
    renderHoursList();
    renderRegionSelect("KR");
    els.addForm.querySelectorAll(".chip-option.is-on").forEach((b) => b.classList.remove("is-on"));
    els.addForm.querySelector('.chip-select--status .chip-option[data-value="want"]').classList.add("is-on");
    mapProvider.clearPickerMarker();
  }

  return { open, close };
}
