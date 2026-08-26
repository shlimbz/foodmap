// js/taxonomyWrite.js
// 커스텀 지역(regions) / 음식 태그(categories) 컬렉션에 대한 Firestore CRUD.
// 조회(read)는 앱의 모든 사용자가 하고, 추가/삭제(write)는 firestore.rules상
// 로그인(관리자)한 경우에만 허용된다 — admin.html에서만 쓰는 함수들이다.

import { COLLECTIONS } from "../firebase-config.js";
import { getDb, getFirestoreFns } from "./firebaseClient.js";

async function fetchCollection(name) {
  const db = await getDb();
  if (!db) return [];
  const { collection, getDocs } = await getFirestoreFns();
  const snap = await getDocs(collection(db, name));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function fetchCustomRegions() {
  return fetchCollection(COLLECTIONS.regions);
}
export function fetchCustomCategories() {
  return fetchCollection(COLLECTIONS.categories);
}

export async function createRegion({ country, slug, label }) {
  const db = await getDb();
  if (!db) throw new Error("firestore-not-configured");
  const { collection, doc, setDoc } = await getFirestoreFns();
  const ref = doc(collection(db, COLLECTIONS.regions));
  await setDoc(ref, { country, slug, label, createdAt: new Date().toISOString() });
  return ref.id;
}

export async function deleteRegion(id) {
  const db = await getDb();
  if (!db) throw new Error("firestore-not-configured");
  const { doc, deleteDoc } = await getFirestoreFns();
  await deleteDoc(doc(db, COLLECTIONS.regions, id));
}

export async function createCategory({ slug, label, icon }) {
  const db = await getDb();
  if (!db) throw new Error("firestore-not-configured");
  const { collection, doc, setDoc } = await getFirestoreFns();
  const ref = doc(collection(db, COLLECTIONS.categories));
  await setDoc(ref, { slug, label, icon: icon || "🍽️", createdAt: new Date().toISOString() });
  return ref.id;
}

export async function deleteCategory(id) {
  const db = await getDb();
  if (!db) throw new Error("firestore-not-configured");
  const { doc, deleteDoc } = await getFirestoreFns();
  await deleteDoc(doc(db, COLLECTIONS.categories, id));
}
