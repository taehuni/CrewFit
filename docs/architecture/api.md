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

### 9. `GET /dashboard?period=week`
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
- `update exercise_sets set exercise_name = :to where lower(exercise_name) = lower(:from)` — JWT라 RLS가 본인 행으로 자름(D-15 시나리오). `to`는 trim 후 CHECK 통과해야 함.
- 같은 activity에 `(to, set_no)`가 이미 있으면 유니크 충돌 → 409 `CONFLICT`, 클라가 안내.

## 2. 클라 직접 접근 매핑 (supabase-js)

| 기능 | 테이블 / rpc / storage | 비고 |
|---|---|---|
| auth | `supabase.auth.*` (signUp·signInWithPassword·resetPasswordForEmail·updateUser) | 닉네임은 signUp `options.data.nickname` → 가입 트리거 |
| profile | `profiles`(select 전원 / update 본인), `user_settings`(본인), `regions`(select) | 회원 페이지: `profiles` + `crew_members`(RLS가 show_crews 처리) + `activities`(RLS가 공개 3단계 처리) |
| activities | `activities`, `activity_routes`, `exercise_sets` CRUD. 헬스 저장은 `rpc('save_gym_activity', {...})` | 자동완성: `exercise_sets` select `distinct exercise_name` where user_id = me |
| tracking | 종료 시 `rpc('save_tracked_activity', {...points})` — 기록+경로 한 트랜잭션 | 트래킹 중엔 DB 접근 없음. 실패 시 좌표는 화면 상태에 남아 재시도 |
| meals | `meals` | |
| goals | `goals` | 달성률은 `/api/dashboard` |
| feedback | `ai_feedbacks` select (생성은 API 3) | |
| crews | `crews` select·insert(트리거가 리더 행)·update·delete, `crew_members` select·delete(탈퇴·강퇴)·**update(can_post, 리더가 남의 행)**, `rpc('crew_member_count')` | 가입·승인·거절·매칭·통계는 API 4~8. can_post 토글은 단일 행 UPDATE라 클라 직접(D-10), RLS `members_update_owner`가 문지기 |
| feed | `posts`, `post_likes`, `comments` CRUD. 사진: storage `post-images` upload(`{me}/{uuid}.jpg`) → `posts.image_path` | 표시: `createSignedUrls(paths, 3600)` 배치 |

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
