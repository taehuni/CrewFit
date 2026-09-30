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
| `SUPABASE_URL` | server/.env | 서버 DB 연결 |
| `SUPABASE_ANON_KEY` | server/.env | 사용자 JWT와 함께 사용 |
| `SUPABASE_SERVICE_ROLE_KEY` | server/.env | 서버 전용 크루 통계·AI 저장 |
| `OPENAI_API_KEY` | server/.env | 서버 전용 AI 요청 |
| `OPENAI_MODEL` | server/.env | 기본 gpt-4.1-mini |

프론트 빌드의 `VITE_API_URL`은 빈 값으로 강제해 휴대폰이 localhost를 호출하지 않도록 한다. 비밀키에는 `VITE_` 접두사를 붙이지 않는다. 프론트 환경변수 변경 후에는 다시 빌드·배포한다.

## 주소 발급 후

1. 네이버 Maps Application의 Web 서비스 URL에 발급된 `https://서비스명.onrender.com`을 추가한다. 기존 localhost는 유지한다.
2. Supabase Authentication → URL Configuration에서 테스트 배포 주소를 Site URL로 설정하고 Redirect URLs에 `https://서비스명.onrender.com/auth/callback`, `https://서비스명.onrender.com/reset-password`를 추가한다. 기존 개발용 URL은 유지한다.
3. `/health` 응답, 로그인, `/activities/track` 직접 접속/새로고침, 지도 표시를 확인한다.
4. 휴대폰 기본 브라우저에서 위치 권한을 허용하고 야외에서 측정 → 종료 → 저장 → 기록 재조회를 확인한다. 화면을 잠그거나 다른 앱으로 전환하면 웹 GPS가 중단될 수 있다.

Free 서비스는 15분 비활성 후 중지되며 다음 접속 시 다시 시작한다. AI 호출은 기존 OpenAI 계정의 별도 사용 요금이 적용된다. 기존 Supabase를 연결하므로 저장한 테스트 기록도 해당 DB에 남는다.

참고: https://render.com/docs/free · https://render.com/docs/deploy-node-express-app
