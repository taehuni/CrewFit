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
res  { "id": 12, "period": "week", "period_start": "2026-08-31", "content": "…", "model": "claude-…",
       "created_at": "…", "cached": true, "regen_count": 1, "regen_limit": 3 }
```
- **기준일은 서버가 계산** (`date` → day: 그대로 / week: 그 주 월요일 / month: 1일, KST). 클라가 준 날짜를 그대로 저장하지 않음 — 같은 주가 두 행이 되는 것 방지. DB CHECK가 재검증.
- **호출 흐름 (D-06)**: 프롬프트를 조립 → `source_hash = sha256(프롬프트 문자열 + 모델명)` (입력 목록을 따로 관리하지 않음 — 프롬프트에 들어간 건 전부 자동 포함, 템플릿·모델 변경도 잡힘) → 기존 행과 같고 `force`가 아니면 **LLM 호출 없이 기존 행 반환** (`cached: true`, 즉시). 다르면 생성 후 upsert(`llm_calls + 1`). `force: true`면 무조건 생성, `regen_count + 1`, `llm_calls + 1`; `regen_count`가 이미 3이면 **429 `REGEN_LIMIT`**. 클라는 화면 열 때 force 없이 호출, "다시 생성 (n/3)" 버튼이 force.
- **비용 상한**: 실제 LLM 호출(캐시 반환 제외, force 여부 무관)을 서버 in-memory `Map`으로 **사용자당 분당 5회 · 일일 20회** 제한, 초과 429 `RATE_LIMIT`. 데이터를 조금씩 바꿔 해시를 갈아도 일일 상한에 걸림. 단일 인스턴스 전제·재시작 시 리셋 — 사용자 늘거나 인스턴스 늘면 `llm_usage` 테이블로 교체(그때 `llm_calls` 누계가 상한값 근거).
- 읽기(JWT): 해당 기간 `activities`(+`exercise_sets`)·`meals`·활성 `goals`·`profiles.main_sport`·`user_settings.goal_note`.
- 쓰기(admin): `ai_feedbacks` upsert on `(user_id, period, period_start)` — `user_id`는 **반드시 `req.user.id`** (요청 본문에서 받지 않음).
- 기록이 0건이면 400 `NO_DATA`.

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

### 5~7. 멤버십
```
POST /crews/:id/join     req {}                      res { "status": "approved" | "pending" }
POST /crews/:id/approve  req { "user_id": "uuid" }   res { "ok": true }
POST /crews/:id/reject   req { "user_id": "uuid" }   res { "ok": true }
```
- 전부 `req.db`(JWT)로 `crew_members`에 insert/update/delete. **권한 판단은 RLS가 함** — self-approve·남의 크루 승인은 RLS 거부 → 403.
- join: 서버는 `crews.join_mode`만 읽어 status를 정해 insert (RLS `members_insert_join`이 이중 검증).
- 왜 서버 경유인가: 클라가 join_mode 분기를 갖지 않게 하고, 나중에 알림·정원 체크가 붙을 자리.

### 8. `GET /crews/:id/stats?period=week`
```
res  { "period": "week", "period_start": "2026-09-01",
       "distance_m": 84200, "duration_sec": 31800, "activity_count": 23, "contributing_members": 5 }
  또는 { "hidden": true, "reason": "MIN_MEMBERS" }
```
- admin으로 approved 멤버의 `activities`를 읽되 **소유자 `activity_visibility = 'private'` 제외**, 합계만 계산. 개인 행·이름은 절대 응답에 없음.
- 기여 멤버(기간 내 기록 1건 이상) **3명 미만이면 `hidden`** (D-20).
- 크루가 없으면 404. 로그인 유저 전원 조회 가능.

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

후속 확장 계약 (D-21, 스트릭·목표 구현 시 추가):
```
res  { "streak": { "current": 6, "best": 14, "today_done": false },
       "totals": { "activity_count": 4, "distance_m": 21000, "duration_sec": 9800 },
       "goals": [ { "id", "type", "sport", "target", "period", "progress": 0.62, "current": 31000 } ] }
```
- 전부 JWT(내 기록만). 스트릭: `performed_on` KST 기준 연속 일수, 오늘은 유예(어제까지 이어졌으면 유지) (D-21).
- 목표 진행률: 활성 goals마다 이번 주/월 기록을 type별 합산 (`count`=건수, `distance`=`distance_m`, `duration`=`duration_sec`), sport null이면 전체.

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

| 기능 | 테이블 / rpc / storage | 비고 |
|---|---|---|
| auth | `supabase.auth.*` (signUp·signInWithPassword·resetPasswordForEmail·updateUser) | signUp `options.data.nickname`·`real_name` → 가입 트리거. 닉네임은 공개 profiles, 실명은 비공개 user_settings (D-28) |
| profile | `profiles`(select 전원 / update 본인), `user_settings`(본인), `regions`(select) | 회원 페이지: `profiles` + `crew_members`(RLS가 show_crews 처리) + `activities`(RLS가 공개 3단계 처리) |
| activities | `activities`, `activity_routes`, `exercise_sets` CRUD. 헬스 생성 `rpc('save_gym_activity')`, 수정 `rpc('update_gym_activity')` | 자동완성: 본인 `exercise_sets`의 ID·운동명을 커서 조회하고 클라에서 중복 제거 |
| tracking | 종료 시 `rpc('save_tracked_activity', {...points})` — 기록+경로 한 트랜잭션 | 트래킹 중엔 DB 접근 없음. 실패 시 좌표는 화면 상태에 남아 재시도 |
| meals | `meals` | |
| goals | `goals` | 달성률은 `/api/dashboard` |
| feedback | `ai_feedbacks` select (생성은 API 3) | |
| crews | `crews` select·insert(트리거가 리더 행)·update·delete, `crew_members` select·delete(탈퇴·강퇴)·**update(can_post, 리더가 남의 행)**, `rpc('crew_member_count')` | 가입·승인·거절·매칭·통계는 API 4~8. can_post 토글은 단일 행 UPDATE라 클라 직접(D-10), RLS `members_update_owner`가 문지기 |
| feed | `posts`, `post_likes`, `comments` CRUD. 사진: storage `post-images` upload(`{me}/{uuid}.jpg`) → `posts.image_path` | 표시: `createSignedUrls(paths, 3600)` 배치 |

### 내 운동 기록 목록·새 기록

- `/activities`는 목록, `/activities/new`는 입력 화면이다. 홈의 종목 바로가기는 `/activities/new?sport=...`을 사용한다. 생성·수정·목록 필터 모두 러닝·걷기·자전거·수영·헬스·기타 6종목을 지원한다.
- 생성·수정의 시간 입력은 ‘운동 시간’ 아래 분·초 두 칸이며 `duration_sec = 분 × 60 + 초`로 저장한다. 분은 0 이상 정수, 초는 0~59 정수, 합계는 int 범위 이내. 생성은 1초 이상, 수정은 기존 0초 기록도 유지할 수 있다.
- 러닝·걷기·자전거는 km 입력 → m 저장, 수영은 정수 m 입력이다. 수영의 선택 랩 수(0~10,000, 편도 한 번 = 1랩)는 `details.lap_count`에 저장한다. 기타는 시간·메모만 입력한다.
- 목록 필터는 `sport`, `from`, `to` 쿼리 문자열로 보관한다. 기본은 전체 종목·전체 기간. 양 끝 날짜를 포함하며, 실제 달력 날짜·종목 허용 목록·시작일 ≤ 종료일을 검사한다. 잘못된 URL 조건이면 조회하지 않고 안내한다.
- 본인 `activities`만 사용자 세션·RLS와 `user_id` 필터로 조회한다(D-10). 정렬은 `performed_on DESC, id DESC`, 20건씩 표시. 날짜+ID 커서로 다음 페이지를 조회하고 한 건을 더 확인해 ‘더 보기’ 여부를 결정한다.
- 쿼리 키는 `['activities', userId, 'list', { sport, from, to }]`. 필터 변경 시 별도 캐시를 쓰며, 모든 요청에 같은 필터를 적용한다. 추가 조회 실패 시 기존 목록을 유지하고 재시도를 제공한다. 여러 페이지는 단일 DB 스냅샷이 아니므로 다른 기기에서 날짜를 수정한 경우 새로고침해 재조회한다.
- 목록에서 상세·수정으로 이동할 때 목록 주소를 history state로 전달한다. 취소·목록 복귀·수정/삭제 성공 후 해당 필터로 돌아온다. 홈에서 진입한 수정/삭제는 기존처럼 해당 주 홈으로 돌아간다. 새 기록 저장은 필터에 가려지지 않도록 기록 날짜의 홈으로 이동한다.
- 기록 행에는 날짜·종목·시간·거리(값이 있는 경우)·메모 첫 줄만 표시한다. 빈 목록과 필터 결과 없음, 최초 로딩 실패, 추가 로딩 실패를 구분한다. 이 화면에 대한 DB 마이그레이션은 없다.

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
- 크루장: `supabase.rpc('crew_member_names', { p_crew_id: crewId })` → `[{ user_id, real_name }]`. 자기 크루의 approved 회원만. 비소유자·없는 크루는 SQLSTATE `42501`, 비로그인은 실행 권한 없음. `user_id`로 기존 닉네임 명단과 결합하되 실명 캐시 키에는 **조회자 ID와 crewId**를 포함하고 로그아웃·크루 변경 시 제거한다. 명단 화면 연결은 크루 기능 단계에서 수행한다.
- RPC는 user_settings 전체 읽기 권한을 주지 않는다. 목표·지역·이메일 등은 반환하지 않는다. 사용자 메타데이터의 역할 값은 권한 판단에 사용하지 않는다.

## 3. 서버 파일 배치

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
