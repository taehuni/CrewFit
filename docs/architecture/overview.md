# CrewFit 아키텍처 개요

> 설계 세션(단계 1~4) 산출물의 입구. 결정 근거는 [`decisions.md`](decisions.md), 스키마·RLS 전문은 [`schema.md`](schema.md), 서버 API는 [`api.md`](api.md).
> 구현 중 여기와 어긋나는 게 생기면 **코드가 아니라 문서를 먼저 고친다** (ADR 항목 수정 + 확신도 조정).

## 1. 한 장 그림

```
브라우저 (React + supabase-js)
 │
 ├─ ① 클라 직접 ──────────────► Supabase (Postgres + Auth + Storage)
 │    단일 테이블 · 내 범위 CRUD           RLS가 기본 권한선
 │    rpc: save_gym_activity
 │
 └─ ② Express /api/* ─┬─ 사용자 JWT ──► Supabase (RLS 적용)   ← 기본
      "서버만 할 수 있는 동작"  └─ service_role ► Supabase (RLS 우회)  ← services/ 열거 파일 2곳만, 여기선 서버 코드가 권한선
                                          + LLM API (비밀키)
```

- **어디로 가나 규칙 (D-10)**: 한 유저 범위의 단일 테이블 CRUD → ①. 비밀키·다중 유저 데이터·집계·일괄 UPDATE → ②.
- **서버도 사용자 토큰 (D-15)**: ②도 기본은 요청의 JWT로 RLS 적용 클라이언트. `supabaseAdmin`은 크루 집계(`services/crewStats.js`)와 AI 피드백 저장(`services/feedback.js`) 둘만.
- **세션 (D-12)**: supabase-js가 localStorage에 관리. 서버는 `requireAuth`에서 `getUser(token)` 검증만.

## 2. 도메인 요약

| 영역 | 핵심 | 결정 |
|---|---|---|
| 기록 | 6종목(running·walking·cycling·swimming·gym·other). 공통 뼈대(종목·날짜·소요시간, 필수) + 종목별 구조화 블록(헬스 = `exercise_sets`, 야외 3종목만 = 거리·GPS 경로, DB 강제) + 자유 메모(선택) + `details jsonb`(쿼리 안 하는 잡값). 다중 테이블 저장은 rpc(`save_gym_activity`, `save_tracked_activity`) | D-03~05, D-22, D-23 |
| 식단 | `meals(items jsonb)`, 본인만, 칼로리 DB 없음 | D-08 |
| AI 피드백 | 일/주/월 단위, 종합(종목·식단·목표 전부 프롬프트에), 기간당 1개 upsert. 입력 해시 같으면 LLM 호출 없이 반환, "다시 생성"은 기간당 3회 | D-06, D-07 |
| 목표·스트릭 | `goals`(count/distance/duration × 종목 × week/month, 개수 제한 없음). 스트릭 = 하루 1건, KST | D-21 |
| 크루 | 매칭 축: 종목·지역(`regions` 고정 목록)·요일·레벨. 즉시가입/승인제. 리더 1명, `can_post` 권한. 크루 생성 시 트리거가 리더 행 생성 | D-16, D-17 |
| 피드 | 전체 피드 + 크루 피드. `visibility`(public/crew) × `kind`(log/recruit/free) × 크루 태그(선택). 고정은 리더 본인 글. 사진 1장, 비공개 버킷 | D-18, D-26 |
| 프로필 | `profiles`(공개 카드) + `user_settings`(비공개). 기록 공개 3단계(기본 crew), `show_crews`. 회원 페이지 `/users/:id` | D-19, D-25 |
| 크루 통계 | 합계만, private 제외, 기여 멤버 3명 미만 비표시 | D-20 |

## 3. 폴더 구조 (D-14)

```
client/src/
├── features/
│   ├── auth/          로그인·가입·비밀번호 재설정, AuthContext
│   ├── activities/    기록 목록·상세·입력(종목별 폼), exercise_sets 자동완성
│   ├── tracking/      GPS 트래킹 화면(다크 UI), 종료 → activities + activity_routes 저장
│   ├── meals/         식단
│   ├── goals/         목표 CRUD (대시보드가 달성률 표시)
│   ├── feedback/      AI 피드백 요청·표시
│   ├── dashboard/     통계·스트릭·목표 달성률 (GET /api/dashboard)
│   ├── crews/         탐색·매칭·생성·상세·멤버 관리(승인·권한)·크루 통계
│   ├── feed/          전체/크루 피드, 글쓰기, 좋아요·댓글, 사진 업로드
│   └── profile/       내 프로필·설정 편집, 회원 페이지 /users/:id
└── shared/            두 기능 이상이 "똑같이" 쓰는 부품만: supabaseClient, queryClient, queryKeys, 레이아웃, 버튼·모달

server/
├── routes/            요청 파싱·응답만. supabaseAdmin import 금지
├── services/          Express와 분리된 앱 로직 (llm, matching, crewStats, dashboard, feedback). 순수 계산은 그 안에서 함수로 분리
├── middleware/        requireAuth (사용자 JWT → RLS 클라이언트 생성해 req에 부착)
├── config/            supabase.js (사용자 클라이언트 팩토리 + supabaseAdmin), schema.sql (schema.md 적용본), seed_regions.sql
└── index.js
```

기능 폴더 안은 자유(페이지·컴포넌트·훅 섞어도 됨). 규칙은 셋뿐:
1. **승격 규칙**: 처음엔 기능 안에 만들고, 두 번째 기능이 *동일하게* 필요할 때만 `shared/`로.
2. **기능 간 import는 각 기능 `index.js`가 export한 것만.**
3. **Query 키는 `shared/queryKeys.js` 헬퍼로만 생성** — 사용자 범위 데이터는 userId 포함, `SIGNED_OUT`에서 `queryClient.clear()` (D-13).

> D-14 원안(8개)에서 `goals`·`profile`을 분리 추가. goals는 대시보드와 CRUD 화면이 달라 서랍이 따로 필요하고, profile은 D-19·D-25로 편집 화면 + 회원 페이지가 생겼기 때문.

## 4. 상태 관리 (D-13)

- 서버 데이터 → TanStack Query. ①(supabase-js)과 ②(fetch `/api`)를 `queryFn` 안에서 똑같이 프로미스로 취급.
- 세션 → `AuthContext` 하나.
- 트래킹 중 좌표·타이머 → 그 화면의 `useRef`/`useState`. **전역·Query에 절대 넣지 않음.**
- 의존성 추가 예정(구현 ①에서): `@tanstack/react-query`, `react-router`.

## 5. 보안 요약 (전문: schema.md)

- 모든 테이블 RLS ON, `to authenticated`. INSERT/UPDATE `with check`. `(select auth.uid())`.
- 식별 컬럼(`id`·`user_id`·`author_id`·`crew_id`·`owner_id`·`activities.sport`) 불변 — 컬럼 단위 GRANT.
- 값 범위·행 간 관계는 DB 제약 (CHECK·FK·트리거). 함수 경로만 믿지 않음.
- 자식 테이블은 부모 RLS 상속(`exists` 서브쿼리). crew_members 참조는 security definer 헬퍼 경유.
- 사진: 비공개 버킷, storage 정책이 posts 가시성 상속.
- 서버: 라우트마다 `requireAuth`, `supabaseAdmin`은 services 2파일만.

## 6. 구현 순서와 일정 (확정 — `개발계획.md` 3·4절과 동일)

기존 개발계획 구현 5주(6~10주차)를 설계 반영해 재배치. 승인제·권한·회원 페이지·통계·regions가 추가돼 **0.5주 초과** → 운영·보완(14~15주차) 2주에서 0.5주 당겨옴. 2인 병렬 기준, 구현 ① 끝에 속도 재확인(D-27).

| 순서 | 기간 | 백엔드(태훈) | 프론트(민규, ①은 태훈 선행) | Done 기준 |
|---|---|---|---|---|
| ⓪ 스키마 | 첫날 | schema.sql + seed_regions 적용, `supabase.js` 분리, `requireAuth` 교체 | — | SQL Editor에서 통째로 무오류 실행, `/api/me` 동작 |
| ① 인증 | 0.5주 | `/api/me` | 태훈: 뼈대(Query·Router·AuthContext·보호 라우트) + 디자인 시스템 + 로그인 화면 완성본 / 민규: 가입·비밀번호 재설정 | 가입→로그인→새로고침 유지→재설정 메일 |
| ② 기록·식단·목표·AI | 1.5주 | `/api/feedback/generate`, `/api/dashboard`, `/api/exercises/merge`, 프롬프트 튜닝 | 종목별 입력 폼(헬스 세트·자동완성), 식단, 목표, 대시보드, 피드백 화면 | 헬스+러닝 기록→주간 피드백 생성→대시보드 달성률 |
| ③ 크루 | 1.5주 | `/api/crews/match`·`join`·`approve`·`reject`·`stats` | 탐색·매칭·생성·상세·멤버 관리·통계 카드 | 승인제 크루 신청→리더 승인→can_post 부여 |
| ④ 피드·GPS·프로필 | 2주 | (클라 직접이 대부분) 사진 정책 검증 | 전체/크루 피드·글쓰기·사진·좋아요·댓글, GPS 트래킹+카카오맵, 회원 페이지·설정 | 러닝→경로→글에 첨부(include_route)→크루원만 경로 보임 |

- 합계 5.5주 (6~11주차 중반). 테스트 11.5~13.5(2주), 배포 13.5~14.5(1주), 운영·보완 14.5~15(1.5주). → `개발계획.md` 3·4절에 확정 반영.
- ⓪은 문서 SQL을 실제로 돌려보는 첫 검증 — 순서·문법 오류는 여기서 전부 잡힘. → 2026-09-07 SQL 적용 완료(무오류), 서버 코드 교체 완료. **`/api/me` 실토큰 검증이 남아 ⓪은 아직 Done 아님** (진행 상황: `decisions.md` 맨 아래).
- D-27: 구현 ①은 태훈이 프론트 뼈대·디자인 시스템·로그인 화면 1개까지 먼저 깔고, 민규는 그 위에서 화면 단위로 구현.

## 7. 기존 문서·코드 갱신 목록 (설계 세션 밖, 구현 시작 전)

- ✅ `CLAUDE.md`: MVP 범위 10개, 권한(D-15), 실행 방법(schema.sql·seed_regions.sql), 일정
- ✅ `docs/요구사항분석.md` FR-01~10, 화면 목록, EXT-02~04 · `docs/개발계획.md` 3·4절 확정
- ✅ `server/config/profiles.sql` → `schema.sql`(schema.md SQL + ⓪리셋 블록 + auth 트리거 + 버킷 생성) · `seed_regions.sql`(229행)
- 🔶 `server/config/supabase.js` → D-15 분리(`createUserClient`·`supabaseAdmin`) · `server/middleware/auth.js` → `req.db` 부착 · `routes/me.js` — 코드 완료, **실토큰 `/api/me` 검증 남음**
