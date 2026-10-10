# 캘린더 · 데모 제휴 예약 설정

## DB
Supabase 프로젝트 `hegpzybayxfcvtsniqsu`의 새 SQL 쿼리에서 `server/config/20261009_calendar_partners.sql` 전체 실행. 두 결과가 calendar_exports / partner_reservations이면 정상. schema.sql은 초기화용이므로 기존 DB에서 실행하지 않는다.

## Google Calendar
Google Cloud 프로젝트 crewfit-510907에서 Google Calendar API를 사용 설정한다. 기존 OAuth 웹 클라이언트와 Supabase Google provider를 재사용한다. Google Auth Platform → Data Access에 https://www.googleapis.com/auth/calendar.events.owned 범위를 추가한다. 테스트 상태는 사용하는 Google 계정을 테스트 사용자로 등록한다.
기존 Supabase redirect allowlist의 http://localhost:5173/auth/google** 및 배포 주소 /auth/google** 패턴이 calendar 쿼리도 허용해야 한다.
나 → 연결 서비스 → Google Calendar → 연결·재연결에서 기존 CrewFit Google 계정으로 동의한다. 연결 후 계획의 추가 버튼과 최종 확인을 눌러 등록한다. 토큰 만료/권한 거절 시 재연결. 이메일 전용 계정에 임의 Google 계정을 합치지 않는다.
이벤트에는 제목/날짜/시간만 보내며 운동 메모는 전송하지 않는다. 앱의 계획 삭제는 Google 일정 삭제를 의미하지 않는다. 사용자와 계획별 ID로 중복을 방지한다.

## 제휴·결제 범위
/partners의 업체·이용권·가격은 모두 데모다. 예약은 실제 시설에 전송되지 않는다. 현재 결제는 서버 상태를 변경하는 명시적 시뮬레이션이며 토스/PG 승인을 호출하지 않는다. 카드정보를 수집하지 않는다. 실제 PG 테스트 결제 단계에는 별도 테스트 상점 키 및 승인·취소 어댑터가 필요하다. 실결제는 이번 범위에 포함하지 않는다.

공식 참고: https://supabase.com/docs/guides/auth/social-login/auth-google · https://developers.google.com/workspace/calendar/api/v3/reference/events/insert · https://docs.tosspayments.com/guides/v2/get-started/payment-flow

