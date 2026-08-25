// js/restaurantWrite.js
// 웹앱에서 직접 Firestore에 쓰는 두 가지 동작:
//   1) createRestaurant()  — 새 맛집 등록
//   2) submitRating()      — "우리 평가" 평균에 반영될 평점 1건 추가
//
// 평점은 여러 사람이 매길 수 있고 평균으로 보여주기 위해,
// 개별 평점 값을 저장하는 대신 restaurants/{id}.my.ratingSum / ratingCount를
// Firestore의 increment()로 원자적으로 누적한다. (동시에 여러 명이 눌러도 안전)
//
// ⚠️ 보안 참고: 이 프로젝트는 Firebase Authentication을 쓰지 않는 개인용 MVP라
// firestore.rules에서 "누구나 새 맛집을 추가/평점을 남길 수 있음"으로 열어뒀다.
// 링크만 알면 제3자도 데이터를 쓸 수 있으니, 여러 사람과 공유하게 되면
// README의 "다음 단계: Authentication 도입"을 참고해 잠그는 것을 권장한다.

import { COLLECTIONS } from "../firebase-config.js";
import { getDb, getFirestoreFns } from "./firebaseClient.js";

/**
 * @param {object} data - id/createdAt/updatedAt을 제외한 restaurant 필드
 * @returns {Promise<string>} 생성된 문서 id
 */
export async function createRestaurant(data) {
  const db = await getDb();
  if (!db) throw new Error("firestore-not-configured");

  const { collection, doc, setDoc } = await getFirestoreFns();
  const ref = doc(collection(db, COLLECTIONS.restaurants));
  const now = new Date().toISOString();

  await setDoc(ref, {
    ...data,
    my: { ratingSum: 0, ratingCount: 0, memo: data.my?.memo || "" },
    createdAt: now,
    updatedAt: now,
  });

  return ref.id;
}

/**
 * @param {string} restaurantId
 * @param {number} ratingValue - 1~5
 */
export async function submitRating(restaurantId, ratingValue) {
  const db = await getDb();
  if (!db) throw new Error("firestore-not-configured");

  const { doc, updateDoc, increment } = await getFirestoreFns();
  const ref = doc(db, COLLECTIONS.restaurants, restaurantId);

  await updateDoc(ref, {
    "my.ratingSum": increment(ratingValue),
    "my.ratingCount": increment(1),
    updatedAt: new Date().toISOString(),
  });
}
