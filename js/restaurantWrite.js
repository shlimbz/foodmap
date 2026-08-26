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
 * CSV 등에서 만든 restaurant 데이터 여러 건을 한 번에 등록한다.
 * Firestore 배치 쓰기는 500건 제한이 있어 내부적으로 청크로 나눠 처리한다.
 * @param {object[]} rows
 * @param {(done: number, total: number) => void} [onProgress]
 * @returns {Promise<{successCount: number, failedRows: {row: object, error: string}[]}>}
 */
export async function bulkCreateRestaurants(rows, onProgress) {
  const db = await getDb();
  if (!db) throw new Error("firestore-not-configured");

  const { collection, doc, writeBatch } = await getFirestoreFns();
  const CHUNK_SIZE = 400; // Firestore 배치 한도(500)보다 여유 있게
  let successCount = 0;
  const failedRows = [];
  const now = new Date().toISOString();

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    chunk.forEach((row) => {
      try {
        const ref = doc(collection(db, COLLECTIONS.restaurants));
        batch.set(ref, {
          ...row,
          my: { ratingSum: 0, ratingCount: 0, memo: row.my?.memo || "" },
          createdAt: now,
          updatedAt: now,
        });
      } catch (err) {
        failedRows.push({ row, error: String(err) });
      }
    });

    try {
      await batch.commit();
      successCount += chunk.length;
    } catch (err) {
      chunk.forEach((row) => failedRows.push({ row, error: String(err) }));
    }

    onProgress?.(Math.min(i + CHUNK_SIZE, rows.length), rows.length);
  }

  return { successCount, failedRows };
}

/** 관리자 페이지 전용: restaurants 컬렉션 전체 조회 */
export async function fetchAllRestaurants() {
  const db = await getDb();
  if (!db) return [];
  const { collection, getDocs } = await getFirestoreFns();
  const snap = await getDocs(collection(db, COLLECTIONS.restaurants));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * 관리자 페이지 전용: 맛집 문서를 통째로 수정한다 (이름/좌표/상태 등).
 * my.ratingSum/ratingCount(사용자들이 남긴 평점)는 건드리지 않는다.
 */
export async function updateRestaurant(id, data) {
  const db = await getDb();
  if (!db) throw new Error("firestore-not-configured");
  const { doc, updateDoc } = await getFirestoreFns();
  await updateDoc(doc(db, COLLECTIONS.restaurants, id), {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

/** 관리자 페이지 전용: 맛집 삭제 (테스트 데이터 정리 등) */
export async function deleteRestaurant(id) {
  const db = await getDb();
  if (!db) throw new Error("firestore-not-configured");
  const { doc, deleteDoc } = await getFirestoreFns();
  await deleteDoc(doc(db, COLLECTIONS.restaurants, id));
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
