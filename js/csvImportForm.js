// js/csvImportForm.js
// "CSV 일괄 등록" 패널: 템플릿 다운로드 → CSV 업로드/붙여넣기 → 미리보기 → 일괄 저장.

import { buildCsvTemplate, parseCsv, rowToRestaurant } from "./csvImport.js";
import { bulkCreateRestaurants } from "./restaurantWrite.js";

export function initCsvImportForm({ els, onImported, showToast }) {
  let parsedRows = []; // { data } 형태로 검증 통과한 행만

  render();

  els.csvImportBtn.addEventListener("click", open);
  els.csvPanelClose.addEventListener("click", close);
  els.csvPanelBackdrop.addEventListener("click", close);

  function open() {
    els.csvPanel.hidden = false;
    els.csvPanelBackdrop.hidden = window.innerWidth > 860;
  }
  function close() {
    els.csvPanel.hidden = true;
    els.csvPanelBackdrop.hidden = true;
  }

  function render() {
    els.csvPanelContent.innerHTML = `
      <p class="add-panel__title">📄 CSV로 맛집 일괄 등록</p>
      <p class="csv-help">
        Google/Naver에서 미리 조사한 맛집을 스프레드시트로 정리한 뒤, 아래 형식의
        CSV로 저장해서 올려주세요. <code>categories</code>와 <code>openingHours</code>는
        여러 값을 <code>|</code>(파이프)로 구분합니다. (예: <code>sushi|japanese</code>)
      </p>
      <button type="button" id="csv-download-template" class="btn btn--ghost" style="flex:none;">
        ⬇️ CSV 템플릿 다운로드
      </button>

      <div class="field" style="margin-top:14px;">
        <label class="field__label">CSV 파일 업로드</label>
        <input type="file" id="csv-file-input" accept=".csv,text/csv" />
      </div>

      <div class="field">
        <label class="field__label">또는 CSV 내용 붙여넣기</label>
        <textarea id="csv-paste-input" rows="6" placeholder="name,country,region,...&#10;스시 사카바 사시스,JP,Osaka,..."></textarea>
      </div>

      <button type="button" id="csv-preview-btn" class="btn btn--ghost">미리보기</button>

      <div id="csv-preview-result" class="csv-preview" hidden></div>

      <button type="button" id="csv-submit-btn" class="btn btn--primary" disabled style="margin-top:10px;">
        일괄 등록
      </button>
      <div id="csv-progress" class="csv-progress" hidden></div>
    `;

    els.csvPanelContent.querySelector("#csv-download-template").addEventListener("click", downloadTemplate);
    els.csvPanelContent.querySelector("#csv-file-input").addEventListener("change", handleFile);
    els.csvPanelContent.querySelector("#csv-preview-btn").addEventListener("click", handlePreview);
    els.csvPanelContent.querySelector("#csv-submit-btn").addEventListener("click", handleSubmit);
  }

  function downloadTemplate() {
    const blob = new Blob([buildCsvTemplate()], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "matjip-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      els.csvPanelContent.querySelector("#csv-paste-input").value = reader.result;
    };
    reader.readAsText(file, "utf-8");
  }

  function handlePreview() {
    const text = els.csvPanelContent.querySelector("#csv-paste-input").value;
    const resultEl = els.csvPanelContent.querySelector("#csv-preview-result");
    const submitBtn = els.csvPanelContent.querySelector("#csv-submit-btn");

    if (!text.trim()) {
      resultEl.hidden = true;
      submitBtn.disabled = true;
      return;
    }

    const rawRows = parseCsv(text);
    const results = rawRows.map((raw, i) => rowToRestaurant(raw, i + 2)); // +2: 헤더줄 + 1-indexed
    const valid = results.filter((r) => r.data).map((r) => r.data);
    const errors = results.filter((r) => r.error).map((r) => r.error);
    parsedRows = valid;

    resultEl.hidden = false;
    resultEl.innerHTML = `
      <p><strong>${valid.length}건</strong> 등록 가능 ${errors.length ? `/ <strong style="color:var(--status-avoid)">${errors.length}건 오류</strong>` : ""}</p>
      ${
        valid.length
          ? `<ul class="csv-preview__list">${valid
              .slice(0, 5)
              .map((r) => `<li>${escapeHtml(r.name)} — ${r.country} / ${escapeHtml(r.region)}</li>`)
              .join("")}${valid.length > 5 ? `<li>...외 ${valid.length - 5}건</li>` : ""}</ul>`
          : ""
      }
      ${
        errors.length
          ? `<ul class="csv-preview__errors">${errors
              .slice(0, 10)
              .map((e) => `<li>⚠️ ${escapeHtml(e)}</li>`)
              .join("")}</ul>`
          : ""
      }
    `;

    submitBtn.disabled = valid.length === 0;
  }

  async function handleSubmit() {
    if (parsedRows.length === 0) return;
    const submitBtn = els.csvPanelContent.querySelector("#csv-submit-btn");
    const progressEl = els.csvPanelContent.querySelector("#csv-progress");
    submitBtn.disabled = true;
    progressEl.hidden = false;
    progressEl.textContent = `등록 중... 0 / ${parsedRows.length}`;

    try {
      const { successCount, failedRows } = await bulkCreateRestaurants(parsedRows, (done, total) => {
        progressEl.textContent = `등록 중... ${done} / ${total}`;
      });

      progressEl.textContent = `완료: ${successCount}건 등록${failedRows.length ? `, ${failedRows.length}건 실패` : ""}`;
      showToast(`CSV 일괄 등록 완료: ${successCount}건`, 4000);
      onImported(successCount);
    } catch (err) {
      console.error(err);
      progressEl.textContent = "등록에 실패했어요. Firebase 연동/규칙을 확인해주세요.";
    } finally {
      submitBtn.disabled = false;
    }
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

  return { open, close };
}
