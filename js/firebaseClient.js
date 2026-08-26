// js/firebaseClient.js
// Firestore 인스턴스를 한 번만 초기화해서 앱 전체(조회 + 등록 폼)가 공유한다.

import { firebaseConfig } from "../firebase-config.js";

let dbPromise = null;
let authPromise = null;

export function isFirebaseConfigured() {
  return Boolean(firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_"));
}

/** @returns {Promise<import("firebase/firestore").Firestore | null>} */
export function getDb() {
  if (!isFirebaseConfigured()) return Promise.resolve(null);

  if (!dbPromise) {
    dbPromise = (async () => {
      const { initializeApp, getApps } = await import(
        "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"
      );
      const { getFirestore } = await import(
        "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"
      );
      const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
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

/**
 * 관리자 페이지(admin.html) 로그인에 쓰는 Firebase Auth 인스턴스.
 * 일반 사용자용 앱(app.js)은 이 함수를 쓰지 않는다 — 로그인 없이도 열람/등록 가능.
 * @returns {Promise<import("firebase/auth").Auth | null>}
 */
export function getAuth() {
  if (!isFirebaseConfigured()) return Promise.resolve(null);

  if (!authPromise) {
    authPromise = (async () => {
      const { initializeApp, getApps } = await import(
        "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"
      );
      const { getAuth: getAuthSdk } = await import(
        "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"
      );
      const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
      return getAuthSdk(app);
    })().catch((err) => {
      console.error("Firebase Auth 초기화 실패:", err);
      authPromise = null;
      return null;
    });
  }
  return authPromise;
}

/** Firebase Auth 함수(signInWithEmailAndPassword 등)를 CDN에서 가져온다. */
export async function getAuthFns() {
  return import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
}
