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
├── index.html      화면 구조 (일반 사용자용)
├── style.css        스타일
├── app.js            앱 로직 (상태, 필터/검색, 지도↔리스트 연동)
├── admin.html        관리자 페이지 (로그인 필요)
├── admin.css         관리자 페이지 전용 스타일
├── admin.js           관리자 페이지 로직 (지역/음식태그/맛집 관리)
├── firebase-config.js  Firebase 프로젝트 연결 설정
│
├── js/
│   ├── constants.js          카테고리/상태/지역(국가별)/요일 메타데이터 (기본값)
│   ├── taxonomyStore.js       Firestore의 커스텀 지역/태그를 constants.js에 병합
│   ├── taxonomyWrite.js       커스텀 지역/태그 Firestore CRUD (admin.js 전용)
│   ├── geo.js                 거리 계산(Haversine) + Geolocation 래퍼
│   ├── geocode.js             주소 → 좌표 (OpenStreetMap Nominatim, 가벼운 1회성 조회용)
│   ├── directions.js          Google/Naver 길찾기 URL 생성
│   ├── testData.js            테스트용 맛집 12개 (Firestore 없이도 동작 확인 가능)
│   ├── firebaseClient.js      Firestore/Auth 인스턴스 공유 헬퍼
│   ├── restaurantWrite.js     맛집 등록/수정/삭제/평점 남기기/CSV 일괄 등록 (Firestore 쓰기)
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
└── firestore.rules            Firestore 보안 규칙 (공개 등록/평점 + 관리자 로그인 시 전체 권한)
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
> 스타일은 색이 있는(초록 녹지/파란 수역 등) `bright`를 쓰고, 3D 건물 레이어가 없어
> 회전·기울기(pitch)를 막아둔 것과 궁합이 좋습니다.

### 지명 라벨 언어

지도 중심이 어디를 보고 있는지(경도 129.5° 기준 한국/일본)에 따라 지명 라벨
언어가 자동으로 바뀝니다 (`onMapMove` → `setLabelLanguages`). 필터가 아니라
"지금 화면에 보이는 위치"를 기준으로 하기 때문에, 필터를 "전체"로 둔 채
지도를 한국 → 일본으로 드래그해서 넘어가도 라벨이 알아서 전환됩니다.

- 한국 쪽(대략 부산/제주 서쪽)을 보고 있을 때 → 한국어만
- 일본 쪽(대략 후쿠오카 동쪽)을 보고 있을 때 → 영어 + 일본어 + 한국어 3줄

OpenMapTiles 벡터 타일 스키마의 `name:en` / `name:ja` / `name:ko` 필드를 활용합니다.
이 필드들은 OSM 데이터에 실제로 입력돼 있어야 표시되므로, 소규모 지명은
일부 줄이 비어 보일 수 있습니다.

### 필터 UI

국가/상태/음식/지역/거리 필터는 옆으로 늘어놓지 않고, 트리거 버튼 5개만 한 줄에 두고
누르면 팝오버가 뜨는 방식입니다 (PC/모바일 공통). 국가를 고르면 지역 옵션도
해당 국가 지역만 자동으로 좁혀집니다.

### 지역/음식 태그 관리 (Firebase 연동)

기본 지역(서울/부산/제주/도쿄/오사카/교토/후쿠오카)과 기본 음식 태그(스시/라멘/
야키니쿠 등)는 `js/constants.js`에 코드로 고정돼 있습니다. 여기에 없는 지역이나
태그는 **관리자 페이지(`admin.html`)에서 추가**할 수 있고, Firestore의
`regions` / `categories` 컬렉션에 저장돼 계속 늘려갈 수 있습니다. 앱이 켜질 때
이 컬렉션을 불러와 기본값에 자동으로 합쳐서 필터/등록 폼/CSV 등록에 바로
반영됩니다. (기본값 자체는 관리자 페이지에서 삭제할 수 없고, 관리자가 추가한
항목만 삭제 가능합니다.)

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

### 3-4. Authentication 설정 (관리자 페이지용, 필수)
관리자 페이지(`admin.html`)에서 지역/음식 태그 관리, 맛집 수정·삭제를 하려면
로그인이 필요합니다. **회원가입 UI는 앱에 없고**, Firebase 콘솔에서 관리자
계정을 직접 만들어야 합니다.

1. 콘솔 → **Authentication** → 시작하기 → 로그인 방법에서 **이메일/비밀번호** 활성화
2. **Authentication → Users → 사용자 추가**에서 본인 이메일/비밀번호로 계정 1개 생성
   (이 계정이 곧 "관리자"입니다 — 여러 명에게 관리 권한을 주고 싶으면 계정을 더 추가하면 됩니다)
3. 이제 `admin.html`에서 그 이메일/비밀번호로 로그인하면 관리자 기능을 쓸 수 있습니다

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
> **실제 데이터 보호는 아래 3-6의 Security Rules + 3-4의 관리자 로그인이 담당합니다.**

### 3-6. Firestore Security Rules 배포
`firestore.rules` 파일 내용을 Firestore 콘솔 → **규칙** 탭에 붙여넣고 게시하세요.
(또는 Firebase CLI: `firebase deploy --only firestore:rules`)

권한 구조 요약:

- **로그인 없이 누구나** — 맛집 새로 등록(`restaurants` create), 평점 남기기
  (`my.ratingSum`/`ratingCount`만, +1/1~5점 범위로만 update). 필수 필드/타입도 검증합니다.
- **관리자 로그인 시에만** — 맛집 전체 수정·삭제, `regions`/`categories`
  (커스텀 지역·음식 태그) 추가·삭제.

앱 링크를 아는 사람은 누구나 "등록/평점 남기기"는 할 수 있다는 뜻이므로,
가족/친구 등 소수와만 공유한다면 문제없지만 불특정 다수에게 공개할 계획이라면
등록에도 로그인을 요구하도록 규칙을 더 강하게 잠그는 걸 권장합니다.

### 3-7. restaurants 데이터 등록
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
이름/좌표/상태처럼 이미 등록된 맛집 자체의 정보를 앱(일반 사용자 화면)에서
고치는 기능은 없습니다 — 아래 관리자 페이지에서 하세요.

---

## 5. 관리자 페이지 (`admin.html`)

배포 주소 뒤에 `/admin.html`을 붙여서 접속합니다 (예: `https://아이디.github.io/저장소명/admin.html`).
메인 앱에는 이 페이지로 가는 링크를 일부러 넣지 않았습니다 — 로그인 없이는
아무것도 못 하니 눈에 띄게 노출할 필요가 없어서입니다.

로그인 후 3개 탭을 오갈 수 있습니다.

- **📍 지역 관리**: 새 지역(국가 + slug + 표시 이름) 추가. 기본 지역(서울/부산/...)은
  코드에 있어 여기서 지울 수 없고, 직접 추가한 것만 삭제할 수 있습니다.
- **🏷️ 음식 태그 관리**: 새 음식 태그(아이콘 + slug + 표시 이름) 추가/삭제. 기본 태그도 마찬가지.
- **🍽️ 맛집 관리**: 등록된 맛집을 이름으로 검색하고, 각 항목을 **수정**(이름/위치/상태/
  카테고리/외부 평점/영업시간/메모 등 대부분 필드) 또는 **삭제**할 수 있습니다.
  **`scripts/seed-firestore.html`로 넣어둔 테스트 데이터 12개를 지우고 싶다면
  여기서 이름으로 찾아 하나씩 삭제하면 됩니다.**

여기서 추가한 지역/음식 태그는 Firestore의 `regions`/`categories` 컬렉션에 저장되고,
일반 사용자 앱이 다음에 새로고침될 때 필터/등록 폼 선택지에 자동으로 나타납니다.

---

## 6. "새로 등록한 맛집이 Firebase에 저장되는 게 맞나요?"

네, 맞습니다. 아래 세 가지 경로 전부 **Firestore에 직접 씁니다** (다른 저장소 없음).

- 상단 **"➕ 맛집 등록"** 폼 → `createRestaurant()` → Firestore `restaurants` 컬렉션
- **"📄 CSV 등록"** 일괄 업로드 → `bulkCreateRestaurants()` → 같은 컬렉션에 여러 건
- 상세 패널의 **"평점 남기기"** → `submitRating()` → 해당 문서의 `my.ratingSum`/`ratingCount`만 갱신

반대로 `js/testData.js`의 12개 "테스트 데이터"는 **Firestore와 무관한, 코드에 하드코딩된
값**입니다. Firestore 연동이 안 됐거나 `restaurants` 컬렉션이 비어있을 때만 화면에
잠깐 보여주는 폴백(fallback)이에요. `scripts/seed-firestore.html`로 일부러 밀어넣지
않는 이상 Firestore에는 안 들어가 있고, 반대로 한 번 밀어넣었다면 진짜 Firestore
문서가 된 것이니 위 5번 관리자 페이지의 "맛집 관리"에서 지울 수 있습니다.

---

## 7. GitHub Pages 배포

1. 이 폴더를 GitHub 저장소 루트(또는 `docs/` 폴더)에 푸시합니다.
2. 저장소 **Settings → Pages**에서 배포 브랜치/폴더를 지정합니다.
3. `firebase-config.js`를 실제 값으로 채운 뒤 커밋합니다 (3-5 참고).
4. Firestore Security Rules(3-6)를 반드시 배포한 뒤 공개하세요.
5. Authentication에 관리자 계정을 만들어뒀는지 확인하세요 (3-4).

---

## 8. 데이터 구조

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

## 9. MVP에 포함하지 않은 것

의도적으로 제외한 기능입니다 (필요 시 별도로 확장):

- Google/Naver Places API 호출, 맛집 자동 검색, 웹 크롤링
- 자체 길찾기 알고리즘 / 자체 지도 타일 서버
- 복잡한 백엔드, 무거운 관리자 CMS (가벼운 `admin.html` 정도만 제공)
- 여러 관리자 간 권한 세분화(누구는 지역만, 누구는 맛집만 등) — 로그인한
  계정이면 전부 동일한 권한을 가집니다.

---

## 10. 구현 순서 체크리스트

- [x] STEP 1 Leaflet + OpenFreeMap 지도 표시
- [x] STEP 2 Firebase Firestore 연결
- [x] STEP 3 restaurants 데이터 → 지도 마커
- [x] STEP 4 맛집 리스트 표시
- [x] STEP 5 마커 ↔ 리스트 연동
- [x] STEP 6 카테고리/상태/지역 필터 (팝오버 UI, 국가별 지역 좁히기)
- [x] STEP 7 검색
- [x] STEP 8 마커 상세 정보
- [x] STEP 9 현재 위치 표시 + 반경 필터
- [x] STEP 10 Google/Naver 길찾기 연결
- [x] STEP 11 앱 내 맛집 등록 + 다중 평점 평균 + CSV 일괄 등록
- [x] STEP 12 반응형 UI (PC 스크롤 없이 한 화면 / 모바일 지도 위 + 드래그 바텀시트 리스트)
- [x] STEP 13 Firebase Authentication 도입 + 관리자 페이지 (지역/음식 태그/맛집 CRUD)
