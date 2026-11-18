# CrewFit 클라우드 작업 환경

이 파일은 환경 설정값과 작업 절차다. 파일이 존재한다고 클라우드 환경이 생성·게시된 것은 아니다.

## 환경 설정
- 저장소: `taehuni/CrewFit`
- 최신 개발 기준: `render_test` (환경 생성 시 실제 원격 브랜치를 확인)
- 이름: `CrewFit`
- 런타임: Node.js 22.19 이상, 22 계열
- 설치 명령(저장소 루트): `node tooling/cloud-setup.mjs`
- 의존성 설치에는 npm 레지스트리 접근이 필요하다.
- 작업 시작 시 루트 `AGENTS.md`를 읽는다. 운영 Render 배포와 클라우드 개발 환경은 별개다.

## 검증 명령
```sh
npm --prefix client test
npm --prefix server test
npm --prefix client run build
```
실제 서버를 시작하지 않아도 위 코드 검증을 우선 수행할 수 있다. 외부 서비스 통합 검증 성공을 의미하지는 않는다.

## 화면 실행에 필요한 설정
프론트: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
백엔드: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PORT=4000`.
개발 Vite 프록시를 사용하므로 `VITE_API_URL`은 빈 값으로 둔다.

권장: 별도 개발용 Supabase 프로젝트의 설정을 클라우드 환경에 등록한다. 로컬 `.env`를 업로드하거나 파일에 값을 복사하지 않는다. OAuth 테스트에는 개발 미리보기 주소도 허용 목록에 등록해야 한다.

필요 기능에 한해서만 추가:
- 지도: `VITE_NAVER_MAP_CLIENT_ID`, 선택 `VITE_NAVER_MAP_STYLE_ID` 및 네이버 허용 주소.
- AI: 서버 전용 `OPENAI_API_KEY`, `OPENAI_MODEL` (실제 호출 비용 발생 가능).
- 관리자 서비스: 개발 프로젝트의 `SUPABASE_SERVICE_ROLE_KEY` (RLS 우회 권한).
- 상품: `OWNERCLAN_USERNAME`, `OWNERCLAN_PASSWORD` (서버 전용).

키를 제공하지 않은 기능은 모의 데이터로 검증하거나 미검증으로 표시한다. 테스트를 위해 운영 계정 권한을 자동 복사하지 않는다.

## 폰에서 사용
같은 계정/워크스페이스의 Codex에서 작업 위치를 Cloud로 선택하고 게시된 CrewFit 환경을 선택한다. 변경 요청에 목표와 완료 기준을 적는다. 로컬에서만 수정한 파일은 클라우드에 자동 전달되지 않으므로 작업 시작 전에 필요한 변경이 원격 저장소에 있는지 확인한다.

요청 예: "CrewFit 코칭 계획 화면을 개선해줘. 디자인 담당이 흐름을 검토하고 개발 담당이 구현한 다음 검증 담당이 모바일 날짜 겹침과 저장/재조회를 확인해줘. 운영 배포 전 결과를 보여줘."

## 완료 기준
1. 환경에 저장소와 설치 명령이 저장되고 게시됨.
2. 클라우드 체크아웃에서 AGENTS.md와 tooling/cloud-setup.mjs가 보임.
3. 의존성 설치와 테스트/빌드 결과를 확인함.
4. 폰에서 해당 환경을 선택할 수 있음을 사용자가 확인함.

공식 안내: https://learn.chatgpt.com/docs/environments/cloud-environments
모바일: https://learn.chatgpt.com/docs/mobile
