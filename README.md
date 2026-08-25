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
│   ├── constants.js          카테고리/상태/지역(국가별)/요일 메타데이터
│   ├── geo.js                 거리 계산(Haversine) + Geolocation 래퍼
│   ├── geocode.js             주소 → 좌표 (OpenStreetMap Nominatim, 가벼운 1회성 조회용)
│   ├── directions.js          Google/Naver 길찾기 URL 생성
│   ├── testData.js            테스트용 맛집 12개 (Firestore 없이도 동작 확인 가능)
│   ├── firebaseClient.js      Firestore 인스턴스 공유 헬퍼
│   ├── restaurantWrite.js     맛집 등록 / 평점 남기기 / CSV 일괄 등록 (Firestore 쓰기)
│   ├── addRestaurantForm.js   "맛집 등록" 패널 폼 UI
│   ├── csvImport.js           CSV 파싱 + 스키마 검증
│   ├── csvImportForm.js       "CSV 일괄 등록" 패널 UI
│   ├── mapProvider.js         🔑 지도 provider 추상 인터페이스
│   └── providers/
│       └── leafletOpenFreeMapProvider.js   Leaflet + OpenFreeMap 구현체 (지명 라벨 언어 전환 포함)
│
├── scripts/
│   ├── seed-firestore.html         Firestore에 테스트 데이터를 밀어넣는 1회용 개발 도구
│   └── fetch-places-to-csv.mjs     (로컬 전용) Google/Naver API로 CSV를 만들어주는 Node.js 스크립트
│
└── firestore.rules            Firestore 보안 규칙 (인증 없이 등록/평점 허용 + 필드 단위 검증)
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
> 스타일은 3D 건물/POI가 없는 가벼운 `positron`을 쓰고, 회전·기울기(pitch)도 막아서
> 로딩을 빠르게 하고 "3D로 기울어지는" 느낌을 없앴습니다.

### 지명 라벨 언어

국가 필터를 바꾸면 지도 위 지명 라벨의 언어도 함께 바뀝니다 (`setLabelLanguages`).

- 한국만 볼 때 → 한국어만
- 일본만 볼 때 → 영어 + 일본어 + 한국어 3줄
- 전체 볼 때 → 기본(로마자 + 현지어 2줄)

OpenMapTiles 벡터 타일 스키마의 `name:en` / `name:ja` / `name:ko` 필드를 활용합니다.
다만 이 필드들은 OSM 데이터에 실제로 입력돼 있어야 표시되므로, 소규모 지명은
일부 줄이 비어 보일 수 있습니다.

### 필터 UI

국가/상태/음식/지역/거리 필터는 옆으로 늘어놓지 않고, 트리거 버튼 5개만 한 줄에 두고
누르면 팝오버가 뜨는 방식입니다 (PC/모바일 공통). 국가를 고르면 지역 옵션도
해당 국가 지역만 자동으로 좁혀집니다.

### 모바일 최적화

- 지도가 화면 배경 전체를 채우고, 리스트는 그 위에 드래그로 접고 펼 수 있는
  바텀시트로 겹칩니다 (핸들 드래그 또는 탭으로 접힘/절반/전체 3단계 전환).
- 버튼/필터/검색/리스트는 지도 로딩을 기다리지 않고 즉시 눌립니다 (지도는 별도로
  백그라운드에서 로드).
- iOS/Android 공통: 안전영역(노치·홈 인디케이터) 패딩, 입력창 자동확대 방지,
  더블탭 확대·탭 하이라이트 방지, 화면 전체 당김(overscroll) 방지 등을 적용했습니다.

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

### 3-3. Web App 등록
콘솔 → 프로젝트 설정(⚙️) → **내 앱 추가 → 웹(</>)** 선택 → 앱 닉네임 입력 →
"Firebase SDK 추가" 단계에서 나오는 `firebaseConfig` 객체를 복사합니다.

### 3-4. firebase-config.js에 값 입력
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
> **실제 데이터 보호는 아래 3-5의 Security Rules가 담당합니다.**

### 3-5. Firestore Security Rules 배포
`firestore.rules` 파일 내용을 Firestore 콘솔 → **규칙** 탭에 붙여넣고 게시하세요.
(또는 Firebase CLI: `firebase deploy --only firestore:rules`)

이 프로젝트는 **Firebase Authentication을 쓰지 않는 개인/소규모 공유용 MVP**라서
규칙 자체가 "누구나 새 맛집을 등록할 수 있고, 누구나 평점을 남길 수 있음"을
전제로 합니다. 대신 아래 두 가지로 오남용 범위를 제한해뒀습니다.

- 새 맛집 등록(create) 시 필수 필드/타입 검증
- 평점 남기기(update) 시 `my.ratingSum` / `my.ratingCount` / `updatedAt` **필드만**,
  그것도 "카운트 +1, 1~5점 범위"로만 바뀌는 요청만 허용 — 다른 사람의 맛집
  이름/좌표/상태 등은 이 경로로 절대 고칠 수 없습니다.

앱 링크를 아는 사람은 누구나 쓸 수 있다는 뜻이므로, 가족/친구 등 소수와만
공유한다면 문제없지만 불특정 다수에게 공개할 계획이라면 `firestore.rules`
맨 아래 주석에 있는 "로그인 필요" 버전으로 바꾸고 Authentication을 켜는 것을
권장합니다.

### 3-6. restaurants 데이터 등록
세 가지 방법이 있습니다.

- **방법 A (앱에서 직접, 추천):** 배포된 웹앱 우측 상단 **"➕ 맛집 등록"** 버튼을
  눌러 이름/위치/상태/카테고리/외부 평점/영업시간 등을 입력하고 등록합니다.
  위치는 좌표를 직접 입력하거나 **"📍 지도에서 위치 선택"**을 눌러 지도를 탭해
  고를 수 있습니다.
- **방법 B (테스트용, 빠름):** `scripts/seed-firestore.html`을 로컬 서버로 열고
  버튼을 눌러 `js/testData.js`의 12개 예시 데이터를 한 번에 등록합니다.
  (이 페이지는 개발용이므로 GitHub Pages에는 배포하지 마세요.)
- **방법 C (대량 등록):** Google/Naver에서 미리 조사한 정보를 본인이 정리한
  스크립트로 Firestore 콘솔이나 Admin SDK를 통해 일괄 등록합니다.

---

## 4. 앱에서 맛집 등록하기 / 평점 남기기 / 대량 등록

### 단건 등록
- 상단 **"➕ 맛집 등록"** → 폼 작성 → 저장하면 바로 Firestore에 쓰이고, 지도/리스트에
  즉시 반영됩니다.
- **국가를 고르면 지역 목록도 그 나라 지역만 보입니다** (한국 → 서울/부산/제주/기타,
  일본 → 도쿄/오사카/교토/후쿠오카/기타). 목록에 없는 지역은 "기타"를 고른 뒤
  직접 입력하면 됩니다. 지역 목록은 `js/constants.js`의 `REGIONS_BY_COUNTRY`에
  하드코딩돼 있고 Firebase와 연동되어 자동으로 늘어나지는 않습니다 — 자주 쓰는
  지역이 생기면 이 상수에 추가해주세요.
- **위치 좌표**: 보통 Google/Naver 링크는 주소 기준이라 위경도를 바로 모를 수 있어서,
  주소를 입력하고 **"📍 주소로 좌표 찾기"**를 누르면 OpenStreetMap Nominatim으로
  대략적인 좌표를 찾아 채워줍니다 (Google/Naver Places API가 아니라 지도 타일과
  같은 OSM 생태계를 쓰는 것이라 원래 설계 원칙과 충돌하지 않습니다). 이후
  **"지도에서 위치 선택"**으로 실제 위치가 맞는지 확인·보정하는 걸 권장합니다.
  Nominatim은 초당 1회 이하의 가벼운 사용만 허용하는 정책이라, 대량 자동 조회에는
  쓰지 않는 게 좋습니다 (아래 CSV 대량 등록 참고).

### 평점 남기기
이미 등록된 맛집을 클릭 → 상세 패널의 **"평점 남기기"**에서 별점을 고르고
등록하면, 여러 명이 매긴 점수의 **평균**으로 "우리 평가"에 표시됩니다.

### CSV로 대량 등록 (많이 등록해야 할 때)
상단 **"📄 CSV 등록"** 버튼에서:
1. **"⬇️ CSV 템플릿 다운로드"**로 양식을 받습니다.
2. 스프레드시트에서 Google/Naver로 미리 조사한 맛집을 정리해 같은 형식으로 채웁니다.
   `categories`와 `openingHours`처럼 값이 여러 개인 칸은 `|`(파이프)로 구분합니다.
   (예: `sushi|japanese`, `월,화,수 11:00-21:00|토,일 12:00-22:00`)
3. CSV 파일을 업로드하거나 내용을 붙여넣고 **"미리보기"**로 몇 건이 정상 인식됐는지,
   오류가 있는 행은 없는지 확인합니다.
4. **"일괄 등록"**을 누르면 Firestore에 한 번에 저장됩니다 (내부적으로 500건
   제한에 맞춰 자동으로 나눠 씁니다).

**Google/Naver 정보를 CSV로 자동 수집하고 싶다면**, `scripts/fetch-places-to-csv.mjs`를
참고하세요. 이건 **배포되는 웹앱과는 완전히 분리된, 로컬에서만 실행하는 Node.js
스크립트**입니다 (원래 설계 원칙 — "웹앱은 Google/Naver Places API를 호출하지
않는다" — 는 그대로 유지하고, "정보 수집"은 로컬 1회성 작업으로 분리한 것입니다).

```bash
# 본인 API 키 발급 후 (Google Places API (New), 네이버 검색 오픈 API)
export GOOGLE_PLACES_API_KEY="..."
export NAVER_CLIENT_ID="..."
export NAVER_CLIENT_SECRET="..."

# queries.txt에 검색어를 한 줄씩 적어두고 실행 (Node 18+)
node scripts/fetch-places-to-csv.mjs --provider=google --in=queries.txt --out=japan.csv
node scripts/fetch-places-to-csv.mjs --provider=naver  --in=queries.txt --out=korea.csv
```

몇 가지 참고할 점:
- Google 결과는 위경도/평점/리뷰수/지도 링크까지 바로 채워줍니다.
- **네이버 지역 검색 API는 좌표계가 시기에 따라 바뀐 이력이 있어**(KATECH ↔ WGS84),
  스크립트가 임의로 변환하지 않고 원본 `mapx`/`mapy`를 참고용으로만 남깁니다.
  네이버 결과는 위경도가 비어 있으니, 앱의 "주소로 좌표 찾기"로 채우거나
  최신 네이버 문서(https://developers.naver.com/docs/serviceapi/search/local/local.md)를
  확인해 직접 채워 넣어주세요.
- `region`/`categories`/`status`/`openingHours`는 스크립트가 채우지 않으므로,
  CSV를 열어 스프레드시트에서 정리한 뒤 앱의 CSV 업로드로 올려주세요.
- 두 회사 모두 API 이용약관이 있으니, 결과 데이터를 어떻게 저장/사용할 수 있는지
  본인 프로젝트 성격에 맞게 확인하는 걸 권장합니다.

### 아직 없는 기능
이름/좌표/상태처럼 이미 등록된 맛집 자체의 정보를 앱에서 고치는 기능은 아직
없습니다. Firestore 콘솔에서 직접 수정해주세요.

---

## 5. GitHub Pages 배포

1. 이 폴더를 GitHub 저장소 루트(또는 `docs/` 폴더)에 푸시합니다.
2. 저장소 **Settings → Pages**에서 배포 브랜치/폴더를 지정합니다.
3. `firebase-config.js`를 실제 값으로 채운 뒤 커밋합니다 (3-4 참고).
4. Firestore Security Rules(3-5)를 반드시 배포한 뒤 공개하세요.

---

## 6. 데이터 구조

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

  "my": {                        // 내가/우리가 직접 작성한 정보 — 여러 명이 평점을 남길 수 있어 합계/개수로 저장
    "ratingSum": 9,               // 평점 합계 (예: 4.5 + 4.5)
    "ratingCount": 2,             // 평점을 남긴 횟수 → 화면엔 ratingSum/ratingCount 평균으로 표시
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

## 7. MVP에 포함하지 않은 것

의도적으로 제외한 기능입니다 (필요 시 별도로 확장):

- Google/Naver Places API 호출, 맛집 자동 검색, 웹 크롤링
- 자체 길찾기 알고리즘 / 자체 지도 타일 서버
- 복잡한 백엔드, 관리자 CMS
- 이미 등록된 맛집의 이름/좌표/상태 등을 앱에서 수정·삭제하는 기능
  (신규 등록과 평점 남기기는 지원 — Firestore 콘솔에서 직접 고쳐야 함)
- Firebase Authentication (현재는 링크를 아는 사람 누구나 등록/평점 가능한
  구조이며, 필요 시 firestore.rules 하단 주석대로 로그인 필수로 전환 가능)

---

## 8. 구현 순서 체크리스트

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
- [x] STEP 11 앱 내 맛집 등록 + 다중 평점 평균 (Authentication은 미도입, 확장 과제로 남김)
- [x] STEP 12 반응형 UI (PC 스크롤 없이 한 화면 / 모바일 지도 위 + 드래그 바텀시트 리스트)
