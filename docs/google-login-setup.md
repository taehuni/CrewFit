# 구글 로그인 연결

Google provider 활성화와 실제 로그인 확인을 완료했다. 아래는 재설정 시 참고 절차이며 이메일 로그인은 유지한다.

1. Google Auth Platform에서 CrewFit 프로젝트의 Branding, Audience를 설정한다. 테스트 상태라면 사용할 계정을 테스트 사용자에 등록한다.
2. Clients에서 **웹 애플리케이션** OAuth 클라이언트를 만든다.
   - JavaScript origins: `http://localhost:5173`, `https://crewfit-akvt.onrender.com`
   - Redirect URI: Supabase → Authentication → Sign In / Providers → Google에 표시된 **Supabase callback URL**을 그대로 복사한다. 이 값은 앱의 `/auth/google` 주소와 다르다.
3. 발급된 Client ID와 Client Secret은 Supabase Google provider 설정에만 입력하고 활성화한다. Secret을 Git, 프런트 환경변수, 채팅에 넣지 않는다.
4. Supabase Authentication → URL Configuration → Redirect URLs에 아래를 허용한다.
   - `http://localhost:5173/auth/google**`
   - `https://crewfit-akvt.onrender.com/auth/google**`
   경로의 next 쿼리를 허용하는 제한적 패턴이며 전체 사이트 와일드카드는 추가하지 않는다. 기존 이메일 인증/비밀번호 재설정 URL은 유지한다.
5. 새 계정, 기존에 검증된 동일 이메일 계정, 구글 선택 취소, 로그아웃 후 재로그인을 실제 계정 소유자가 확인한다. 다른 이메일의 계정은 자동 병합하지 않는다.

기본 로그인은 로그인 권한만 사용한다. 캘린더 추가 동의는 docs/calendar-partners-setup.md를 따른다. 프로필의 주종목이 아직 없으면 닉네임·종목·지역 설정 안내로 이동한다.

근거: https://supabase.com/docs/guides/auth/social-login/auth-google 및 https://supabase.com/docs/guides/auth/auth-identity-linking

