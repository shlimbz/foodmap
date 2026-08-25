// firebase-config.js
//
// Firebase 프로젝트 콘솔(https://console.firebase.google.com) 에서
// "프로젝트 설정 > 일반 > 내 앱 > SDK 설정 및 구성"에서 복사한 값을
// 아래 firebaseConfig 객체에 그대로 붙여넣으세요.
//
// 주의: 이 값들(apiKey 포함)은 "비밀키"가 아닙니다.
// Firebase Web SDK config는 원래 프론트엔드 코드에 노출되는 것이 정상이며,
// GitHub Pages처럼 완전히 공개된 정적 호스팅에 올라가도 괜찮습니다.
// 실제 데이터 보호는 이 config가 아니라
// Firestore Security Rules(firestore.rules)와 Firebase Authentication이 담당합니다.
// 반드시 firestore.rules를 배포한 뒤에 이 앱을 공개하세요.

export const firebaseConfig = {
  apiKey: "AIzaSyDTlxawFKKn-4kDaNr4GojvcBsp55_798o",
  authDomain: "mapdb-40646.firebaseapp.com",
  projectId: "mapdb-40646",
  storageBucket: "mapdb-40646.firebasestorage.app",
  messagingSenderId: "913340661906",
  appId: "1:913340661906:web:254d1cc2dec4c66150264b"
};

// 앱 전역에서 사용할 Firestore 컬렉션 이름을 한 곳에 모아둡니다.
// 나중에 컬렉션 구조가 바뀌어도 이 파일만 수정하면 됩니다.
export const COLLECTIONS = {
  restaurants: "restaurants",
  myRatings: "myRatings", // STEP 11(Authentication) 이후, 사용자별 개인 평가/메모를 분리 저장할 때 사용
};
