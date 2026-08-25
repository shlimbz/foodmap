# 미식장 — 개인 맛집 지도 (MVP)

한국·일본 맛집을 지도에서 관리하는 **개인용** 맛집 지도 웹앱입니다.
Google Maps나 Naver Maps를 대체하지 않으며, 맛집 정보는 직접 전처리해서
Firebase Firestore에 넣어둔 데이터를 지도에 보여주고 필터링·검색만 합니다.

- 서버 없음 — **정적 웹앱(GitHub Pages) + Firebase Firestore**만 사용
- 웹앱은 **Google/Naver Places API를 직접 호출하지 않습니다.**
- 지도 배경은 **Leaflet + OpenFreeMap**(OpenStreetMap 기반 벡터 타일)
- 길찾기는 버튼 클릭 시 **Google Maps / Naver Map으로 이동**만 시켜줄 뿐, 자체 경로 계산은 하지 않습니다.

---

## 1. 아키텍처

```
GitHub Pages (정적 파일)
│
├── index.html      화면 구조
├── style.css        스타일
├── app.js            앱 로직 (상태, 필터/검색, 지도↔리스트 연동)
├── firebase-config.js  Firebase 프로젝트 연결 설정
│
├── js/
│   ├── constants.js          카테고리/상태/지역 메타데이터
│   ├── geo.js                 거리 계산(Haversine) + Geolocation 래퍼
│   ├── directions.js          Google/Naver 길찾기 URL 생성
│   ├── testData.js            테스트용 맛집 12개 (Firestore 없이도 동작 확인 가능)
│   ├── mapProvider.js         🔑 지도 provider 추상 인터페이스
│   └── providers/
│       └── leafletOpenFreeMapProvider.js   Leaflet + OpenFreeMap 구현체
│
├── scripts/
│   └── seed-firestore.html   Firestore에 테스트 데이터를 밀어넣는 1회용 개발 도구
│
└── firestore.rules            Firestore 보안 규칙 (ADMIN/MEMBER 권한 분리)
```

### 데이터 흐름

```
Firestore(restaurants 컬렉션)
      ↓  (앱 최초 실행 시 1회 전체 조회)
JavaScript 메모리(state.restaurants)
      ↓
필터/검색 변경 시마다 → 클라이언트에서만 재계산 (Firestore 재조회 없음)
      ↓
지도 마커 갱신 + 리스트 갱신 (동시)
```

### 지도 provider 분리 (중요 설계 원칙)

`app.js`와 나머지 UI 코드는 **`js/mapProvider.js`가 정의한 인터페이스**만 알고,
Leaflet이나 OpenFreeMap이라는 이름 자체는 전혀 모릅니다.
실제 구현은 `js/providers/leafletOpenFreeMapProvider.js` 한 파일에만 들어 있습니다.

나중에 OpenFreeMap 정책이 바뀌거나 다른 타일 provider로 교체하고 싶다면:

1. `js/providers/`에 새 provider 파일을 만들고 동일한 인터페이스를 구현
2. `js/mapProvider.js`의 `PROVIDERS` 객체에 등록
3. `app.js`의 `createMapProvider("leaflet-openfreemap")` 문자열만 교체

Firebase 데이터 구조, 필터 로직, 리스트/상세 UI는 전혀 손댈 필요가 없습니다.

> OpenFreeMap은 XYZ 래스터 타일이 아니라 MapLibre 스타일(JSON) 기반 벡터 타일이라
> `L.tileLayer()`로 바로 붙지 않습니다. 공식 가이드(https://openfreemap.org/quick_start/)에
> 따라 `@maplibre/maplibre-gl-leaflet` 플러그인으로 MapLibre GL 레이어를 Leaflet 위에
> 얹는 방식을 사용했습니다 (`index.html`의 CDN 스크립트 3개 + provider 파일 참고).

---

## 2. 로컬에서 실행하기

ES 모듈(`type="module"`)을 쓰기 때문에 `file://`로 직접 열면 CORS 에러가 납니다.
간단한 정적 서버로 띄우세요.

```bash
cd matjip-map
python3 -m http.server 8080
# 또는
npx serve .
```

브라우저에서 `http://localhost:8080` 접속.

**Firebase를 아직 설정하지 않았다면?**
`firebase-config.js`의 값이 비어있으면(`YOUR_API_KEY` 그대로) 앱이 자동으로
`js/testData.js`의 테스트 데이터로 동작합니다. 지도/필터/검색/마커 연동을
Firebase 없이 바로 확인할 수 있습니다.

---

## 3. Firebase 초기 설정

### 3-1. Firebase 프로젝트 생성
[Firebase 콘솔](https://console.firebase.google.com)에서 새 프로젝트를 만듭니다.

### 3-2. Firestore 생성
콘솔 좌측 메뉴 → **Firestore Database** → 데이터베이스 만들기.
(요금제는 처음엔 Spark(무료) 플랜으로 충분합니다.)

### 3-3. Authentication 설정 (선택, STEP 11)
콘솔 → **Authentication** → 로그인 방법에서 원하는 방식(이메일/Google 등)을 활성화합니다.
MVP는 인증 없이도 동작하지만, 개인 평가/메모를 여러 기기에서 쓰고 싶다면 필요합니다.

### 3-4. Web App 등록
콘솔 → 프로젝트 설정(⚙️) → **내 앱 추가 → 웹(</>)** 선택 → 앱 닉네임 입력 →
"Firebase SDK 추가" 단계에서 나오는 `firebaseConfig` 객체를 복사합니다.

### 3-5. firebase-config.js에 값 입력
복사한 값을 프로젝트 루트의 `firebase-config.js`에 붙여넣습니다.

```js
export const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "...",
  appId: "...",
};
```

> ⚠️ 이 값들은 "비밀키"가 아닙니다. Firebase Web SDK config는 프론트엔드에
> 노출되는 것이 정상 구조이며, GitHub Pages처럼 공개된 곳에 올라가도 됩니다.
> **실제 데이터 보호는 아래 3-6의 Security Rules가 담당합니다.**

### 3-6. Firestore Security Rules 배포
`firestore.rules` 파일 내용을 Firestore 콘솔 → **규칙** 탭에 붙여넣고 게시하세요.
(또는 Firebase CLI: `firebase deploy --only firestore:rules`)

ADMIN 권한(맛집 데이터 추가/수정/삭제)을 부여하려면, 본인 계정의 UID에
Custom Claim `admin: true`를 설정해야 합니다 (Firebase Admin SDK, Node.js 예시):

```js
const admin = require("firebase-admin");
admin.initializeApp();
await admin.auth().setCustomUserClaims("본인의-UID", { admin: true });
```

### 3-7. restaurants 데이터 등록
두 가지 방법이 있습니다.

- **방법 A (테스트용, 빠름):** `scripts/seed-firestore.html`을 로컬 서버로 열고
  버튼을 눌러 `js/testData.js`의 12개 예시 데이터를 한 번에 등록합니다.
  (이 페이지는 개발용이므로 GitHub Pages에는 배포하지 마세요.)
- **방법 B (실제 운영):** Firestore 콘솔에서 `restaurants` 컬렉션에 문서를 직접
  추가하거나, Google/Naver에서 미리 조사한 정보를 본인이 정리한 스크립트로
  일괄 등록합니다. 문서 구조는 `js/testData.js`의 예시를 참고하세요.

---

## 4. GitHub Pages 배포

1. 이 폴더를 GitHub 저장소 루트(또는 `docs/` 폴더)에 푸시합니다.
2. 저장소 **Settings → Pages**에서 배포 브랜치/폴더를 지정합니다.
3. `firebase-config.js`를 실제 값으로 채운 뒤 커밋합니다 (3-5 참고).
4. Firestore Security Rules(3-6)를 반드시 배포한 뒤 공개하세요.

---

## 5. 데이터 구조

```jsonc
// restaurants/{docId}
{
  "name": "스시 사카바 사시스",
  "country": "JP",              // "KR" | "JP"
  "region": "Osaka",             // js/constants.js REGIONS 참고
  "district": "Umeda",
  "latitude": 34.7024,
  "longitude": 135.4959,
  "categories": ["sushi", "japanese"],
  "status": "want",              // "want" | "visited" | "avoid"

  "external": {                  // 내가 아닌, Google/Naver에서 가져온 정보
    "provider": "google",        // "google" | "naver" — 원본 지도 링크 구분용 (API 호출 X)
    "name": "Sushi Sakaba Sashisu",
    "rating": 4.6,
    "ratingCount": 1284,
    "url": "https://maps.google.com/..."
  },

  "my": {                        // 내가 직접 작성한 정보
    "rating": 4.5,
    "memo": "웨이팅이 길지만 가볼 가치 있음"
  },

  "openingHours": ["11:30-22:00"],
  "address": "大阪府大阪市...",
  "phone": "",
  "createdAt": "2026-08-25T00:00:00.000Z",
  "updatedAt": "2026-08-25T00:00:00.000Z"
}
```

`external`(외부 정보)과 `my`(내 정보)를 의도적으로 분리했습니다.

---

## 6. MVP에 포함하지 않은 것

의도적으로 제외한 기능입니다 (필요 시 별도로 확장):

- Google/Naver Places API 호출, 맛집 자동 검색, 웹 크롤링
- 자체 길찾기 알고리즘 / 자체 지도 타일 서버
- 복잡한 백엔드, 관리자 CMS
- Firestore에 쓰는 UI(개인 평가/메모 편집 화면) — 현재는 Firestore 콘솔이나
  스크립트로 직접 등록/수정하는 구조이며, 로그인 기반 편집 UI는 STEP 11
  Authentication 이후의 확장 과제로 남겨두었습니다.

---

## 7. 구현 순서 체크리스트

- [x] STEP 1 Leaflet + OpenFreeMap 지도 표시
- [x] STEP 2 Firebase Firestore 연결
- [x] STEP 3 restaurants 데이터 → 지도 마커
- [x] STEP 4 맛집 리스트 표시
- [x] STEP 5 마커 ↔ 리스트 연동
- [x] STEP 6 카테고리/상태/지역 필터
- [x] STEP 7 검색
- [x] STEP 8 마커 상세 정보
- [x] STEP 9 현재 위치 표시 + 반경 필터
- [x] STEP 10 Google/Naver 길찾기 연결
- [ ] STEP 11 Firebase Authentication 기반 개인 평가/메모 편집 UI (규칙은 준비됨, 화면은 확장 과제)
- [x] STEP 12 반응형 UI (PC 좌우分할 / 모바일 지도·리스트 전환)
