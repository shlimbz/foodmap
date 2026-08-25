// js/firebaseClient.js
// Firestore 인스턴스를 한 번만 초기화해서 앱 전체(조회 + 등록 폼)가 공유한다.

import { firebaseConfig } from "../firebase-config.js";

let dbPromise = null;

export function isFirebaseConfigured() {
  return Boolean(firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_"));
}

/** @returns {Promise<import("firebase/firestore").Firestore | null>} */
export function getDb() {
  if (!isFirebaseConfigured()) return Promise.resolve(null);

  if (!dbPromise) {
    dbPromise = (async () => {
      const { initializeApp } = await import(
        "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"
      );
      const { getFirestore } = await import(
        "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"
      );
      const app = initializeApp(firebaseConfig);
      return getFirestore(app);
    })().catch((err) => {
      console.error("Firebase 초기화 실패:", err);
      dbPromise = null;
      return null;
    });
  }
  return dbPromise;
}

/** Firestore 함수(collection, addDoc 등)는 매번 CDN에서 가져오되, 모듈 캐시 덕분에 실제 네트워크 요청은 1회만 발생한다. */
export async function getFirestoreFns() {
  return import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
}
