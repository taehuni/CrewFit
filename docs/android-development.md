# CrewFit Android 개발

기존 React/Vite 화면을 Capacitor 8 Android 프로젝트에 패키징한다. 앱 ID는 `com.crewfit.app`, 최소 Android API는 24다. 앱 안에는 빌드한 `client/dist`가 포함되며 원격 웹 페이지를 `server.url`로 불러오지 않는다. API와 Supabase 연결에는 인터넷이 필요하다.

## 준비 및 빌드

- Node.js 22.19 이상(22 계열)
- Android Studio 2025.2.1 이상, JDK 21
- Android SDK Platform 36, SDK Build Tools 및 platform-tools
- `client/.env`의 공개 Supabase URL/anon 키. service role·서버 비밀키는 앱에 넣지 않는다.

저장소 루트에서:

```powershell
npm --prefix client ci
npm --prefix client run android:sync
npm --prefix client run android:open
```

Android Studio에서 Gradle 동기화 후 연결된 기기/에뮬레이터를 선택하여 실행한다. CLI 디버그 APK 빌드:

```powershell
# 실제 설치 경로에 맞게 지정한다.
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = 'C:\Users\PC\AppData\Local\Android\Sdk'
Set-Location client/android
.\gradlew.bat assembleDebug
```

성공한 APK 경로는 `client/android/app/build/outputs/apk/debug/app-debug.apk`다. 코드 변경 후에는 `android:sync`를 다시 실행해야 APK에 새 화면이 포함된다. 서명된 배포용 APK/AAB와 스토어 등록은 별도 작업이다.

`build:android`는 API 주소를 `https://crewfit-akvt.onrender.com`으로 설정한다. 별도 개발 서버를 쓰려면 빌드 프로세스에 `$env:VITE_API_URL = 'https://개발서버주소'`를 지정한다. 일반 웹용 `build`에는 이 기본값을 적용하지 않는다. 로컬 `.env`의 Supabase 대상도 함께 확인하고, 운영 DB에 검증용 데이터를 쓰지 않는다. Gradle이 의존성/SDK를 처음 내려받을 때 시간이 걸릴 수 있다.

## 네이티브 연결 확인 사항

- 앱 WebView 원본은 `https://localhost`다. Express가 이 원본의 CORS 요청을 허용해야 한다. 네이버 지도 등 도메인 제한 API도 앱 원본에 대한 별도 설정/실기기 검증이 필요하다.
- 카메라와 위치 manifest 권한을 선언했다. 실제 권한 요청은 기능을 사용할 때 발생하며 거부/재허용 흐름을 기기에서 확인해야 한다. 마이크 및 백그라운드 위치 권한은 요청하지 않는다.
- Android GPS는 CrewFitTracking 네이티브 위치 서비스로 측정한다. 사용자가 화면에서 시작하면 위치 포그라운드 서비스와 진행 알림을 사용하고, 화면을 꺼도 수집하도록 구현했다. 웹은 기존 Geolocation 방식을 유지한다. 실제 화면 잠금·절전 정책 동작은 실기기 검증이 필요하다.
- 자세 분석의 화면 유지 기능은 브라우저 Screen Wake Lock API를 사용한다. WebView/기기 지원 여부에 따라 적용되지 않을 수 있으며 앱 전환·화면 잠금을 막는 기능은 아니다.
- Google 로그인은 `@capacitor/browser`로 외부 인증 화면을 열고 `com.crewfit.app://auth/google`로 앱에 복귀한다. 아래 Supabase 리디렉션 설정이 필요하다. 실제 Google 계정 인증 완료 여부는 별도 검증해야 한다.
- Google 캘린더 연결은 Android 앱의 **웹에서 연결·일정 추가** 버튼으로 CrewFit HTTPS 웹 설정 화면을 연다. 같은 계정으로 로그인하여 연결하고 웹의 저장한 계획에서 전송한다. 웹에서 받은 Google 권한 토큰은 앱 세션에 자동 복사되지 않으며, 앱에서 연결 완료라고 표시하지 않는다.
- 가입 확인메일·비밀번호 재설정 메일은 각각 `com.crewfit.app://auth/email`, `com.crewfit.app://auth/recovery`로 앱에 복귀한다. 요청한 앱 기기에 보관된 PKCE 검증값으로 코드를 교환한다. 같은 휴대폰에서 가장 최근 메일을 열어야 하며, 다른 기기·앱 재설치·요청 후 1시간 경과 시 새 메일을 요청한다. 인증 코드를 URL/로그에 남기지 않고 성공 후 일반 화면으로 이동한다.
- `@capacitor/app`의 기본 Android 뒤로가기는 WebView 방문 기록으로 돌아간다. 진행 중 운동 이탈 방지와 최상위 화면 동작은 실제 화면에서 확인한다.
- 앱 아이콘과 시작 화면은 기존 `client/public/crewfit-mark.svg` 경로/색상을 재사용한다.

## 앱 인증 리디렉션 설정

Supabase Dashboard에서 해당 프로젝트의 **Authentication → URL Configuration → Redirect URLs**에 아래 주소를 정확히 추가하고 저장한다. 기존 웹 주소와 Site URL은 유지한다.

```text
com.crewfit.app://auth/google
com.crewfit.app://auth/email
com.crewfit.app://auth/recovery
```

이 값은 Android Manifest의 scheme `com.crewfit.app`, host `auth`, 각 path와 일치한다. 앱 복귀 경로를 와일드카드로 넓히지 않는다. Google 제공자 자체의 콜백은 기존 Supabase `/auth/v1/callback`이며, 위 주소는 Supabase에서 앱으로 돌아오는 주소다. 이 저장소 변경만으로 대시보드 허용 목록이 자동 변경되지는 않는다. **사용자가 email/recovery 두 주소 추가 완료를 확인했다. 실제 메일 왕복 성공과는 별도다.** Supabase의 기본 확인/복구 이메일 템플릿이 `ConfirmationURL` 또는 전달된 RedirectTo를 유지하는지도 확인한다. 커스텀 템플릿이 Site URL을 고정하면 앱 복귀가 되지 않는다.

실제 계정 테스트 전에는 인증 정보가 없는 위 URI를 열어 CrewFit이 선택되는지 확인할 수 있다. 이 점검은 링크 연결만 검증하며 Google 인증 성공을 의미하지 않는다. 앱이 이미 열린 경우와 완전히 종료된 경우 모두 확인한다. 반환 URL의 코드·토큰을 로그나 스크린샷에 남기지 않는다.

설정 근거: [Supabase 네이티브 앱 딥 링크](https://supabase.com/docs/guides/auth/native-mobile-deep-linking), [리디렉션 URL](https://supabase.com/docs/guides/auth/redirect-urls).

## 검증 체크리스트

2026-11-06 UX 정리: Android에서 viewport-fit=cover를 해제하고 SystemBars native insets로 상태바·제스처 영역을 WebView 밖에 확보한다. 웹의 safe-area 처리는 유지한다. 새 페이지 이동/뒤로가기/해시 이동은 공통 NavigationExperience에서 처리하며, 자세 및 GPS 미저장 이탈은 데이터 라우터의 useBlocker로 보호한다. 촬영 전 기본 동영상 재생 UI를 숨기고, 자세/GPS 화면의 구현 설명은 사용자 행동·저장 상태 중심으로 정리했다.

당시 검증: 클라이언트 238개 테스트 통과, 웹/Android 빌드 통과. 운영 DB를 사용하지 않는 임시 화면에서 실제 이탈 가드의 링크 이동 취소, 저장 후 이동, 브라우저 뒤로가기 확인·확정을 검증한 뒤 임시 파일을 제거했다. 에뮬레이터에서 로그인 유지, 시스템 영역 분리, Android 뒤로가기와 입력란 포커스를 확인했다. 에뮬레이터는 물리 키보드 입력 모드라 휴대폰 전체 가상 키보드와 실제 카메라·GPS·측정 저장은 별도 검증 대상이다. 이후 Android 네이티브 GPS 지속 수집이 구현됐으며, 위의 현재 동작과 아래 후속 검증을 기준으로 한다. 웹은 화면 잠금 중 지속 수집을 보장하지 않는다.

시스템 영역 처리 근거: [Android WebView window insets](https://developer.android.com/develop/ui/views/layout/webapps/understand-window-insets) 및 설치된 Capacitor 8.6 SystemBars 구현.

최종 재설치 후 추가 확인: 코칭 하단까지 스크롤한 뒤 운동 자세 확인으로 이동해 페이지 제목부터 표시되는 것을 확인했다. 촬영 전 화면의 Android 기본 재생 아이콘도 사라지고 운동 안내 그림만 표시된다. 최신 APK 설치는 기존 앱 데이터를 유지했다.

2026-11-04 확인: `android:sync` 및 Gradle `assembleDebug` 성공. API 36.1 에뮬레이터에 디버그 APK 설치/실행 성공, 시작 후 프로세스 생존과 AndroidRuntime 치명적 예외 없음 확인. 실제 로그인·저장·카메라·GPS·외부 인증·실기기 검증은 수행하지 않았다. 아래 항목은 기기/개발 계정에서 추가 확인한다.

2026-11-06 확인: 클라이언트 테스트 233개, 웹 빌드, Browser 플러그인과 Google 콜백 필터를 포함한 APK 빌드/설치가 통과했다. `com.crewfit.app://auth/google`의 Android 연결 대상이 CrewFit MainActivity임을 확인했다. 실제 에뮬레이터 화면에서 랜딩·로그인 화면이 정상 표시되고 Google 로그인 버튼이 외부 Chrome의 첫 실행 설정 화면을 여는 것을 확인했다. 앱 전면 실행·프로세스 생존·앱 치명적 예외 없음도 확인했다. Chrome 초기 설정과 실제 계정 로그인은 사용자가 이어서 진행해야 한다. 에뮬레이터 초기 부팅 중 System UI 등 시스템 응답 지연이 있었다. 실제 OAuth 완료·앱 복귀 후 세션 생성·저장·카메라·GPS·실기기 동작은 검증하지 않았다.

2026-11-06 후속 확인: 사용자가 Supabase 복귀 주소 추가 및 Google 로그인을 완료한 후, 에뮬레이터의 인증된 홈 화면을 직접 확인했다. CrewFit 프로세스만 종료 후 재실행했으며 로그인 화면 없이 홈으로 복귀해 세션 유지를 확인했다. 코칭 → 운동 자세 확인 → 지난 자세 측정에서 오류 없이 빈 기록 안내가 표시되어 앱의 인증된 기록 조회 연결을 확인했다. 실제 측정 결과 생성·저장·재조회와 실기기 카메라/GPS는 아직 검증하지 않았다. 추가 UI 점검 대상으로 스크롤 중 상태바와 본문 겹침, 페이지 이동 시 이전 스크롤 위치가 남는 현상을 발견했다.

1. 이메일 로그인 후 앱 재시작 시 세션 복원, 로그아웃 후 보호 화면 차단.
2. 모의/개발 데이터로 기록 저장 후 재조회, 네트워크 오류 메시지.
3. 카메라 허용/거부, 전후면 전환, 화면 이탈 후 카메라 종료.
4. 정확한 위치 허용/거부, 알림 허용/거부, 화면 잠금·앱 전환 중 수집, 알림에서 종료, 앱 재실행 후 미저장 결과 복구를 확인한다.
5. Android 뒤로가기, 키보드 열린 화면, 상태바/하단 시스템 영역, 작은 화면 가로 넘침.
6. Google 로그인 후 앱 복귀 및 취소·재시도, 앱 종료 상태에서 콜백 복귀. 캘린더는 웹 열기→같은 계정 로그인→연결→웹에서 일정 전송을 확인한다. 메일은 가입/재전송/복구 각각 요청→같은 휴대폰의 메일 열기→앱 복귀를 검증하고, 만료·중복·다른 기기 링크는 재요청 안내를 확인한다.

2026-11-18 인증 UX 수정: 이메일 전용 딥링크와 PKCE 교환, 복구 화면 복귀, 재요청 안내 및 실제 캘린더 웹 이동을 구현했다. 모의 인증 테스트는 코드 교환/만료/실패/중복/SDK flow ID를 검증한다. 실제 메일 전송·Supabase 대시보드 설정·계정 로그인·Android 딥링크 동작은 별도 검증이며 이 문서가 성공을 의미하지 않는다.

공식 문서: [설치](https://capacitorjs.com/docs/getting-started), [Android 환경](https://capacitorjs.com/docs/getting-started/environment-setup), [개발 흐름](https://capacitorjs.com/docs/basics/workflow).

2026-11-06 네이티브 GPS: 계정별 기기 보관, 동일 측정 ID를 사용한 저장 재시도, 화면 이동 후 측정 복귀 배너를 추가했다. 강제 종료·재부팅 후 자동 측정 재시작은 하지 않으며 마지막 보관 결과를 종료 상태로 복구한다. 로그아웃은 수집을 종료하고 결과는 원래 계정에서만 조회한다. 클라이언트 244개 및 Java 6개 테스트와 Android 빌드 통과. 에뮬레이터 설치 성공, 컴퓨터 잠금 화면 때문에 새 GPS의 실제 버튼·권한·화면 잠금 검증은 미완료다. 운영 DB에 테스트 경로를 저장하지 않았다.
