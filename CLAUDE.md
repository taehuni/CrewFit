# 크루핏 (CrewFit) — AI 코칭 기반 운동 크루 플랫폼

2인 캡스톤 프로젝트 (15주). 네이티브 앱 없이 웹만으로 실시간 러닝 트래킹 + AI 코칭 + 크루 소셜 기능을 제공하는 웹 서비스.

## 팀 / 역할

- **민태훈**: PM, 백엔드 개발(API/DB/AI 연동/크루 매칭 로직), DB 설계
- **김민규**: 요구사항 분석, UI/UX 디자인, 프론트엔드 개발(GPS 트래킹 UI 포함)

## 기술 스택

- Frontend: React (`client/`) — **반응형 필수**. 모바일(러닝 중 사용)과 데스크톱(대시보드·크루 피드 열람) 둘 다 대응. CSS는 모바일 퍼스트로 작성하고 breakpoint 기준으로 레이아웃 전환.
- Backend: Node.js + Express (`server/`) — AI 코칭·크루 매칭 등 서버측 로직/API 담당
- DB: Supabase(PostgreSQL) — 로컬 DB 설치 없이 클라우드 관리형 사용
- 인증: Supabase Auth — 클라(supabase-js)가 로그인, 서버는 `supabase.auth.getUser(token)`로 토큰 검증. bcrypt/JWT 직접 구현 안 함
- AI 코칭: LLM API(Claude/ChatGPT) — 운동 기록 기반 피드백 생성
- GPS 트래킹: 브라우저 `Geolocation API` + `Wake Lock API` (네이티브 앱 없음)
- 지도 표시: 카카오맵 JS SDK

## 폴더 구조

```
crewfit/
├── client/          # React 프론트엔드
├── server/          # Express 백엔드
│   ├── routes/
│   ├── middleware/  # requireAuth 등
│   ├── config/      # supabase.js, profiles.sql
│   └── index.js
└── CLAUDE.md
```

## MVP 기능 범위 (포함)

- 회원가입/로그인 (JWT)
- 운동 기록 CRUD (거리·시간·종류)
- 브라우저 실시간 GPS 러닝 트래킹 (경로는 카카오맵에 폴리라인으로 표시)
- AI 코칭 피드백 생성 (기록 기반)
- 크루 생성/가입 (규칙 기반 매칭 — 임베딩/추천 알고리즘 아님)
- 크루 피드 (게시/좋아요/댓글)
- 마이페이지 대시보드 (통계, 스트릭)

## 제외 범위 (하지 않는 것)

- iOS/Android 네이티브 앱 개발
- 애플워치/갤럭시워치 자동 실시간 연동 (HealthKit·Health Connect는 네이티브 앱 전용이라 스코프 밖)
- 결제, 다국어, 실시간 화상/음성 기능

## 웹 GPS 트래킹 제약 (중요 — 매번 기억할 것)

- 브라우저 GPS는 화면이 켜져 있고 탭이 포그라운드일 때만 안정적으로 동작함. `Wake Lock API`로 자동 화면 꺼짐은 막을 수 있지만, 사용자가 직접 화면을 끄거나 다른 앱으로 전환하면 트래킹이 끊김 — 이건 웹의 구조적 한계이지 버그가 아님.
- 심박수 등 BLE 센서 연동은 `Web Bluetooth API`로 가능하지만 **안드로이드 Chrome 한정**이며 iOS Safari는 지원하지 않음. 관련 기능은 반드시 플랫폼 제약을 UI에 안내할 것.
- 실내/트레드밀 트래킹은 GPS 특성상 지원 불가.
- 웹에는 시스템 화면 밝기를 낮추는 표준 API가 없음(Screen Brightness API는 아직 미구현 제안 단계). 대신 **트래킹 시작 시 자동으로 다크 미니멀 UI(검정 배경 + 숫자만 크게)로 전환**해서 OLED 전력 소모/발열을 줄이는 방식으로 구현할 것. 트래킹 중에는 지도를 실시간으로 그리지 말고 종료 후에만 경로를 렌더링해서 CPU 부하도 줄일 것.

## AI 활용 방침 (과제 요구사항 — 반드시 준수)

- AI(Claude/ChatGPT/Copilot)가 생성한 코드는 커밋 전 반드시 리뷰
- AI가 생성한 코칭 피드백 문구는 실제 기록 데이터로 여러 케이스 확인 후 프롬프트에 반영
- 커밋 메시지나 PR 설명에 AI 활용 여부를 남기는 습관 (과제 산출물 문서화 요구사항)

## 커밋/브랜치 컨벤션

- 브랜치: `feature/기능명`, `fix/버그명` → `dev` → `main`
- 커밋 메시지: `type: 설명` (예: `feat: 크루 매칭 API 추가`, `fix: GPS 좌표 계산 오류 수정`)

### Claude Code 협업 규칙 (커밋/브랜치)

- **커밋·푸시는 사용자 승인 후에만.** Claude Code가 임의로 커밋/푸시하지 않는다.
- 커밋 전 항상 **① 브랜치 이름 ② 커밋 메시지(초안)** 를 사용자에게 먼저 보여주고 확인받는다.
- 브랜치 이름은 위 컨벤션에 맞춰 **제안**하되, 최종 결정은 사용자가 한다.
- **커밋 메시지에는 AI/Claude/도구 이름·`Co-Authored-By`·세션 링크 등 어떤 AI 관련 표기도 넣지 않는다.**

## 15주 일정 (요약)

개발계획(1주) → 요구사항분석(2주) → 설계(2주) → 구현(5주: 인증→기록/AI피드백→크루매칭→피드/GPS트래킹) → 테스트(2주) → 배포(1주) → 운영지원/보완(2주)

## 실행 방법

첫 세팅:

```bash
# 0. Supabase 프로젝트 생성 (supabase.com) → Settings > API 에서 URL / anon / service_role 키 확보
#    SQL Editor 에 server/config/profiles.sql 붙여넣어 실행 (profiles 테이블 + RLS)

# 서버
cd server && npm install
cp .env.example .env          # SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 채우기

# 클라이언트
cd client && npm install
cp .env.example .env          # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 채우기
```

개발 실행 (터미널 2개):

```bash
cd server && npm run dev      # http://localhost:4000  (node --watch, 저장 시 자동 재시작)
cd client && npm run dev      # http://localhost:5173  (vite, /api → 4000 프록시)
```

- 빌드: `cd client && npm run build`
- 헬스체크: `GET http://localhost:4000/health` → `{"ok":true}`
- 스택 메모: 백엔드 ESM. DB/인증은 Supabase. 로그인은 클라가 supabase-js로 처리, 서버는 `requireAuth` 미들웨어로 토큰 검증만. 서버는 service_role 키로 Supabase 접근(RLS 우회) — 키는 서버 `.env`에만.

## 아직 정해지지 않은 것

- ESLint/Prettier 등 린트 설정 (아직 안 붙임 — 필요할 때 추가)
- 테스트 러너 (구현 단계에서 결정)
