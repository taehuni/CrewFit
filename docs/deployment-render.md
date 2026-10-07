# Render 테스트 배포

React 빌드와 Express API를 Render Free Web Service 한 개에서 제공한다. DB/Auth/Storage는 기존 Supabase를 사용한다. GPS는 Render가 제공하는 HTTPS 주소에서 사용한다.

## 배포 설정

- 저장소 루트의 `render.yaml`을 Blueprint로 등록하거나 아래 설정으로 Web Service를 만든다.
- Runtime: Node / Plan: Free / Root Directory: 비워 둠
- Build Command: `npm --prefix server ci && npm --prefix client ci --include=dev && VITE_API_URL= npm --prefix client run build`
- Start Command: `npm --prefix server start`
- Health Check: `/health`
- Node: 22 / `NODE_ENV=production`
- 자동 배포는 끈다. 검증한 커밋을 수동 배포한다.

## 환경변수

Render 환경변수에는 로컬 파일의 값을 옮긴다. `.env` 자체를 Git에 올리지 않는다.

| 변수 | 가져올 위치 | 용도 |
|---|---|---|
| `VITE_SUPABASE_URL` | client/.env | 브라우저 공개 설정 |
| `VITE_SUPABASE_ANON_KEY` | client/.env | 브라우저 공개 키, RLS 적용 |
| `VITE_NAVER_MAP_CLIENT_ID` | client/.env | 지도 Client ID |
| `VITE_NAVER_MAP_STYLE_ID` | Style Editor에서 발행한 My Style ID | 선택: GL 커스텀 지도 스타일. 비워 두면 기본 지도 |
| `SUPABASE_URL` | server/.env | 서버 DB 연결 |
| `SUPABASE_ANON_KEY` | server/.env | 사용자 JWT와 함께 사용 |
| `SUPABASE_SERVICE_ROLE_KEY` | server/.env | 서버 전용 크루 통계·AI 저장 |
| `OPENAI_API_KEY` | server/.env | 서버 전용 AI 요청 |
| `OPENAI_MODEL` | server/.env | 기본 gpt-4.1-mini |

프론트 빌드의 `VITE_API_URL`은 빈 값으로 강제해 휴대폰이 localhost를 호출하지 않도록 한다. 비밀키에는 `VITE_` 접두사를 붙이지 않는다. 프론트 환경변수 변경 후에는 다시 빌드·배포한다.

## 주소 발급 후

### 2026-10-03 GPS 보관 기능 배포 순서

1. 기존 Supabase SQL Editor에서 `server/config/migrations/20261003_gps_drafts.sql`만 실행한다. 기존 기록은 유지된다. `schema.sql`은 초기화용이므로 기존 프로젝트에 실행하지 않는다.
2. Render 환경변수 `VITE_NAVER_MAP_STYLE_ID`에 발행한 스타일 ID `7b56055a-ba14-4716-8659-5c57f1290f18`을 저장한다. 지도 SDK는 GL 모듈과 커스텀 스타일을 함께 사용한다.
3. 승인된 `render_test` 커밋을 빌드·배포한다. GPS 저장이 새 RPC를 사용하므로 DB 업데이트를 먼저 완료해야 한다.
4. 휴대폰에서 기록 → GPS 측정 → 종목 선택 → 종료 → 나중에 작성 → 불러오기 → 최종 저장을 확인한다. 최종 저장 전후 통계와 경로 표시도 확인한다.

### 2026-10-07 커뮤니티 화면 보완 배포

1. 기존 DB에는 `server/config/migrations/20261007_community_polish.sql`을 적용한다. 이번 연결에서는 적용과 실제 저장 검증을 마쳤다. 사진·소개·알림·신고·차단용 테이블/정책/비공개 버킷을 추가하며 기존 데이터를 초기화하지 않는다.
2. 이전 실명 기능이 빠진 프로젝트는 `server/config/migrations/20260909_member_real_name.sql`도 적용한다. `schema.sql` 전체는 기존 서비스에 실행하지 않는다.
3. 앱 빌드·검증 후 승인된 커밋을 Render에 배포하고 크루 커버, 내 크루, 사진 글, 알림과 차단 설정을 확인한다.
4. 신고 처리는 현재 운영자의 Supabase Table Editor에서 `content_reports.status`를 검토·변경한다. 앱은 신고 접수와 본인 처리 상태 조회를 제공하며 별도 운영자 대시보드는 포함하지 않는다.

### 공통 주소 및 동작 확인

1. 네이버 Maps Application의 Web 서비스 URL에 발급된 `https://서비스명.onrender.com`을 추가한다. 기존 localhost는 유지한다.
2. Supabase Authentication → URL Configuration에서 테스트 배포 주소를 Site URL로 설정하고 Redirect URLs에 `https://서비스명.onrender.com/auth/callback`, `https://서비스명.onrender.com/reset-password`를 추가한다. 기존 개발용 URL은 유지한다.
3. `/health` 응답, 로그인, `/activities/track` 직접 접속/새로고침, 지도 표시를 확인한다.
4. 휴대폰 기본 브라우저에서 위치 권한을 허용하고 야외에서 측정 → 종료 → 저장 → 기록 재조회를 확인한다. 화면을 잠그거나 다른 앱으로 전환하면 웹 GPS가 중단될 수 있다.

Free 서비스는 15분 비활성 후 중지되며 다음 접속 시 다시 시작한다. AI 호출은 기존 OpenAI 계정의 별도 사용 요금이 적용된다. 기존 Supabase를 연결하므로 저장한 테스트 기록도 해당 DB에 남는다.

참고: https://render.com/docs/free · https://render.com/docs/deploy-node-express-app
