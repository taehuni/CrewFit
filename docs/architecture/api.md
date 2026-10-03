# CrewFit 서버 API 명세 (초안)

> D-10·D-11·D-15 기준. Express는 "서버만 할 수 있는 동작"만 맡고, 나머지는 클라가 supabase-js로 직접(2절).
> 구현 중 바뀌면 여기부터 고친다.

## 공통

- Base: `/api` (개발: Vite 프록시 → `localhost:4000`)
- 인증: 모든 엔드포인트 `Authorization: Bearer <supabase access_token>` 필수 (`/health` 제외). `requireAuth`가 토큰 검증 후 `req.user`와 **RLS 적용 클라이언트 `req.db`** 를 부착.
- 접근 키: 기본 `req.db`(사용자 JWT). `supabaseAdmin`은 표에 **admin**으로 표시된 곳만, `services/` 안에서만.
- 에러: `{ "error": { "code": "…", "message": "…" } }`. 401 토큰 없음/무효, 403 RLS 거부(Supabase 에러를 변환), 400 입력 검증, 404 없음, 500 그 외.
- 날짜: `YYYY-MM-DD`(KST 로컬), 시간 `sec`, 거리 `m`.

## 1. 엔드포인트

| # | 메서드·경로 | 하는 일 | 접근 키 | services |
|---|---|---|---|---|
| 1 | `GET /health` | 살아있나 | — | — |
| 2 | `GET /me` | 토큰 검증 확인, `profiles` + `user_settings` 반환 | JWT | — |
| 3 | `POST /feedback/generate` | 기간 기록·식단·목표·프로필로 프롬프트 → LLM → `ai_feedbacks` upsert | 읽기 JWT / **쓰기 admin** | `feedback.js`, `llm.js` |
| 4 | `GET /crews/match` | 내 설정으로 크루 추천 | JWT | `matching.js` |
| 5 | `POST /crews/:id/join` | 가입 신청(open→approved, approval→pending) | JWT | — |
| 6 | `POST /crews/:id/approve` | 리더가 승인 | JWT | — |
| 7 | `POST /crews/:id/reject` | 리더가 거절(행 삭제) | JWT | — |
| 8 | `GET /crews/:id/stats` | 크루 합계 통계 | **admin** | `crewStats.js` |
| 9 | `GET /dashboard` | 스트릭·목표 달성률·기간 합계 | JWT | `dashboard.js` |
| 10 | `POST /exercises/merge` | 운동명 합치기(일괄 UPDATE) | JWT | — |

### 3. `POST /feedback/generate`
```
req  { "period": "day" | "week" | "month", "date": "2026-09-03", "force": false }   // date: 그 기간에 속한 아무 날짜
res  { "id": 12, "period": "week", "period_start": "2026-08-31", "content": "…", "model": "gpt-4.1-mini",
       "created_at": "…", "cached": true, "regen_count": 1, "remaining_regenerations": 2 }
```
- **기준일은 서버가 계산** (`date` → day: 그대로 / week: 그 주 월요일 / month: 1일, KST). 클라가 준 날짜를 그대로 저장하지 않음 — 같은 주가 두 행이 되는 것 방지. DB CHECK가 재검증.
- **호출 흐름 (D-06)**: 화면 진입·기간 변경은 Supabase JWT/RLS로 `ai_feedbacks`의 본인·기간·정규화된 시작일 행만 조회한다. ‘피드백 받기’ 클릭 시에만 이 API를 호출한다. `source_hash = sha256(코칭 지침 + 입력 프롬프트 + 모델명)`가 기존 행과 같고 `force`가 아니면 **LLM 호출 없이 기존 행 반환** (`cached: true`). 다르면 생성 후 upsert(`llm_calls + 1`). ‘다시 받기’는 `force: true`, `regen_count + 1`, `llm_calls + 1`; 이미 3이면 **429 `REGEN_LIMIT`**. 생성 중 버튼·기간 선택을 잠그고 오류 시 기존 결과를 보존한다. 저장된 결과는 작성 시점의 분석이며 자동 갱신하지 않는다.
- **코칭 내용**: 서버 집계(종목별 횟수·시간·거리)와 원천 기록으로 현재 상태 → 잘한 점 → 개선할 점 → 다음 행동을 작성한다. 현재 활성 목표는 과거 목표 이력이 아니며, 이전 기간 비교 자료는 전달하지 않는다. 무근거 추세·운동량 증가·미입력 영양소 추정을 금지하고 데이터 부족을 명시한다.
- **비용 상한**: 실제 LLM 호출(캐시 반환 제외, force 여부 무관)을 서버 in-memory `Map`으로 **사용자당 분당 5회 · 일일 20회** 제한, 초과 429 `RATE_LIMIT`. 데이터를 조금씩 바꿔 해시를 갈아도 일일 상한에 걸림. 단일 인스턴스 전제·재시작 시 리셋 — 사용자 늘거나 인스턴스 늘면 `llm_usage` 테이블로 교체(그때 `llm_calls` 누계가 상한값 근거).
- 읽기(JWT): 해당 기간 `activities`(+`exercise_sets`)·`meals`·활성 `goals`·`profiles.main_sport`·`user_settings.goal_note`.
- 쓰기(admin): `ai_feedbacks` upsert on `(user_id, period, period_start)` — `user_id`는 **반드시 `req.user.id`** (요청 본문에서 받지 않음).
- 기록이 0건이면 400 `NO_DATA`.
- D-30: 최신 캐시 upsert 트랜잭션의 트리거가 생성 이력을 `ai_feedback_history`에 추가한다. 캐시 반환은 쓰기가 없으므로 이력도 늘지 않는다. 생성 전 이력 테이블 접근 실패 시 503 `HISTORY_REQUIRED`로 중단한다. 이력은 사용자 JWT/RLS로 본인 행을 ID 내림차순·20건 커서(`id < 마지막 ID`)로 조회한다. 이력에 저장된 전문을 여는 동작은 LLM을 호출하지 않는다.
- 외부 모델은 OpenAI Responses API를 사용한다(D-29). 서버 전용 `OPENAI_API_KEY`가 필수이고 `OPENAI_MODEL`은 기본 `gpt-4.1-mini`에서 교체할 수 있다. 키·원문 응답·Supabase 오류 상세는 클라이언트 응답에 포함하지 않는다.
- 설정 누락 503 `CONFIG_REQUIRED`, 모델 거절 422 `LLM_REFUSED`, 모델 통신 실패 502 `LLM_FAILED`, 저장 결과 불명 500 `FEEDBACK_SAVE_FAILED`. 실패 요청은 성공으로 표시하거나 자동 재전송하지 않는다.

### 4. `GET /crews/match`
```
res  { "crews": [ { "id", "name", "sport", "level", "region_sido", "region_sigungu", "activity_days", "join_mode",
                    "member_count", "matched_on": ["sport","region","days","level"] } ],
       "relaxed": ["level"] }
```
- 내 축: `profiles.main_sport`·`level`, `user_settings.region_*`·`preferred_days` (JWT로 내 것만 읽힘).
- `member_count`는 `rpc('crew_member_count')`(security definer) — JWT로 `crew_members`를 세면 `show_crews=false` 행이 빠져 실제보다 작게 나오므로 직접 세지 않음.
- 필터 순서: 종목 일치(필수) → 시/군/구 일치 → 요일 겹침(`&&`) → 레벨 일치. 결과 0이면 뒤에서부터 하나씩 완화, `relaxed`에 기록. 점수화 없음 (D-16).
- 설정이 비어 있으면(종목 없음) 400 `SETTINGS_REQUIRED`.
- 이미 가입·신청한 크루는 제외.
- 구현(2026-09-25): `services/matching.js`가 사용자 JWT로 본인 설정과 가입·대기 목록을 읽는다. 미설정 선택 조건은 처음부터 생략한다. 첫 결과가 나오는 조건 단계에서 멈추고 ID 내림차순 최대 20건을 반환한다(부족한 수를 약한 조건으로 채우지 않음). 가입 목록과 후보는 100건씩 조회해 API 행 제한으로 인한 누락을 피한다. 지역은 시/도와 시/군/구 쌍을 비교한다. 조회/RPC 실패는 500 `MATCH_FAILED`이며 빈 추천으로 처리하지 않는다.
- 크루 화면 상단에 추천, 하단에 기존 전체 종목별 탐색을 유지한다. 카드에 실제 일치 조건·인원수를 표시하고 조건 완화는 별도 안내한다. 추천 없음·설정 필요·로딩·실패를 구분한다.
- `나 → 크루 추천 설정`: 주종목 필수, 레벨·지역·요일 선택. 기존 본인 RLS/컬럼 권한으로 `profiles`의 main_sport/level과 `user_settings`의 region_*/preferred_days만 수정한다. 두 테이블 저장은 원자적이지 않으므로 두 번째 저장 실패 시 주종목·레벨 저장 여부를 명시하고 입력을 유지한다. 저장 시 본인 프로필·추천 캐시를 갱신하며 가입/탈퇴/크루 생성 후 기존 목록 무효화에도 추천이 포함된다.

### 5~7. 멤버십
```
POST /crews/:id/join     req {}                      res { "status": "approved" | "pending" }
POST /crews/:id/approve  req { "user_id": "uuid" }   res { "ok": true }
POST /crews/:id/reject   req { "user_id": "uuid" }   res { "ok": true }
```
- 전부 `req.db`(JWT)로 `crew_members`에 insert/update/delete. **권한 판단은 RLS가 함** — self-approve·남의 크루 승인은 RLS 거부 → 403.
- join: 서버는 `crews.join_mode`만 읽어 status를 정해 insert (RLS `members_insert_join`이 이중 검증).
- 구현(2026-09-23): `POST /crews/:id/join`은 사용자 JWT로 처리하며 본문의 사용자·status·can_post를 받지 않는다. 이미 가입/신청한 행 또는 동시 중복 INSERT는 현재 상태를 반환한다(권한 덮어쓰기 없음). 크루 없음 404, 잘못된 ID 400, 가입 조건 변경/RLS 거절 409, 조회·저장 결과 불명 500.
- 탈퇴·요청 취소는 단일 본인 행 DELETE이므로 클라이언트 직접 수행(D-10). `crew_id + user_id + 화면에서 확인한 status`로 범위를 제한하고 확인 후 실행한다. 영향 행이 없으면 성공 처리하지 않고 재조회를 안내한다. 크루장은 UI·RLS 모두 탈퇴 차단. 작업 후 상세·목록을 갱신하고 상세 재진입 때 최신 가입 상태를 조회한다.
- 구현(2026-09-25): approve/reject는 사용자 JWT로 크루장 여부를 확인하고 `crew_id + user_id + status=pending` 행만 변경한다. 승인은 글 작성 권한을 부여하지 않는다. 잘못된 ID/UUID 400, 비크루장·본인 처리 403, 없는 크루 404, 이미 처리/취소된 요청 409, DB 실패 500.
- 크루원 내보내기·글 작성 권한 토글은 클라이언트 직접 수행(D-17), RLS로 크루장만 허용. 승인된 타인 행만 대상으로 하며 권한 토글은 이전 can_post 값까지 비교한다. 거절·내보내기는 확인 UI를 거친다. 변경 후 명단·상세·목록을 갱신한다.
- 왜 서버 경유인가: 클라가 join_mode 분기를 갖지 않게 하고, 나중에 알림·정원 체크가 붙을 자리.

### 8. `GET /crews/:id/stats?period=week`
```
res  { "period": "week", "period_start": "2026-09-21", "period_end": "2026-09-27",
       "distance_m": 84200, "duration_sec": 31800, "activity_count": 23, "contributing_members": 5 }
  또는 { "hidden": true, "reason": "MIN_MEMBERS" }
```
- admin으로 approved 멤버의 `activities`를 읽되 **소유자 `activity_visibility = 'private'` 제외**, 합계만 계산. 개인 행·이름은 절대 응답에 없음.
- 기여 멤버(기간 내 기록 1건 이상) **3명 미만이면 `hidden`** (D-20).
- 크루가 없으면 404. 로그인 유저 전원 조회 가능.
- 구현(2026-09-25): `period=week|month`(기본 week), KST 기준 이번 주 월~일 또는 이번 달 1일~말일만 제공. 사용자별·종목별·임의 날짜 필터는 제공하지 않는다. 현재 승인된 멤버의 전체 종목을 합산하며 가입 전 해당 기간 기록도 포함한다.
- 사용자 JWT로 크루 존재를 확인한 다음 `services/crewStats.js`에서만 admin을 사용한다. activities → profiles → crew_members inner join으로 `public/crew` 공개 범위와 대상 크루의 approved 상태를 함께 필터한다. ID 커서로 빈 페이지까지 조회하여 행 수 제한에 따른 부분 집계를 방지한다.
- 기여 인원은 기록 행 수가 아닌 고유 작성자 수다. 3명 미만 응답에는 인원수·합계·개인 식별자를 포함하지 않는다. 일반 응답도 지정된 합계 필드만 반환한다. DB 실패는 500 `STATS_FAILED`, 서버 키 누락은 503 `CONFIG_REQUIRED`, 잘못된 크루 ID/기간은 400. HTTP 응답은 `Cache-Control: no-store`.
- 상세 화면은 이번 주/이번 달 전환·새로고침·숨김/로딩/실패를 구분한다. 조회 중·실패 시 이전 합계를 표시하지 않으며 이탈 시 통계 캐시를 제거한다. 가입·탈퇴·승인·강퇴 후 통계를 다시 조회한다.

### 9. `GET /dashboard?period=week&date=2026-09-13`

주간 조회 계약:
```json
{
  "period": "week",
  "from": "2026-09-07",
  "to": "2026-09-13",
  "totals": { "activity_count": 1, "distance_m": 5200, "duration_sec": 1860 },
  "days": [
    { "date": "2026-09-07", "activity_count": 0 },
    { "date": "2026-09-08", "activity_count": 0 },
    { "date": "2026-09-09", "activity_count": 0 },
    { "date": "2026-09-10", "activity_count": 0 },
    { "date": "2026-09-11", "activity_count": 0 },
    { "date": "2026-09-12", "activity_count": 0 },
    { "date": "2026-09-13", "activity_count": 1 }
  ],
  "recent": [{ "id": 1, "sport": "running", "performed_on": "2026-09-13", "distance_m": 5200, "duration_sec": 1860 }]
}
```
- `period`는 현재 `week`만 허용(기본값). `date`는 그 주에 포함되는 YYYY-MM-DD, 생략 시 KST 오늘. 월요일~일요일 기준.
- 사용자 JWT와 `user_id` 필터 적용. 합계와 일별 건수는 ID 커서로 해당 주 전체 기록을 순회. `recent`만 날짜·ID 내림차순 최대 50건.
- 잘못된 기간/날짜 400, 인증 실패 401, 집계 중 조회 실패 500. 부분 합계를 성공 응답으로 보내지 않는다.
- 여러 페이지 조회는 단일 DB 스냅샷이 아니다. 조회 도중 다른 기기에서 기록이 변경되면 새로고침 시 다시 집계한다.

목표 달성률·스트릭 계약 (D-21, 구현됨):
```
res  { "streak": { "current": 6, "best": 14, "today_done": false },
       "totals": { "activity_count": 4, "distance_m": 21000, "duration_sec": 9800 },
       "goals": [ { "id", "type", "sport", "target", "period", "progress": 0.62, "current": 31000 } ] }
```
- 전부 JWT(내 기록만). 스트릭은 `performed_on` KST 날짜를 중복 제거해 계산한다. 오늘 기록이 있으면 오늘부터, 없고 어제 기록이 있으면 어제부터 역산해 현재 연속일을 구한다. 따라서 오늘 운동 전에는 어제까지의 스트릭을 유지한다. 최고 연속일은 오늘까지의 전체 기록에서 계산하며 미래 날짜는 제외한다.
- 목표 진행률: 활성 goals마다 **KST 현재 주/월** 기록을 type별 합산 (`count`=기록 건수, `distance`=`distance_m`, `duration`=`duration_sec`), sport null이면 전체. 홈에서 과거 주를 조회해도 목표 기간은 현재 주/월이다.
- 클라는 `/goals`에서 본인 목표를 직접 CRUD한다. 거리 입력은 km→m, 시간은 분→초로 변환해 저장하며 생성·수정·일시 중지·재시작·삭제 후 goals와 dashboard 캐시를 함께 무효화한다.

### 10. `POST /exercises/merge`
```
req  { "from": "벤치프레스", "to": "Bench Press" }
res  { "updated": 37 }
```
- 서버는 사용자 JWT의 `req.db.rpc('merge_exercise_names', { p_from, p_to })`를 호출한다. DB 함수는 `security invoker`, 빈 search_path, 완전 수식 테이블명, `auth.uid()` 필터로 본인 이름만 단일 UPDATE한다. service_role은 사용하지 않는다.
- from/to는 앞뒤 공백 제거 후 1~100자. 대소문자를 무시한 같은 이름은 400 `INVALID_NAMES`. SQL `lower()`로 원본 이름을 비교하며 `%`, `_`, `*`도 패턴이 아닌 문자 그대로 취급한다. 날짜·중량·횟수·세트 번호는 유지한다.
- 같은 activity에 `(to, set_no)`가 이미 있으면 유니크 충돌 → 409 `CONFLICT`, 클라가 안내.
- 충돌은 전체 UPDATE를 롤백한다. 성공 응답 `updated`는 반환 행 제한과 무관한 실제 변경 세트 수다. 대상 없음은 404 `NOT_FOUND`, 권한 거부 403, 함수 미적용 503 `MIGRATION_REQUIRED`, 그 외 실패 500이다.
- 화면 `/activities/exercises`는 본인 `exercise_sets`를 커서 조회해 기존 이름·기록 수·세트 수를 표시한다. 대상 이름 선택/입력 → 영향 건수 확인 → 명시적 실행 순서. 건수는 조회 시점 기준이며 실행 시점의 해당 이름 전체에 적용한다. 실패 시 자동 재전송하지 않고, 결과 불명 시 재조회부터 안내한다.
- 목록 캐시 `['activities', userId, 'exerciseCatalog']`. 성공 후 본인 활동 루트를 무효화해 목록·상세·자동완성·관리 목록을 갱신한다. 별도 되돌리기는 없으며 다른 이름과 합친 뒤에는 원래 구분을 복구할 수 없음을 확인 화면에 안내한다.
- 기존 DB 적용 파일: `server/config/migrations/20260916_merge_exercise_names.sql`. 테스트 DB 회귀 검증: `server/config/tests/exercise_merge.sql`(ROLLBACK).

## 2. 클라 직접 접근 매핑 (supabase-js)

### 가입 이메일 인증 설정·검증 (D-12)

- Confirm email은 **ON 유지**. 가입 성공 후 세션이 없으면 `/verify-email`에서 메일 확인 안내를 표시한다. 가입과 `auth.resend({ type: 'signup' })`는 같은 `/auth/callback`을 복귀 주소로 사용한다.
- Supabase Authentication → URL Configuration의 Redirect URLs에 개발 주소 `http://localhost:5173/auth/callback`, `http://localhost:5173/reset-password`를 추가한다. `127.0.0.1`로 접속하면 해당 호스트의 두 주소도 등록한다. 배포 시 Site URL과 Redirect URLs를 실제 HTTPS 도메인으로 설정한다. 메일 템플릿은 기본 `ConfirmationURL` 링크를 사용한다.
- SDK가 인증 링크를 읽어 세션을 만든 뒤 콜백 화면에서 완료를 안내한다. 과거 메일이 `/`로 돌아오면 가입 콜백으로 보내고, `type=recovery`는 비밀번호 재설정으로 보낸다. 만료·사용된 링크는 재발송 화면으로 연결한다. 재발송 후 60초 대기, 요청 실패 시 이메일 유지, 자동 재발송 없음.
- 검증 순서: 테스트 계정 가입 → 메일 확인 안내 → 가장 최근 메일 링크 → 인증 완료 → 내 운동 → 새로고침 → 로그아웃·로그인. 만료된 링크에서는 새 메일 요청을 확인한다. 실제 메일 발송량·수신 대상은 Supabase 발송 설정을 따른다.
- AI 키는 `server/.env`의 `OPENAI_API_KEY`, 모델은 `OPENAI_MODEL`(기본 `gpt-4.1-mini`)에 설정하고 서버를 재시작한다. 프런트 환경변수에는 넣지 않는다.
- 참고: [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [인증 메일 재발송](https://supabase.com/docs/reference/javascript/auth-resend).

| 기능 | 테이블 / rpc / storage | 비고 |
|---|---|---|
| auth | `supabase.auth.*` (signUp·signInWithPassword·resetPasswordForEmail·updateUser) | signUp `options.data.nickname`·`real_name` → 가입 트리거. 닉네임은 공개 profiles, 실명은 비공개 user_settings (D-28) |
| profile | `profiles`(select 전원 / update 본인), `user_settings`(본인), `regions`(select) | 회원 페이지: `profiles` + `crew_members`(RLS가 show_crews 처리) + `activities`(RLS가 공개 3단계 처리) |
| activities | `activities`, `activity_routes`, `exercise_sets` CRUD. 헬스 생성 `rpc('save_gym_activity')`, 수정 `rpc('update_gym_activity')` | 자동완성: 본인 `exercise_sets`의 ID·운동명을 커서 조회하고 클라에서 중복 제거 |
| tracking | 종료 시 `rpc('save_tracked_activity', {...points})` — 기록+경로 한 트랜잭션 | 트래킹 중엔 DB 접근 없음. 실패 시 좌표는 화면 상태에 남아 재시도 |
| meals | `meals` CRUD | 끼니·음식 목록·메모, 본인 행만 직접 접근(D-08·D-10) |
| goals | `goals` | 달성률은 `/api/dashboard` |
| feedback | `ai_feedbacks`, `ai_feedback_history` select (생성은 API 3) | 최신 캐시와 생성별 이력, 본인만 조회 |
| crews | `crews` select·insert(트리거가 리더 행)·update·delete, `crew_members` select·delete(탈퇴·강퇴)·**update(can_post, 리더가 남의 행)**, `rpc('crew_member_count')` | 가입·승인·거절·매칭·통계는 API 4~8. can_post 토글은 단일 행 UPDATE라 클라 직접(D-10), RLS `members_update_owner`가 문지기 |
| feed | `posts`, `post_likes`, `comments` CRUD. 사진: storage `post-images` upload(`{me}/{uuid}.jpg`) → `posts.image_path` | 표시: `createSignedUrls(paths, 3600)` 배치 |

### 크루 탐색·생성·상세 (구현 ③ 첫 단계)

피드 연결: 크루 상세의 ‘크루 피드 보기’에서 `/feed?crew=:crewId`로 이동한다.

- `/crews`: 로그인 회원 대상 종목 필터, ID 내림차순 20건 커서 목록. `/crews/new`: 이름 2~40자·소개 1,000자 이하 폼 검증, `regions`의 시/도·시/군/구 쌍 선택, 요일 0~6(미선택 시 협의), 레벨 선택, open/approval 선택.
- 생성은 사용자 JWT로 `crews`에 직접 INSERT, `owner_id`는 로그인 사용자 값만 전달. `add_owner_membership` 트리거로 크루장을 approved·can_post 상태로 등록한다. 중복 제출 잠금, 실패 시 입력 보존 및 목록 확인 안내.
- `/crews/:crewId`: 크루 기본 정보, 공개 닉네임, 본인 멤버십, `crew_member_count` RPC의 승인 인원수를 조회하고 가입·요청 취소·탈퇴를 제공한다. 크루장에게만 회원 관리가 표시된다. 명단은 가입일·사용자 ID 순 50건씩 더 보기이며, 승인된 회원의 이름만 전용 RPC로 결합한다. 일반 회원에게는 실명을 조회하지 않는다.

### 피드 글 (구현 ④)

- `/feed`: public 글만 ID 내림차순 조회, `/feed?crew=:crewId`: 해당 크루의 RLS로 읽을 수 있는 글을 is_pinned 내림차순 → ID 내림차순 조회. 자유/모집/인증 필터, 20건 커서 더 보기.
- `/feed/new[?crew=:crewId]`, `/feed/:postId`, `/feed/:postId/edit`: 본문 1~5,000자·자유/모집/인증·종목 선택·공개 범위. 크루 글은 crew가 기본값이고 public 선택 시 크루 밖 공개 안내. 전체 공개란 비로그인 공개가 아닌 로그인 회원 전체 공개다.
- 클라이언트 사용자 JWT로 posts 직접 CRUD. 크루 작성은 `can_post_in_crew` RPC로 UI/제출 전 확인하고 DB RLS가 최종 차단한다. INSERT에 실제 로그인 author_id만 전달하며 고정 필드는 전달하지 않는다. 사진·운동 기록은 아래 첨부 규칙을 따른다.
- 수정은 작성자만, crew_id/author_id는 변경하지 않는다. 본문·종류·종목·공개 범위·첨부를 UPDATE하고 id/author_id/updated_at 조건으로 동시 수정 충돌을 감지한다. 기존 RLS 결정대로 작성 권한 토글은 새 크루 글 작성에 적용하며 기존 자기 글 수정 정책은 바꾸지 않는다.
- 삭제는 작성자 또는 해당 크루장만 UI 제공, DB RLS로 최종 제한. 확인 후 id/updated_at과 본인 author_id 또는 대상 crew_id로 삭제하며 영향 행이 없으면 성공 처리하지 않는다. 실패 시 입력 보존, 중복 제출 잠금, 저장 후 상세 이동 및 사용자별 목록/상세 캐시 무효화. 본문은 React 텍스트로 렌더링하며 HTML로 실행하지 않는다.
- 목록/상세/편집 원본 캐시는 조회자별이며 이탈 시 제거한다. 글 없음과 비공개 접근 불가는 동일 안내다. 기존 스키마와 RLS 사용, 추가 SQL 없음.

### 크루장 고정글 (D-18)

- 글 상세에서 크루장 본인이 작성한 크루 태그 글만 고정/해제 버튼 제공. public/crew 공개 범위와 무관하게 해당 크루 피드 상단에 정렬하며, 전체 피드에서는 고정 우선 정렬하지 않는다. 고정은 공개 범위를 변경하지 않는다.
- 변경 직전에 `is_crew_owner` RPC로 권한 재확인. 사용자 JWT로 is_pinned만 UPDATE하며 id/author_id/crew_id/updated_at/이전 is_pinned 조건을 함께 사용한다. 기존 posts UPDATE RLS도 작성자 및 고정 시 크루장 여부를 검사한다. 영향 행이 없거나 실패하면 성공 표시하지 않고 재조회를 안내한다.
- 크루 목록 커서는 `{id,is_pinned}`다. 고정 구간에서는 `(is_pinned=true AND id<cursor.id) OR is_pinned=false`, 일반 구간에서는 `is_pinned=false AND id<cursor.id`로 다음 페이지를 읽는다. 종목이 아닌 글 종류 필터와 크루 ID 조건은 모든 페이지에 유지한다. 전체 피드는 기존 ID 커서를 사용한다.
- 고정/해제 후 사용자별 피드·상세 캐시 갱신, 중복 클릭 잠금, 고정 표시와 성공/실패 안내. 다른 기기에서 고정 상태가 바뀌면 페이지 간 스냅샷이 아니므로 피드 새로고침으로 순서를 다시 조회한다. 추가 SQL 없음.

### 댓글·좋아요

- 글 상세에서 사용자 JWT로 comments/post_likes 직접 접근. 기존 RLS가 글 가시성을 댓글·좋아요 SELECT/INSERT에 적용한다. 모든 앱 변경 요청 전에 posts를 다시 조회해 삭제/접근 권한 변경 시 중단한다. 기존 DB의 본인 UPDATE/DELETE 정책 자체를 변경한 것은 아니다.
- 좋아요는 (post_id,user_id) 유일 키로 중복 방지. count=exact HEAD와 본인 행으로 총수/눌렀는지를 조회하고, 원하는 상태를 INSERT 또는 본인 행 DELETE로 반영한다. 중복 INSERT 23505는 이미 눌린 상태로 처리한다. 회원 명단은 user_id 오름차순 20건 커서, 닉네임만 표시하며 글을 볼 수 있는 회원에게 제공한다(D-18).
- 댓글은 본문 trim 후 1~1,000자 UI/서비스 검증, id 오름차순 20건 커서. 작성자만 수정 가능하며 content만 갱신, id/post_id/author_id/updated_at 조건으로 충돌을 감지한다. 삭제는 작성자 또는 해당 크루장, 최신 글의 크루장 정보를 재확인하고 id/post_id/updated_at으로 삭제한다. 글 작성자는 남의 댓글 삭제 권한을 자동으로 얻지 않는다.
- 삭제 전 확인, 실패 시 입력 유지, 요청 중 중복 클릭 잠금. 댓글·좋아요 전용 사용자/글별 캐시를 갱신하고 상세를 떠나면 제거한다. 조회 실패를 0건 성공으로 표시하지 않는다. DB 권한 최종 검증은 실제 계정 간 RLS 테스트로 별도 확인한다.

### 피드 운동 기록 첨부

- 내 기록만 ID 내림차순 20건씩 선택한다. 선택 시 인증글·기록 종목으로 기본값을 변경하고 저장 직전 user_id+id로 소유권/존재를 재확인한다. DB posts RLS도 본인 기록만 허용한다. 인증글에 첨부는 필수가 아니다(D-18).
- 사진과 기록을 함께 첨부할 수 있다. 기록 변경 시 종목은 원본 종목으로 저장한다. 첨부 해제는 activity_id=null. GPS 경로는 기본 OFF인 별도 체크박스로 공유하며 첨부 기록을 바꾸면 OFF로 초기화한다. 기존 글 수정은 저장된 선택을 유지한다. ON 저장 전 본인 야외 종목 및 경로 존재를 확인하고 전체 공개 선택 시 위치 노출을 안내한다.
- 상세는 읽을 수 있는 posts 행에서 activity_id를 다시 얻은 다음 활동 요약을 조회한다. 날짜·종목·시간·거리와 헬스 운동명/세트/횟수/중량을 표시하며 세트는 커서로 전부 읽는다. 메모는 조회하지 않는다. GPS는 별도 컴포넌트가 현재 글의 include_route를 다시 확인한 후 RLS로 읽고, OFF이면 경로 조회를 하지 않는다.
- 기존 activities/sets RLS는 글을 볼 수 있는 사용자에게 첨부 원본 기록을 허용한다. 프로필의 private 설정과 별개로 글 범위에서 메모·세트를 포함한 기록을 공유할 수 있음을 선택 시 안내한다. UI에서 메모를 표시하지 않는 것과 DB 읽기 권한은 구분한다.
- 스냅샷이 아닌 원본 참조이므로 재조회 시 수정된 값이 반영된다. 원본 삭제는 기존 FK/트리거로 첨부 해제되며 글·사진은 유지된다. 읽기 실패와 삭제/권한 없음 상태를 구분해 안내한다. 추가 SQL 없음.

### 피드 사진 1장 (D-26)

- JPG/PNG/WebP 원본 1장, 클라이언트에서 MIME·0초과~5MB 크기 검사. SVG는 받지 않는다. 메타데이터는 제거하지 않으며 업로드 전 위치 등 원본 메타데이터 확인을 안내한다. MIME/크기 검사는 UI 검증이며 서버의 파일 보안 검사를 대체하지 않는다.
- 저장 시 `post-images` 비공개 버킷에 `{userId}/{randomUUID}.{jpg|png|webp}`로 upload(upsert=false) 후 `posts.image_path` 저장. 선택 직후에는 로컬 object URL로 미리보기하고 교체/이탈 시 해제한다. 업로드 실패 시 글을 쓰지 않고 입력을 유지한다. 업로드 성공 후 글 저장 실패 시 같은 업로드 경로를 재사용한다.
- 수정에서 사진 미변경이면 image_path를 UPDATE하지 않는다. 교체는 새로운 경로, 첨부 해제는 null. 글 저장 실패/응답 불명일 때 객체를 자동 삭제하지 않는다. 교체된 사진·삭제된 글·취소한 업로드의 고아 객체 정리는 기존 D-26대로 Post-MVP이며 즉시 물리 삭제를 보장하지 않는다.
- 목록은 경로를 중복 제거해 createSignedUrls로 배치 조회, 상세/편집도 동일 경로를 사용한다. 서명 시 Storage RLS 적용. URL 유효기간 1시간, 열린 화면에서 50분마다 갱신, 실패 시 재조회 버튼. 사용자별 캐시·이탈 시 제거, 공개 URL fallback 없음.
- 이미 발급된 서명 URL은 공개 범위 변경·첨부 해제 후에도 만료 전까지 유효할 수 있다. 새 URL 발급 권한과 기존 URL의 유효기간은 별개다. 목록·상세·편집에 사진 표시, 로딩·권한/조회 실패 안내를 제공한다.

### 내 운동 기록 목록·새 기록

### GPS 기록·지도 (2026-09-30)

- 수동 입력 화면의 야외 3종목에서 ‘GPS로 측정하기’ → `/activities/track?sport=running|walking|cycling`. 시작 버튼에서만 `watchPosition`을 요청한다. 첫 유효 좌표부터 단조 시계로 시간 측정, 활성 상태는 지도 없는 검정 화면으로 표시한다. 가능한 브라우저에서는 Screen Wake Lock을 요청하고 종료·이탈 시 watch와 잠금을 해제한다. 화면이 숨겨지면 측정을 종료하며 재개 구간을 자동 연결하지 않는다. 새로고침/이탈 시 미저장 기록은 사라짐을 안내하고 문서 이탈 경고를 등록한다. SPA 뒤로가기의 기록 복구는 제공하지 않는다.
- 좌표 형식은 기존 `[[lat,lng,epoch_ms], …]`. 정확도 50m 초과·20초 이상 오래된 좌표·중복/역순 시각·비정상 좌표 제외, 3m 미만 이동 무시. 속도 상한 걷기 6/러닝 12/자전거 35m/s, 30초 초과 단절은 거리/폴리라인 연결 제외. 최대 10,000점·6시간. 거리 보정 상수는 실제 야외 테스트로 조정할 대상이다.
- 종료 후 2점/1초 이상일 때 기존 `save_tracked_activity` RPC 한 번으로 활동+경로 저장. UTC 시작 시각·KST 운동 날짜·초·정수 m 사용. 자동 재시도 없음, 실패 시 측정값/메모 유지와 중복 저장 확인 안내. RPC 성공 ID를 받은 뒤에는 후속 처리 재시도 시 RPC를 다시 호출하지 않는다. 응답 유실 시의 중복 방지는 DB 멱등키가 없어 보장하지 않는다.
- 본인 상세는 소유자 확인 후 `activity_routes` 조회. 회원 프로필에는 연결하지 않는다. 피드 공유는 위 명시적 include_route 선택과 기존 RLS를 따름. 좌표 캐시는 조회자 ID를 포함하고 이탈 시 제거한다.
- 지도 설정: `client/.env`의 `VITE_NAVER_MAP_CLIENT_ID`에 네이버 클라우드 Maps의 **Client ID(ncpKeyId)**를 넣고 개발 서버를 재시작한다. 네이버 클라우드 콘솔의 Maps 애플리케이션에서 Web Dynamic Map을 선택하고 실제 웹 서비스 URL을 등록한다. Client Secret은 클라이언트에 넣지 않는다. 키가 없거나 SDK 로딩 실패 시 지도 배경 없는 경로 모양과 재시도 버튼을 제공한다. 현재 로컬에는 키가 없어 실제 지도 검증은 남아 있다.
- 휴대폰 테스트는 HTTPS 환경에서 위치 권한 허용 후 진행한다. 실외 이동→종료→저장→새로고침 후 경로 유지, 화면 잠금/앱 전환 종료, 위치 거부/신호 단절, 공개 글/크루 글의 타 계정 경로 권한을 확인한다. 자동 브라우저 검사는 모의 위치·SDK·DB로 수행했으며 실제 GPS 정확도나 원격 RLS 검증을 대체하지 않는다.
- API 참고: [Geolocation watchPosition](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition), [Screen Wake Lock](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API), [네이버 지도 API 시작하기](https://navermaps.github.io/maps.js.ncp/docs/tutorial-2-Getting-Started.html).

### 수동 기록·목록

- `/activities`는 목록, `/activities/new`는 입력 화면이다. 홈의 종목 바로가기는 `/activities/new?sport=...`을 사용한다. 생성·수정·목록 필터 모두 러닝·걷기·자전거·수영·헬스·기타 6종목을 지원한다.
- 생성·수정의 시간 입력은 ‘운동 시간’ 아래 분·초 두 칸이며 `duration_sec = 분 × 60 + 초`로 저장한다. 분은 0 이상 정수, 초는 0~59 정수, 합계는 int 범위 이내. 생성은 1초 이상, 수정은 기존 0초 기록도 유지할 수 있다.
- 러닝·걷기·자전거는 km 입력 → m 저장, 수영은 정수 m 입력이다. 수영의 선택 랩 수(0~10,000, 편도 한 번 = 1랩)는 `details.lap_count`에 저장한다. 기타는 시간·메모만 입력한다.
- 목록 필터는 `sport`, `from`, `to` 쿼리 문자열로 보관한다. 기본은 전체 종목·전체 기간. 양 끝 날짜를 포함하며, 실제 달력 날짜·종목 허용 목록·시작일 ≤ 종료일을 검사한다. 잘못된 URL 조건이면 조회하지 않고 안내한다.
- 본인 `activities`만 사용자 세션·RLS와 `user_id` 필터로 조회한다(D-10). 정렬은 `performed_on DESC, id DESC`, 20건씩 표시. 날짜+ID 커서로 다음 페이지를 조회하고 한 건을 더 확인해 ‘더 보기’ 여부를 결정한다.
- 쿼리 키는 `['activities', userId, 'list', { sport, from, to }]`. 필터 변경 시 별도 캐시를 쓰며, 모든 요청에 같은 필터를 적용한다. 추가 조회 실패 시 기존 목록을 유지하고 재시도를 제공한다. 여러 페이지는 단일 DB 스냅샷이 아니므로 다른 기기에서 날짜를 수정한 경우 새로고침해 재조회한다.
- 목록에서 상세·수정으로 이동할 때 목록 주소를 history state로 전달한다. 취소·목록 복귀·수정/삭제 성공 후 해당 필터로 돌아온다. 홈에서 진입한 수정/삭제는 기존처럼 해당 주 홈으로 돌아간다. 새 기록 저장은 필터에 가려지지 않도록 기록 날짜의 홈으로 이동한다.
- 기록 행에는 날짜·종목·시간·거리(값이 있는 경우)·메모 첫 줄만 표시한다. 빈 목록과 필터 결과 없음, 최초 로딩 실패, 추가 로딩 실패를 구분한다. 이 화면에 대한 DB 마이그레이션은 없다.

### 내 식단 기록 CRUD (D-08)

- 경로는 목록 `/meals`, 작성 `/meals/new`, 상세 `/meals/:mealId`, 수정 `/meals/:mealId/edit`다. 상단 `기록` 메뉴 아래에서 운동·식단 보조 탭을 공유하며 하위 화면에서도 `기록`을 활성 상태로 유지한다.
- 본인 `meals`만 사용자 세션·RLS와 `user_id` 필터로 직접 조회·생성·수정·삭제한다(D-10). 생성 시 `user_id`는 로그인 사용자 ID로 덮어쓰고, 수정·삭제는 식별자와 사용자 ID를 모두 조건으로 사용한다. 영향 행이 없으면 성공으로 처리하지 않는다.
- 저장 구조는 `eaten_on`, `meal_type`(`breakfast`·`lunch`·`dinner`·`snack`), `items` JSON 배열, `note`다. 음식은 1~30개이며 이름은 필수 1~100자, 양은 선택 100자 이하, 칼로리는 선택 정수 0~100,000이다. 외부 음식·칼로리 DB 조회나 자동 영양 계산은 하지 않는다.
- 목록은 `eaten_on DESC, id DESC`로 20건씩 표시하고 날짜+ID 커서를 사용한다. 모든 추가 요청에 사용자 필터를 반복 적용하며, 추가 조회 실패 시 기존 목록을 유지한다. 여러 페이지는 단일 DB 스냅샷이 아니므로 다른 기기의 변경은 새로고침으로 다시 맞춘다.
- 쿼리 키는 목록 `['meals', userId, 'list']`, 상세 `['meals', userId, 'detail', mealId]`다. 저장·수정·삭제 후 해당 사용자의 meals 루트만 무효화한다. 대시보드는 식단을 집계하지 않으므로 갱신 대상이 아니다.
- 없는 기록과 다른 회원 기록은 같은 찾을 수 없음 화면으로 처리한다. 저장 실패 시 입력값, 삭제 실패 시 확인창을 유지하고 자동 재전송하지 않는다. 저장·삭제 중 중복 요청을 막는다. 기존 `meals` 스키마와 소유자 RLS를 사용하므로 추가 DB 마이그레이션은 없다.

### 헬스 운동명 자동완성 (D-05)

- 생성·수정 폼에서 내 기존 운동명을 먼저, 정적 기본 운동 30개를 다음으로 추천한다. 앞뒤 공백·대소문자만 무시해 중복 제거하고 부분 문자열로 검색한다. 최대 8개 표시, 목록에 없는 이름도 직접 입력·저장 가능하다.
- 운동명 첫 포커스에 본인 `exercise_sets`의 `id,exercise_name`을 ID 내림차순 커서로 조회한다. 매 페이지 `user_id` 필터와 사용자 세션·RLS를 적용한다. 새 테이블·RPC·서버 권한 추가는 없다.
- 쿼리 키 `['activities', userId, 'exerciseNames']`, 5분 staleTime. 생성·수정·삭제 후 활동 루트 무효화에 포함된다. 내 기록 조회 실패 시 안내·재시도를 제공하며 기본 추천·직접 입력은 유지한다.
- 방향키 이동, Enter 선택, Escape 닫기, Tab 다음 필드 이동, 터치 선택을 지원한다. 한글 조합 중 Enter는 추천 선택으로 처리하지 않는다.

### 내 운동 기록 상세

- 화면 경로: `/activities/:activityId`. 홈 기록 행에서 이동하며 로그인 필수.
- `activities`에서 ID와 본인 `user_id`로 조회. 헬스는 `exercise_sets`도 활동 ID와 본인 ID로 조회하고, ID 커서로 전체 세트를 가져온다. 두 조회 모두 사용자 세션·RLS 적용(D-10).
- 상세 쿼리 키는 `['activities', userId, 'detail', activityId]`. 운동명은 대소문자 무시로 묶고 세트 번호 순서로 표시한다.
- 없는 기록과 다른 회원 기록은 동일한 찾을 수 없음 화면. 조회 실패는 재시도 화면으로 구분하며, 세트 0건으로 대체하지 않는다. 중량 0kg와 미입력(NULL)은 다르게 표시한다.
- 복귀 링크는 진입한 기록 목록의 필터를 유지한다. 홈에서 진입했다면 해당 기록 날짜의 홈 주간 목록으로 이동한다.

### 내 운동 기록 수정·삭제

- 수정 경로: 로그인 필수 `/activities/:activityId/edit`. 본인 기록을 불러와 해당 종목 폼에 채운다. 종목·소유자는 바꾸지 않는다. 기존 초 단위 시간과 미입력(NULL)/0을 구별해 유지한다.
- 헬스 외: 본인 ID·활동 ID·sport 필터로 `activities`의 날짜·시간·메모와 해당 종목의 거리만 UPDATE한다. 수영은 랩 변경 시 `details.lap_count`만 추가·변경·삭제하고 다른 details 키는 보존한다.
- 헬스: `rpc('update_gym_activity', { p_activity_id, p_performed_on, p_duration_sec, p_note, p_sets })`. 부모 행을 잠그고 공통 필드와 전체 세트(1~100개)를 한 트랜잭션으로 교체한다. 사용자 JWT·security invoker·RLS 적용, 실패 시 전체 롤백. 없는 기록·타인 기록·헬스 아닌 기록은 모두 SQLSTATE `P0002`.
- 삭제: 상세의 확인창에서 확정하면 본인 ID·활동 ID로 부모 `activities` 한 행을 DELETE한다. FK가 세트·경로를 함께 삭제하고 게시글은 유지하며 첨부만 NULL로 바꾼다. `clear_detached_post_route` 트리거는 이때 `include_route=false`도 함께 적용해 기존 CHECK를 만족시킨다.
- 수정/삭제 영향 행이 없으면 성공으로 처리하지 않는다. 실패 시 입력 또는 확인창을 유지하고 결과를 안내한다. 저장·삭제 중 중복 요청을 막는다.
- 성공 시 현재 사용자의 활동/대시보드 쿼리를 모든 주에 걸쳐 무효화한다. 목록 진입이면 해당 필터로 복귀한다. 홈 진입이면 수정 후 새 날짜가 속한 주로, 삭제 후 원래 기록이 속했던 주로 돌아간다.
- 기존 DB에는 `server/config/migrations/20260914_update_gym_activity.sql`만 적용한다. 함수 미적용(`PGRST202`)은 수정 폼에서 안내한다. 실행 검증은 테스트 DB에서 `server/config/tests/activity_mutations.sql`을 사용한다(테스트 데이터 생성 후 ROLLBACK).

### 실명 입력·조회 (D-28)

- 가입: `auth.signUp({ email, password, options: { data: { nickname, real_name } } })`. 가입 트리거가 trim·길이·제어문자를 검사하고 `user_settings.real_name`에 저장. 기존 계정은 NULL일 수 있다.
- 본인: `/api/me`의 `settings.real_name` 읽기. `user_settings`에서 본인 행의 `real_name`만 UPDATE. 공개 프로필·배번표에는 여전히 닉네임만 표시한다.
- 크루장: `supabase.rpc('crew_member_names', { p_crew_id: crewId })` → `[{ user_id, real_name }]`. 자기 크루의 approved 회원만. 비소유자·없는 크루는 SQLSTATE `42501`, 비로그인은 실행 권한 없음. `user_id`로 기존 닉네임 명단과 결합하되 실명 캐시 키에는 **조회자 ID와 crewId**를 포함한다. 명단 화면은 gcTime=0으로 이탈 시 캐시를 제거하고 변경 성공 후 명단을 비워 재조회한다. 로그아웃 시에는 기존 인증 흐름에서 캐시 전체를 제거한다.
- RPC는 user_settings 전체 읽기 권한을 주지 않는다. 목표·지역·이메일 등은 반환하지 않는다. 사용자 메타데이터의 역할 값은 권한 판단에 사용하지 않는다.

## 3. 서버 파일 배치

### GPS 측정 보관 (2026-10-03)

- 클라이언트는 사용자 JWT로 `gps_drafts`를 조회한다. 목록은 좌표를 제외한 메타데이터만 최대 50건 조회하며, 직접 기록 화면에서는 한국 날짜·종목으로 필터링한다. 상세 좌표는 본인만 조회 가능하다.
- `save_gps_draft(p_id uuid, p_sport text, p_started_at timestamptz, p_duration_sec integer, p_distance_m integer, p_note text, p_points jsonb) → uuid`: 한 측정에 같은 UUID를 재사용한다. 소유자와 한국 날짜는 DB에서 결정하며, 이미 보관된 측정은 덮어쓰지 않는다.
- `finalize_gps_draft(p_id uuid, p_note text default null) → bigint`: 본인 보관 측정을 잠근 뒤 운동·경로를 원자적으로 생성한다. 재호출은 기존 운동 ID를 반환한다. 이미 저장했던 운동을 삭제한 경우 새로 만들지 않는다.
- 두 RPC만 `SECURITY DEFINER`를 사용하며 `auth.uid()` 직접 검증, 빈 `search_path`, 스키마 명시, authenticated 전용 실행 권한으로 제한한다. 테이블 INSERT/UPDATE 권한은 부여하지 않는다. SELECT/미완료 DELETE만 소유자 RLS로 허용한다.
- 보관 단계에는 activities에 행을 만들지 않아 통계·목표·피드 첨부 후보에서 제외된다. 최종 저장 후 관련 캐시를 무효화한다. 새 서버 HTTP API나 서비스 역할 키는 사용하지 않는다.

### 회원 페이지·공개 설정 (2026-09-30)

- `/users/:id`는 사용자 JWT로 `profiles` 공개 필드만 조회한다. 실명·지역·선호 요일·목표 메모 및 GPS 경로는 조회하지 않는다.
- 승인된 `crew_members`와 운동 기록 요약(종목·날짜·시간·거리)을 각각 20건씩 커서 조회한다. 가시성은 기존 RLS가 결정한다. `show_crews=false`여도 함께 가입한 크루는 보일 수 있으며, private 기록도 볼 수 있는 글에 첨부했다면 공유될 수 있다. 조회 실패와 빈 결과를 구분한다.
- `/me`에서 본인의 닉네임·`activity_visibility`·`show_crews`를 단일 UPDATE한다. 실패 시 입력 유지, 중복 요청 차단, 성공 시 본인 프로필·회원 페이지·피드·크루 통계 캐시 무효화. 다른 브라우저의 이미 표시된 화면을 실시간 회수하지는 않으며 다음 조회에 RLS가 반영된다.
- 회원 캐시 키에는 조회자와 대상 회원 ID를 모두 포함하고 이탈 시 제거한다. 추가 서버 API·스키마 변경 없음.

```
server/
├── index.js               app 조립, /health, 라우터 마운트
├── routes/
│   ├── me.js              2
│   ├── feedback.js        3
│   ├── crews.js           4~8
│   ├── dashboard.js       9
│   └── exercises.js       10
├── services/
│   ├── llm.js             LLM 호출 래퍼 (모델명·키·재시도)
│   ├── feedback.js        프롬프트 조립 + ai_feedbacks upsert   ← supabaseAdmin 허용 ①
│   ├── matching.js        D-16 필터·완화 (순수 함수, 입력: 내 축 + 크루 배열)
│   ├── crewStats.js       집계 + hidden 규칙                     ← supabaseAdmin 허용 ②
│   └── dashboard.js       스트릭·달성률 (순수 함수, 입력: 기록 배열 + goals)
├── middleware/auth.js     requireAuth → req.user, req.db
└── config/supabase.js     createUserClient(token), supabaseAdmin
```
- `services/` = **Express와 분리된 애플리케이션 로직** (DB·LLM 접근 포함). 그 안에서 순수 계산(`matching.js`의 필터·완화, `dashboard.js`의 스트릭·달성률, `feedback.js`의 프롬프트 조립)은 DB를 모르는 함수로 분리해 HTTP 없이 케이스 테스트 (CLAUDE.md AI 방침의 "여러 케이스 확인").
