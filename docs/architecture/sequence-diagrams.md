# CrewFit 순차 다이어그램

기준일: 2026-09-21. [설계 결정](decisions.md), [API 명세](api.md), 현재 소스 코드를 근거로 작성한 주요 유스케이스의 상호작용이다. 전체 화면·예외를 나열한 문서는 아니다.

- **구현 기준**: 저장소에서 호출 경로를 확인한 흐름. 실제 배포 환경의 검증 완료를 뜻하지 않는다.
- **설계 기준**: 확정된 ADR·API 계약에 따른 흐름. 해당 화면·Express API는 아직 미구현이다.
- `->>`는 요청·호출, `-->>`는 응답이다. JWT는 사용자 세션의 접근 토큰을 뜻한다.
- Mermaid를 지원하는 Markdown 뷰어에서 각 코드 블록을 그림으로 볼 수 있다. FigJam 전용 렌더러가 아닌 일반 Mermaid 기준이므로 `alt`, `loop`로 분기·반복을 표현한다.
- 클래스·관계는 [클래스 다이어그램](class-diagrams.md), 최신 작업 상태는 [decisions.md](decisions.md)의 진행 상황을 참조한다.

## 1. 회원가입 — 구현 기준

참여자: 사용자, 가입·인증 화면, Supabase Auth, PostgreSQL. D-12의 이메일 확인 ON에 따라 가입 요청 후 메일 링크로 인증하는 경로다.

```mermaid
sequenceDiagram
    participant user as 사용자
    participant signupPage as 가입·인증 화면
    participant supabaseAuth as Supabase Auth
    participant database as PostgreSQL

    user->>signupPage: 이메일·비밀번호·닉네임·실명 입력
    signupPage->>signupPage: 닉네임·실명 검증 및 정규화
    signupPage->>supabaseAuth: signUp(email, password, metadata, emailRedirectTo)
    supabaseAuth->>database: auth.users 생성
    database->>database: handle_new_user 트리거 실행
    database->>database: profiles와 user_settings 생성
    database-->>supabaseAuth: 계정 생성 결과
    supabaseAuth-->>signupPage: 사용자·세션 또는 오류
    alt 오류 없이 세션 반환
        signupPage-->>user: /home으로 이동
    else 오류 없이 세션 없음
        signupPage-->>user: /verify-email에서 메일 확인 안내
        supabaseAuth-->>user: 인증 메일
        user->>supabaseAuth: 인증 링크 열기
        supabaseAuth-->>signupPage: /auth/callback으로 복귀
        signupPage->>supabaseAuth: SDK 초기화·링크 세션 확인
        supabaseAuth-->>signupPage: 세션 또는 인증 오류
        signupPage-->>user: 완료·홈 진입 또는 만료·재발송 안내
    else 가입 오류
        signupPage-->>user: 입력 유지·오류 안내
    end
```

- 닉네임은 공개 카드 `profiles`, 실명은 비공개 `user_settings.real_name`에 저장한다(D-25·D-28).
- 폼에서는 실명이 필수지만 트리거는 실명 없는 관리자 생성 등을 허용해 NULL을 저장한다.
- 근거: [SignupPage.jsx](../../client/src/features/auth/SignupPage.jsx), [schema.sql](../../server/config/schema.sql)의 `handle_new_user`.

## 2. 로그인·세션 반영 — 구현 기준

로그인 자체는 Express를 거치지 않는다. 보호된 Express API를 호출할 때 별도로 JWT 검증을 수행한다(6절).

```mermaid
sequenceDiagram
    participant user as 사용자
    participant loginPage as 로그인 화면
    participant authSdk as supabase-js Auth
    participant supabaseAuth as Supabase Auth
    participant authProvider as AuthProvider

    user->>loginPage: 이메일·비밀번호 제출
    loginPage->>authSdk: signInWithPassword
    authSdk->>supabaseAuth: 이메일·비밀번호 인증
    supabaseAuth-->>authSdk: 세션 또는 인증 오류
    alt 인증 성공
        authSdk->>authSdk: 세션 저장·관리
        authSdk-->>authProvider: onAuthStateChange 이벤트
        authProvider->>authProvider: session·user·token 상태 반영
        authSdk-->>loginPage: 오류 없는 결과
        loginPage-->>user: 이전 요청 경로 또는 /home 이동
    else 인증 실패
        authSdk-->>loginPage: 인증 오류
        loginPage-->>user: 오류 안내
    end
```

새로고침 시 `getSession()`으로 세션을 복원한다. 로그아웃 이벤트에서는 Query 캐시를 비운다(D-13). 위 그림은 성공 경로를 읽기 쉽게 펼친 것으로, SDK 이벤트와 호출 Promise의 세부 실행 순서를 애플리케이션이 강제하는 것은 아니다.

근거: [LoginPage.jsx](../../client/src/features/auth/LoginPage.jsx), [AuthContext.jsx](../../client/src/features/auth/AuthContext.jsx).

## 3. 운동 기록 생성 — 구현 기준

일반 종목은 단일 테이블 INSERT, 헬스는 기록과 세트를 묶는 RPC다. 두 경로 모두 사용자 JWT·RLS를 적용하며 Express를 거치지 않는다(D-10·D-22).

```mermaid
sequenceDiagram
    participant user as 사용자
    participant activityForm as 기록 폼
    participant createPage as ActivityCreatePage
    participant recordModule as record.js
    participant database as Supabase DB·RLS
    participant queryCache as Query 캐시

    user->>activityForm: 종목별 기록 입력·저장
    activityForm->>recordModule: activityPayload(form)
    recordModule-->>activityForm: 검증 결과·저장 데이터
    alt 입력 오류
        activityForm-->>user: 필드 오류 표시
    else 입력 유효
        activityForm->>createPage: onSave(payload)
        createPage->>recordModule: saveActivity(db, userId, payload)
        alt 헬스
            recordModule->>database: rpc save_gym_activity
            database->>database: activities·exercise_sets 트랜잭션 저장
        else 러닝·걷기·자전거·수영·기타
            recordModule->>database: 본인 activities INSERT
        end
        database-->>recordModule: 저장 결과 또는 오류
        recordModule-->>createPage: 완료 또는 예외
        alt 저장 성공
            createPage->>queryCache: 본인 활동·대시보드 무효화
            createPage-->>user: 기록 날짜가 속한 주의 홈으로 이동
        else 저장 실패
            createPage-->>activityForm: 예외 전달
            activityForm-->>user: 입력 유지·결과 확인 안내
        end
    end
```

- 시간은 `분 × 60 + 초`, 야외 거리는 km → m로 변환한다. 수영 거리는 m, 선택 랩 수는 `details.lap_count`다.
- 헬스 RPC가 실패하면 기록·세트 모두 롤백된다. 일반 종목도 오류를 성공으로 처리하지 않는다.
- 근거: [ActivityForm.jsx](../../client/src/features/activities/ActivityForm.jsx), [ActivityCreatePage.jsx](../../client/src/features/activities/ActivityCreatePage.jsx), [record.js](../../client/src/features/activities/record.js), [schema.sql](../../server/config/schema.sql).

## 4. 헬스 기록 수정 — 구현 기준

본인 기록을 조회해 폼에 채운 뒤 저장하는 경로다. 그림의 DB 참여자는 사용자 JWT로 접근하는 Supabase DB이며, 수정 RPC는 `security invoker`로 RLS를 따른다.

```mermaid
sequenceDiagram
    participant user as 사용자
    participant editPage as ActivityEditPage·폼
    participant detailModule as activityDetail.js
    participant mutationModule as activityMutations.js
    participant database as Supabase DB·RLS
    participant queryCache as Query 캐시

    user->>editPage: 본인 헬스 기록 수정 열기
    editPage->>detailModule: loadActivityDetail(db, userId, id)
    detailModule->>database: 본인 activities·exercise_sets 조회
    database-->>detailModule: 기록·세트
    detailModule-->>editPage: 수정 폼 초기값
    user->>editPage: 날짜·시간·세트 수정 후 저장
    editPage->>mutationModule: 검증 후 updateActivity 호출
    mutationModule->>database: rpc update_gym_activity
    database->>database: 본인 헬스 부모 행 잠금
    database->>database: 공통 필드 수정·전체 세트 교체
    database-->>mutationModule: ID 또는 오류·롤백
    mutationModule-->>editPage: 결과
    alt 수정 성공
        editPage->>queryCache: 본인 활동·대시보드 무효화
        editPage-->>user: 진입한 목록 또는 해당 주 홈으로 복귀
    else 수정 실패
        editPage-->>user: 입력 유지·오류 안내
    end
```

종목·소유자는 변경할 수 없다. 없는 기록·타인 기록은 편집 폼을 열지 않는다. RPC 안에서 부모가 없거나 본인 헬스 기록이 아니면 `P0002`, 함수 미적용이면 클라이언트가 `PGRST202` 안내를 표시한다.

근거: [ActivityEditPage.jsx](../../client/src/features/activities/ActivityEditPage.jsx), [activityDetail.js](../../client/src/features/activities/activityDetail.js), [activityMutations.js](../../client/src/features/activities/activityMutations.js), [수정 RPC](../../server/config/migrations/20260914_update_gym_activity.sql).

## 5. 헬스 운동명 자동완성 — 구현 기준

내 기록을 먼저 추천하고 정적 기본 운동 30개를 보완 후보로 사용한다. 운동 마스터 테이블이나 LLM 호출은 없다(D-05).

```mermaid
sequenceDiagram
    participant user as 사용자
    participant nameInput as ExerciseNameInput
    participant historyQuery as useExerciseNames·Query
    participant nameModule as exerciseNames.js
    participant database as Supabase DB·RLS

    user->>nameInput: 운동명 입력칸 선택
    nameInput->>historyQuery: 이력 조회 활성화
    alt 신선한 사용자별 캐시 존재
        historyQuery-->>nameInput: 캐시된 내 운동명
    else 조회 필요
        historyQuery->>nameModule: loadExerciseNames(db, userId)
        loop 빈 페이지를 받을 때까지
            nameModule->>database: 본인 세트 ID·운동명 커서 조회
            database-->>nameModule: 페이지 또는 오류
        end
        nameModule-->>historyQuery: 중복 제거 운동명 또는 예외
        historyQuery-->>nameInput: 이력 또는 실패 상태
    end
    user->>nameInput: 검색어 입력
    nameInput->>nameModule: exerciseSuggestions(history, input)
    nameModule-->>nameInput: 내 기록 우선·기본 후보, 최대 8개
    nameInput-->>user: 추천 선택 또는 자유 입력
```

오류가 나면 반복 조회를 중단하고 기본 추천·직접 입력을 유지한다. 키는 `['activities', userId, 'exerciseNames']`, staleTime은 5분이다. DB 조회 중에도 정적 추천을 사용할 수 있다.

근거: [useExerciseNames.js](../../client/src/features/activities/useExerciseNames.js), [exerciseNames.js](../../client/src/features/activities/exerciseNames.js), [ExerciseNameInput.jsx](../../client/src/features/activities/ExerciseNameInput.jsx).

## 6. 주간 대시보드 조회 — 구현 기준

캐시 조회가 아니라 서버 요청이 필요한 경우의 흐름이다. 집계는 Express에서 수행하지만 DB 권한은 사용자 JWT·RLS다. `service_role`은 사용하지 않는다(D-15).

```mermaid
sequenceDiagram
    participant homePage as HomePage·Query
    participant dashboardRoute as Express dashboard 라우트
    participant authMiddleware as requireAuth
    participant supabaseAuth as Supabase Auth
    participant dashboardService as dashboard 서비스
    participant database as Supabase DB·RLS

    homePage->>dashboardRoute: GET /api/dashboard, 주 기준일·Bearer JWT
    dashboardRoute->>authMiddleware: 인증 미들웨어 실행
    opt 토큰 존재
        authMiddleware->>supabaseAuth: getUser(token)
        supabaseAuth-->>authMiddleware: 사용자 또는 오류
    end
    alt 토큰 누락·무효
        authMiddleware-->>homePage: 401 인증 오류
    else 인증 성공
        authMiddleware-->>dashboardRoute: req.user·req.db 설정 후 next
        dashboardRoute->>dashboardService: weekRange(date)
        dashboardService-->>dashboardRoute: 월요일~일요일 범위
        dashboardRoute->>dashboardService: loadWeeklyDashboard(db, userId, range)
        loop 해당 주의 모든 본인 기록 조회
            dashboardService->>database: user_id·날짜 범위·ID 커서 SELECT
            database-->>dashboardService: 기록 페이지
        end
        dashboardService->>dashboardService: 합계·일별 건수·최근 최대 50건 구성
        dashboardService-->>dashboardRoute: 주간 결과
        dashboardRoute-->>homePage: 200 totals·days·recent
    end
```

잘못된 기간·날짜는 400, 조회 실패는 500이다. 일부만 읽은 합계를 성공 응답으로 반환하지 않는다. 현재 그림에는 후속 기능인 스트릭·목표 달성률을 넣지 않았다.

근거: [HomePage.jsx](../../client/src/features/dashboard/HomePage.jsx), [auth.js](../../server/middleware/auth.js), [routes/dashboard.js](../../server/routes/dashboard.js), [services/dashboard.js](../../server/services/dashboard.js).

## 7. 크루 가입 신청·승인 — 설계 기준

D-17 및 API 명세의 구현 예정 흐름이다. 각 Express 요청의 `requireAuth` 검증은 6절과 동일하며 그림에서는 생략했다. 신청자 요청은 신청자 JWT, 승인 요청은 크루장 JWT를 사용한다.

```mermaid
sequenceDiagram
    participant applicant as 신청자
    participant crewPage as 크루 화면
    participant crewApi as Express 크루 API
    participant database as Supabase DB·RLS
    participant owner as 크루장

    applicant->>crewPage: 크루 가입 신청
    crewPage->>crewApi: POST /api/crews/:id/join
    crewApi->>database: crews.join_mode 조회
    database-->>crewApi: open 또는 approval
    alt 즉시가입 크루
        crewApi->>database: 본인 멤버십 approved INSERT
        database-->>crewApi: 저장 결과
        crewApi-->>crewPage: status approved
    else 승인제 크루
        crewApi->>database: 본인 멤버십 pending INSERT
        database-->>crewApi: 저장 결과
        crewApi-->>crewPage: status pending
        owner->>crewPage: 신청 목록에서 회원 승인
        crewPage->>crewApi: POST /api/crews/:id/approve, 대상 user_id
        crewApi->>database: 대상 멤버십 approved UPDATE
        database->>database: RLS로 크루장 권한 검사
        database-->>crewApi: 변경 결과
        crewApi-->>crewPage: 승인 결과
    end
```

- INSERT도 RLS가 가입 모드·본인 여부를 검사한다. 승인은 크루장만 가능하며 `can_post` 부여와는 별개다.
- 거절은 `/reject`를 통해 신청 행을 삭제한다. 권한 거부는 API 계약상 403이다.
- 근거: [api.md](api.md)의 멤버십 계약, [decisions.md](decisions.md) D-17, [schema.sql](../../server/config/schema.sql)의 `crew_members` 정책. 크루 라우트 구현 완료를 뜻하지 않는다.

## 8. 기간별 AI 피드백 — 구현 기준

D-06·D-07·D-15·D-29의 구현 흐름이다. 인증 성공 이후부터 표현한다. 읽기는 사용자 JWT, 결과 쓰기만 서버 전용 admin 권한이다.

```mermaid
sequenceDiagram
    participant user as 사용자
    participant feedbackPage as 피드백 화면
    participant feedbackApi as Express 피드백 API
    participant feedbackService as 피드백 서비스
    participant database as Supabase DB
    participant llmApi as OpenAI Responses API

    user->>feedbackPage: 기간별 피드백 열기
    feedbackPage->>database: JWT/RLS로 본인·기간의 저장된 피드백 조회
    database-->>feedbackPage: 저장된 결과 또는 없음
    feedbackPage-->>user: 작성 시점과 기존 결과 또는 피드백 받기 안내
    user->>feedbackPage: 피드백 받기 또는 다시 받기 클릭
    feedbackPage->>feedbackApi: POST /api/feedback/generate
    feedbackApi->>feedbackService: 인증 사용자·period·date·force 전달
    feedbackService->>feedbackService: KST 기간 시작일 정규화
    feedbackService->>database: JWT로 기록·세트·식단·목표·설정·기존 피드백 조회
    database-->>feedbackService: 본인 데이터
    feedbackService->>feedbackService: 프롬프트 조립·모델명 포함 해시 계산
    alt 해시 일치 및 force false
        feedbackService-->>feedbackApi: 기존 결과, cached true
    else 새 생성 또는 강제 재생성
        feedbackService->>feedbackService: 데이터·재생성 횟수·호출 한도 검사
        alt 생성 가능
            feedbackService->>llmApi: 서버 비밀키로 프롬프트 전송
            llmApi-->>feedbackService: 코칭 결과
            feedbackService->>database: admin으로 본인 ai_feedbacks UPSERT
            database-->>feedbackService: 저장 결과
            feedbackService-->>feedbackApi: 새 결과, cached false
        else 생성 불가
            feedbackService-->>feedbackApi: NO_DATA 또는 한도 오류
        end
    end
    feedbackApi-->>feedbackPage: 피드백 또는 오류 응답
    feedbackPage-->>user: 결과·재생성 횟수 또는 안내
```

- 저장 user_id는 요청 본문이 아니라 인증된 `req.user.id`다. admin 키·LLM 키는 클라이언트에 전달하지 않는다.
- 강제 재생성은 기간당 3회, 실제 LLM 호출은 사용자당 분당 5회·일일 20회로 제한하는 설계다. 호출 제한은 단일 서버의 메모리 기반이며 재시작하면 초기화된다.
- 기록 없음은 400 `NO_DATA`, 한도 초과는 429다. 설정 누락·모델 통신·저장 실패는 서로 다른 안정된 오류 코드로 응답하며 내부 오류와 비밀값은 노출하지 않는다.
- 근거: [FeedbackPage.jsx](../../client/src/features/feedback/FeedbackPage.jsx), [feedback.js](../../server/services/feedback.js), [llm.js](../../server/services/llm.js), [api.md](api.md), [decisions.md](decisions.md) D-06·D-07·D-15·D-29.
