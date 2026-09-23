# 크루핏 (CrewFit) — AI 코칭 기반 운동 크루 플랫폼

2인 캡스톤 프로젝트 (15주). 네이티브 앱 없이 웹만으로 다종목 운동 기록(헬스 세트·야외 GPS 트래킹) + 식단·목표 + AI 코칭 + 크루 소셜 기능을 제공하는 웹 서비스.

> 설계 확정본은 `docs/architecture/` (개요 `overview.md` → 결정 `decisions.md` → 스키마 `schema.md` → API `api.md`). 이 파일과 어긋나면 **설계 문서가 우선**, 여기를 고친다.

## 팀 / 역할

- **민태훈**: PM, 백엔드 개발(API/DB/AI 연동/크루 매칭 로직), DB 설계. 경험이 많아 **프론트 뼈대·디자인 시스템도 먼저 잡아준 뒤** 화면 단위로 넘김 (D-27)
- **김민규**: 요구사항 분석, UI/UX 디자인, 프론트엔드 개발(GPS 트래킹 UI 포함) — 태훈이 깐 뼈대 위에서 화면 구현

## 기술 스택

- Frontend: React (`client/`) — **반응형 필수**. 모바일(러닝 중 사용)과 데스크톱(대시보드·크루 피드 열람) 둘 다 대응. CSS는 모바일 퍼스트로 작성하고 breakpoint 기준으로 레이아웃 전환.
- Backend: Node.js + Express (`server/`) — AI 코칭·크루 매칭 등 서버측 로직/API 담당
- DB: Supabase(PostgreSQL) — 로컬 DB 설치 없이 클라우드 관리형 사용
- 인증: Supabase Auth — 클라(supabase-js)가 로그인, 서버는 `supabase.auth.getUser(token)`로 토큰 검증. bcrypt/JWT 직접 구현 안 함
- 권한: **기본 권한선은 Supabase RLS** (D-15). 서버도 요청의 사용자 JWT로 RLS 적용 클라이언트를 씀. service_role(`supabaseAdmin`)은 `services/crewStats.js`·`services/feedback.js` 두 파일만 — 이 두 경로에서는 RLS가 아니라 **서버 코드가 권한선**이므로 열거·최소화
- 클라 상태: TanStack Query(서버 데이터) + `AuthContext`(세션) + react-router — 구현 ①에서 추가 (D-13)
- AI 코칭: OpenAI Responses API — 서버 `OPENAI_API_KEY`·`OPENAI_MODEL` 사용(D-29). 기록·식단·목표를 종합한 일/주/월 피드백. 입력 해시 같으면 재호출 없음, 재생성 기간당 3회 (D-06)
- GPS 트래킹: 브라우저 `Geolocation API` + `Wake Lock API` (네이티브 앱 없음)
- 지도 표시: 카카오맵 JS SDK

## 폴더 구조

폴더 경계·규칙은 [`docs/architecture/overview.md`](docs/architecture/overview.md) 3절 참조 (클라 `src/features/<기능>/` + `shared/`, 서버 `routes/` + `services/`).

## MVP 기능 범위 (포함) — 10개 (D-14, 상세 `overview.md` 2절)

- 인증: 이메일 가입/로그인, 비밀번호 재설정 (Supabase Auth)
- 운동 기록: 6종목(러닝·걷기·자전거·수영·헬스·기타). 공통(종목·날짜·시간) + 헬스는 `exercise_sets`(운동명 자동완성·이름 합치기), 야외 3종목만 거리·GPS 경로
- GPS 트래킹: 러닝·걷기·자전거만. 브라우저 위치 → 종료 후 카카오맵 폴리라인
- 식단 기록 (본인만, 칼로리 DB 없음)
- 목표(횟수/거리/시간 × 종목 × 주/월) + 스트릭
- AI 코칭 피드백: 일/주/월 단위 종합 피드백 (기록·식단·목표)
- 대시보드: 통계, 스트릭, 목표 달성률
- 크루: 종목·지역(고정 목록)·요일·레벨 규칙 매칭(임베딩 아님), 즉시가입/승인제, 리더가 `can_post` 부여, 크루 합계 통계
- 피드: 전체 피드 + 크루 피드, 글 종류(기록/모집/자유), 기록·경로 첨부, 사진 1장(비공개 버킷), 좋아요/댓글, 리더 고정글
- 프로필: 공개 카드 + 비공개 설정, 기록 공개 범위(public/crew/private, 기본 crew), 회원 페이지 `/users/:id`

## 제외 범위 (하지 않는 것)

- iOS/Android 네이티브 앱 개발
- 애플워치/갤럭시워치 자동 실시간 연동 (HealthKit·Health Connect는 네이티브 앱 전용이라 스코프 밖)
- 결제, 다국어, 실시간 화상/음성 기능
- Post-MVP 후보(일정 여유 시): 카카오 로그인, 코스 추천, 리더 양도, 고아 사진 정리

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
- 커밋 전 항상 **① 브랜치 이름 ② 커밋 메시지(전문)** 를 사용자에게 먼저 보여주고, **사용자가 명시적으로 승인한 뒤에만** `git commit`을 실행한다. 승인 전에 커밋 명령을 먼저 실행하지 않으며, 메시지를 고치면 고친 전문을 다시 보여주고 재승인받는다. 포함할 파일 목록도 함께 보여준다.
- 브랜치 이름은 위 컨벤션에 맞춰 **제안**하되, 최종 결정은 사용자가 한다.
- **커밋 메시지에는 AI/Claude/도구 이름·`Co-Authored-By`·세션 링크 등 어떤 AI 관련 표기도 넣지 않는다.**

## 15주 일정 (요약)

개발계획(1주) → 요구사항분석(2주) → 설계(2주) → 구현(5.5주: ⓪스키마 → ①인증 → ②기록·식단·목표·AI → ③크루 → ④피드·GPS·프로필) → 테스트(2주) → 배포(1주) → 운영지원/보완(1.5주). 상세 표는 `docs/개발계획.md` 4절.

## 실행 방법

첫 세팅:

```bash
# 0. Supabase 프로젝트 생성 (supabase.com) → Settings > API 에서 URL / anon / service_role 키 확보
#    SQL Editor 에서 순서대로 실행:
#      server/config/schema.sql        # 테이블·함수·RLS·트리거·storage 버킷 (재실행 시 앱 데이터 전부 리셋됨)
#      server/config/seed_regions.sql  # 지역 목록 229행 — 없으면 크루 생성·지역 설정이 FK 에서 실패

# 서버
cd server && npm install
cp .env.example .env          # SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY 채우기

# 클라이언트
cd client && npm install
cp .env.example .env          # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 채우기

# 테스트
cd client && npm test         # client/src 아래 Node 테스트
cd server && npm test         # services + config 소스 일치 테스트
```

- 스택 메모: 백엔드 ESM. DB/인증은 Supabase. 로그인은 클라가 supabase-js로 처리, 서버는 `requireAuth`가 토큰 검증 후 **사용자 JWT로 만든 RLS 클라이언트를 `req.db`에 부착**. service_role 키는 서버 `.env`에만, 사용처는 services 2파일(위 "권한").

## 아직 정해지지 않은 것

- ESLint/Prettier 등 린트 설정 (아직 안 붙임 — 필요할 때 추가)
