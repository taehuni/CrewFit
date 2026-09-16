-- CrewFit 스키마 · RLS · storage  (원본: docs/architecture/schema.md — 문서를 먼저 고치고 여기 반영)
-- 적용: Supabase SQL Editor 에 이 파일 전체 붙여넣어 실행 → 이어서 seed_regions.sql 실행.
-- 실행 순서: ⓪ 리셋 → ① 테이블 → ② 함수 → ③ 정책 → ④ 트리거·컬럼 권한 → ⑤ storage

-- ═══════════════════════════════════════════
-- ⓪ 리셋  (개발 초기용 — 다시 실행해도 되게 전부 지우고 새로 만듦)
-- ═══════════════════════════════════════════
-- ⚠ public 스키마의 앱 테이블 데이터가 전부 삭제됨 (auth.users 계정은 유지되고, ② 트리거 아래 백필 문장이 그 계정들의 profiles·user_settings 를 다시 만듦 — 같은 이메일은 재가입이 안 되므로).
--   실데이터가 쌓인 뒤에는 이 블록을 지우고 ALTER 마이그레이션으로 전환할 것.
drop table if exists public.comments, public.post_likes, public.posts, public.ai_feedbacks,
  public.goals, public.meals, public.exercise_sets, public.activity_routes, public.activities,
  public.crew_members, public.crews, public.user_settings, public.profiles, public.regions cascade;
drop function if exists public.save_gym_activity(date, integer, text, jsonb);
drop function if exists public.update_gym_activity(bigint, date, integer, text, jsonb);
drop function if exists public.save_tracked_activity(text, date, timestamptz, integer, integer, jsonb, text, jsonb);
drop policy if exists "images_select"     on storage.objects;
drop policy if exists "images_insert_own" on storage.objects;
drop policy if exists "images_delete_own" on storage.objects;

-- ═══════════════════════════════════════════
-- ① 테이블  (FK 순서: profiles → crews → crew_members → activities … → posts → likes/comments)
-- ═══════════════════════════════════════════
-- enum 대신 text + CHECK: 값 추가/삭제가 ALTER 한 줄 (변경 잦을 초안이라)
-- 배치 규칙: 참조되는 테이블이 참조하는 테이블보다 반드시 앞. 의존 없는 조회 테이블(regions)은 맨 앞

-- 0. regions — 지역 고정 목록 (D-16). user_settings·crews가 FK로 참조. 드롭다운도 여기서 읽음
--    시드: 행안부 행정구역 시/도·시/군/구 ~250행 → `server/config/seed_regions.sql` (구현 시 작성)
--    실행 순서: 이 문서 SQL 전체 적용 → seed_regions.sql → 그 다음에야 크루 생성·프로필 지역 설정 가능 (FK라 빈 상태면 전부 실패)
create table public.regions (
  sido    text not null,
  sigungu text not null,
  primary key (sido, sigungu)
);
-- 시드 형식 예:
-- insert into public.regions (sido, sigungu) values
--   ('서울특별시','강남구'), ('서울특별시','강동구'), ('경기도','수원시 장안구'), … ;

-- 1. profiles — 공개 카드. 기존 테이블 확장(실제 적용은 ALTER로 컬럼 추가)
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  nickname            text not null,
  main_sport          text check (main_sport in ('running','walking','cycling','swimming','gym','other')),
  level               text check (level in ('beginner','intermediate','advanced')),
  activity_visibility text not null default 'crew'
                      check (activity_visibility in ('public','crew','private')),
  show_crews          boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
-- activity_visibility·show_crews는 다른 테이블 정책이 읽어야 해서 공개 쪽에 둠 (남이 알아도 되는 플래그)

-- 2. user_settings — 비공개 1:1 (D-25). 매칭·AI 프롬프트용
create table public.user_settings (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  real_name      text constraint user_settings_real_name_check check (
                   real_name is null or (real_name = btrim(real_name)
                     and char_length(real_name) between 1 and 50
                     and real_name !~ '[[:cntrl:]]')),
  region_sido    text,
  region_sigungu text,
  preferred_days smallint[] not null default '{}'
                 check (preferred_days <@ '{0,1,2,3,4,5,6}'::smallint[]),   -- 0=일 … 6=토
  goal_note      text,                                                       -- 자유 목표 문구 (D-07)
  updated_at     timestamptz not null default now(),
  check ((region_sido is null) = (region_sigungu is null)),                  -- 둘 다 비거나 둘 다 채움
  foreign key (region_sido, region_sigungu) references public.regions(sido, sigungu)
);

-- 3. crews (D-16 · D-17) — INSERT 시 트리거가 리더 멤버십 자동 생성 (④)
create table public.crews (
  id             bigint generated always as identity primary key,
  owner_id       uuid not null references public.profiles(id),
  name           text not null,
  description    text,
  sport          text not null check (sport in ('running','walking','cycling','swimming','gym','other')),
  level          text check (level in ('beginner','intermediate','advanced')),
  region_sido    text not null,
  region_sigungu text not null,
  activity_days  smallint[] not null default '{}'
                 check (activity_days <@ '{0,1,2,3,4,5,6}'::smallint[]),
  join_mode      text not null default 'open' check (join_mode in ('open','approval')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  foreign key (region_sido, region_sigungu) references public.regions(sido, sigungu)   -- 고정 목록 + 시/도-시/군/구 쌍 강제
);
create index crews_match on public.crews (sport, region_sigungu);

-- 4. crew_members (D-17 · D-19)
create table public.crew_members (
  crew_id   bigint not null references public.crews(id) on delete cascade,
  user_id   uuid   not null references public.profiles(id) on delete cascade,
  status    text   not null default 'pending' check (status in ('pending','approved')),
  can_post  boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);
create index crew_members_user on public.crew_members (user_id);

-- 5. activities — 모든 종목의 공통 뼈대 (D-03: 종목·날짜·소요시간 필수, 메모는 선택)
create table public.activities (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  sport         text not null check (sport in ('running','walking','cycling','swimming','gym','other')),
  performed_on  date not null,                                 -- 사용자 로컬(KST) 날짜. 소급 입력 허용
  started_at    timestamptz,                                   -- GPS 트래킹이면 채움
  duration_sec  integer not null check (duration_sec >= 0),
  distance_m    integer check (distance_m >= 0),               -- 야외·수영
  details       jsonb not null default '{}',                   -- 종목별 잡값(랩 수, 고도…). 쿼리 안 함
  note          text,                                          -- 자유 메모 (LLM이 읽음)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index activities_user_date on public.activities (user_id, performed_on desc);

-- 6. activity_routes — GPS 경로, 위치 이력이라 별도 잠금 (D-23)
create table public.activity_routes (
  activity_id bigint primary key references public.activities(id) on delete cascade,
  points      jsonb not null,            -- [[lat,lng,epoch_ms], …]
  created_at  timestamptz not null default now()
);

-- 7. exercise_sets — 헬스 구조화 블록 (D-05 · D-22)
create table public.exercise_sets (
  id            bigint generated always as identity primary key,
  activity_id   bigint not null references public.activities(id) on delete cascade,
  user_id       uuid   not null references public.profiles(id) on delete cascade,  -- 비정규화: 자동완성·합치기·RLS 단순화
  exercise_name text   not null check (exercise_name = trim(exercise_name) and exercise_name <> ''),  -- 원본 대소문자 보존(표시용)
  set_no        smallint not null check (set_no > 0),
  reps          smallint check (reps >= 0),
  weight_kg     numeric(6,2) check (weight_kg >= 0)
);
-- 비교·유니크·자동완성은 lower() 기준 (D-05): "Bench Press" = "bench press"
create unique index exercise_sets_uq        on public.exercise_sets (activity_id, lower(exercise_name), set_no);
create index        exercise_sets_user_name on public.exercise_sets (user_id, lower(exercise_name));

-- 8. meals — 식단, 항상 본인만 (D-08)
create table public.meals (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  eaten_on   date not null,
  meal_type  text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  items      jsonb not null default '[]',   -- [{name, amount, kcal?}] 쿼리 안 함 → jsonb
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meals_user_date on public.meals (user_id, eaten_on desc);

-- 9. goals (D-21)
create table public.goals (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null check (type in ('count','distance','duration')),
  sport      text check (sport in ('running','walking','cycling','swimming','gym','other')), -- null = 전체
  target     numeric not null check (target > 0),   -- 회 / m / 초
  period     text not null check (period in ('week','month')),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 10. ai_feedbacks — 읽기 본인 / 쓰기 서버 admin만 (D-06 · D-15)
create table public.ai_feedbacks (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  period       text not null check (period in ('day','week','month')),
  period_start date not null,
  content      text not null,
  model        text,                 -- 생성에 쓴 모델명 (과제 문서화용)
  source_hash  text not null,        -- sha256(최종 프롬프트 문자열 + 모델명). 입력·템플릿·모델 중 하나라도 바뀌면 달라짐. 같으면 LLM 호출 없이 반환 (D-06)
  regen_count  smallint not null default 0 check (regen_count >= 0),  -- UX용: force 재생성 횟수, 서버가 기간당 3회 제한
  llm_calls    integer  not null default 0 check (llm_calls >= 0),    -- 회계용: 이 행에 실제로 든 LLM 호출 누계 (force 무관). 일일 상한은 서버 in-memory
  created_at   timestamptz not null default now(),
  unique (user_id, period, period_start),  -- 기간당 1개, 재생성은 upsert
  -- 기준일 정규화: week는 월요일, month는 1일 (서버가 계산해서 넣고, DB가 재검증 — 같은 주가 두 행이 되는 것 차단)
  check (period <> 'week'  or extract(isodow from period_start) = 1),
  check (period <> 'month' or extract(day   from period_start) = 1)
);

-- 11. posts (D-18)
create table public.posts (
  id            bigint generated always as identity primary key,
  author_id     uuid not null references public.profiles(id) on delete cascade,
  crew_id       bigint references public.crews(id) on delete cascade,   -- 크루 삭제 시 태그된 글은 public이어도 함께 삭제 (D-18 확정)
  visibility    text not null check (visibility in ('public','crew')),
  kind          text not null default 'free' check (kind in ('log','recruit','free')),
  sport         text check (sport in ('running','walking','cycling','swimming','gym','other')),
  activity_id   bigint references public.activities(id) on delete set null,
  include_route boolean not null default false,
  is_pinned     boolean not null default false,
  content       text not null,
  image_path    text,                       -- storage 객체 이름 그대로: {author_id}/{uuid}.jpg
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (visibility = 'public' or crew_id is not null),      -- crew 글은 크루 필수
  check (not is_pinned or crew_id is not null),              -- 고정은 크루 글만
  check (not include_route or activity_id is not null),      -- 경로는 기록 첨부 시만
  check (image_path is null or image_path like author_id::text || '/%')  -- 내 폴더 사진만 (남의 사진 경로 재사용 → storage로 공개되는 것 차단)
);
create index posts_crew_feed   on public.posts (crew_id, is_pinned desc, created_at desc);
create index posts_public_feed on public.posts (kind, created_at desc) where visibility = 'public';
create index posts_image_path  on public.posts (image_path) where image_path is not null;  -- storage 정책 조회용

-- 12. post_likes
create table public.post_likes (
  post_id    bigint not null references public.posts(id) on delete cascade,
  user_id    uuid   not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- 13. comments
create table public.comments (
  id         bigint generated always as identity primary key,
  post_id    bigint not null references public.posts(id) on delete cascade,
  author_id  uuid   not null references public.profiles(id) on delete cascade,
  content    text   not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_post on public.comments (post_id, created_at);

-- RLS ON (정책은 ③에서)
alter table public.profiles        enable row level security;
alter table public.user_settings   enable row level security;
alter table public.regions         enable row level security;
alter table public.crews           enable row level security;
alter table public.crew_members    enable row level security;
alter table public.activities      enable row level security;
alter table public.activity_routes enable row level security;
alter table public.exercise_sets   enable row level security;
alter table public.meals           enable row level security;
alter table public.goals           enable row level security;
alter table public.ai_feedbacks    enable row level security;
alter table public.posts           enable row level security;
alter table public.post_likes      enable row level security;
alter table public.comments        enable row level security;

-- ═══════════════════════════════════════════
-- ② 함수  (테이블이 전부 있어야 본문 검증 통과)
-- ═══════════════════════════════════════════

-- updated_at 자동 갱신 (트리거는 ④)
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- 가입 트리거: 기존 handle_new_user를 교체 — profiles + user_settings 두 행 생성
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, nickname)
    values (new.id, coalesce(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1)));
  -- 가입 폼은 필수. 메타데이터가 없는 관리자 생성 등은 NULL 허용 (D-28).
  insert into user_settings (user_id, real_name)
    values (new.id, nullif(btrim(new.raw_user_meta_data->>'real_name'), ''));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- schema.sql 재실행(⓪ 리셋)으로 profiles가 비었을 때 기존 auth.users 계정을 복구. 같은 이메일은 재가입이 안 되므로 필수.
insert into public.profiles (id, nickname)
  select id, coalesce(raw_user_meta_data->>'nickname', split_part(email, '@', 1)) from auth.users
  on conflict (id) do nothing;
insert into public.user_settings (user_id) select id from public.profiles on conflict (user_id) do nothing;

-- 헬퍼 (security definer: 정책 안에서 crew_members 자기참조 재귀 방지)
-- 크루장 전용 실명 조회. user_settings의 다른 비공개 컬럼은 반환하지 않는다 (D-28).
create or replace function public.crew_member_names(p_crew_id bigint)
returns table (user_id uuid, real_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.crews c
    where c.id = p_crew_id and c.owner_id = (select auth.uid())
  ) then
    raise exception '크루장만 실명을 조회할 수 있습니다' using errcode = '42501';
  end if;
  return query
    select m.user_id, s.real_name
    from public.crew_members m
    join public.user_settings s on s.user_id = m.user_id
    where m.crew_id = p_crew_id and m.status = 'approved';
end $$;
revoke all on function public.crew_member_names(bigint) from public, anon, authenticated;
grant execute on function public.crew_member_names(bigint) to authenticated;

create or replace function public.is_crew_owner(p_crew_id bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from crews where id = p_crew_id and owner_id = (select auth.uid()));
$$;

create or replace function public.is_crew_member(p_crew_id bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from crew_members
    where crew_id = p_crew_id and user_id = (select auth.uid()) and status = 'approved');
$$;

-- 리더이거나 can_post 승인 멤버
create or replace function public.can_post_in_crew(p_crew_id bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select is_crew_owner(p_crew_id) or exists (select 1 from crew_members
    where crew_id = p_crew_id and user_id = (select auth.uid())
      and status = 'approved' and can_post);
$$;

-- 나와 p_user가 같은 크루의 approved 멤버인가 (기록 'crew' 공개용)
create or replace function public.shares_crew_with(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from crew_members a join crew_members b using (crew_id)
    where a.user_id = (select auth.uid()) and b.user_id = p_user
      and a.status = 'approved' and b.status = 'approved');
$$;

-- 헬스 저장: 기록 1행 + 세트 N행 한 트랜잭션 (D-22). security INVOKER → 아래 RLS가 그대로 적용됨
-- p_sets: [{exercise_name, set_no, reps, weight_kg}, …]
create or replace function public.save_gym_activity(
  p_performed_on date, p_duration_sec integer, p_note text, p_sets jsonb
) returns bigint
language plpgsql security invoker set search_path = public as $$
declare v_id bigint;
begin
  insert into activities (user_id, sport, performed_on, duration_sec, note)
    values ((select auth.uid()), 'gym', p_performed_on, p_duration_sec, p_note)
    returning id into v_id;
  insert into exercise_sets (activity_id, user_id, exercise_name, set_no, reps, weight_kg)
    select v_id, (select auth.uid()), trim(s->>'exercise_name'), (s->>'set_no')::smallint,
           (s->>'reps')::smallint, (s->>'weight_kg')::numeric
    from jsonb_array_elements(p_sets) s;
  return v_id;
end $$;

-- D-22: 헬스 수정은 기록과 세트를 한 트랜잭션으로 교체한다.
-- 부모 행 잠금으로 같은 기록의 동시 수정이 서로의 세트를 섞지 않게 한다.
create or replace function public.update_gym_activity(
  p_activity_id bigint, p_performed_on date, p_duration_sec integer, p_note text, p_sets jsonb
) returns bigint
language plpgsql security invoker set search_path = '' as $$
begin
  if p_sets is null or jsonb_typeof(p_sets) <> 'array' then
    raise exception 'sets must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_sets) < 1 or jsonb_array_length(p_sets) > 100 then
    raise exception 'sets must contain 1 to 100 entries' using errcode = '22023';
  end if;
  perform 1 from public.activities
    where id = p_activity_id and user_id = (select auth.uid()) and sport = 'gym'
    for update;
  if not found then
    raise exception 'activity not found' using errcode = 'P0002';
  end if;

  update public.activities
    set performed_on = p_performed_on, duration_sec = p_duration_sec, note = p_note
    where id = p_activity_id and user_id = (select auth.uid()) and sport = 'gym';
  delete from public.exercise_sets
    where activity_id = p_activity_id and user_id = (select auth.uid());
  insert into public.exercise_sets (activity_id, user_id, exercise_name, set_no, reps, weight_kg)
    select p_activity_id, (select auth.uid()), trim(s->>'exercise_name'), (s->>'set_no')::smallint,
           (s->>'reps')::smallint, (s->>'weight_kg')::numeric
    from jsonb_array_elements(p_sets) s;
  return p_activity_id;
end $$;

revoke execute on function public.update_gym_activity(bigint, date, integer, text, jsonb) from public, anon;
grant execute on function public.update_gym_activity(bigint, date, integer, text, jsonb) to authenticated;

-- 기록 첨부 해제(FK SET NULL 포함) 시 경로 공개도 함께 해제한다.
create or replace function public.clear_detached_post_route()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.activity_id is null then
    new.include_route := false;
  end if;
  return new;
end $$;
revoke execute on function public.clear_detached_post_route() from public, anon, authenticated;
drop trigger if exists posts_clear_detached_route on public.posts;
create trigger posts_clear_detached_route before update of activity_id on public.posts
  for each row execute function public.clear_detached_post_route();

-- GPS 저장: 기록 1행 + 경로 1행 한 트랜잭션 (D-23·D-24). security INVOKER → RLS 적용. 경로 저장 실패 시 기록도 남지 않음
create or replace function public.save_tracked_activity(
  p_sport text, p_performed_on date, p_started_at timestamptz, p_duration_sec integer,
  p_distance_m integer, p_details jsonb, p_note text, p_points jsonb
) returns bigint
language plpgsql security invoker set search_path = public as $$
declare v_id bigint;
begin
  if p_sport not in ('running','walking','cycling') then
    raise exception 'GPS route allowed only for running/walking/cycling' using errcode = 'check_violation';
  end if;  -- routes_insert_own 정책도 같은 걸 막지만, 여기서 먼저 잡아 메시지를 분명히
  insert into activities (user_id, sport, performed_on, started_at, duration_sec, distance_m, details, note)
    values ((select auth.uid()), p_sport, p_performed_on, p_started_at, p_duration_sec, p_distance_m,
            coalesce(p_details, '{}'), p_note)
    returning id into v_id;
  insert into activity_routes (activity_id, points) values (v_id, p_points);
  return v_id;
end $$;

-- approved 멤버 수 (D-16 매칭·크루 카드). security definer: show_crews=false 행은 개인에겐 숨기지만 숫자는 공개 정보
create or replace function public.crew_member_count(p_crew_id bigint) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from crew_members where crew_id = p_crew_id and status = 'approved';
$$;

-- 크루 생성 시 리더 멤버십 자동 생성 (D-17). 트리거라 어떤 경로로 INSERT해도 불변식 유지 — 함수 우회 불가
-- security definer: 정책(members_insert_join)을 거치지 않고 approved·can_post로 삽입
create or replace function public.add_owner_membership() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into crew_members (crew_id, user_id, status, can_post)
    values (new.id, new.owner_id, 'approved', true);
  return new;
end $$;

revoke execute on function public.is_crew_owner, public.is_crew_member, public.can_post_in_crew,
  public.shares_crew_with, public.save_gym_activity, public.save_tracked_activity, public.crew_member_count
  from public, anon;
grant  execute on function public.is_crew_owner, public.is_crew_member, public.can_post_in_crew,
  public.shares_crew_with, public.save_gym_activity, public.save_tracked_activity, public.crew_member_count
  to authenticated;

-- ═══════════════════════════════════════════
-- ③ 정책  (모든 테이블·헬퍼가 있어야 생성 가능)
-- ═══════════════════════════════════════════

-- regions ───────────────────────────────────
-- 막는 것: 비로그인 열람. 쓰기 정책 없음(시드는 service_role로)
create policy "regions_select" on public.regions for select to authenticated using (true);

-- profiles ──────────────────────────────────
-- 막는 것: 비로그인(anon) 스크래핑. 로그인 유저는 닉네임·주종목이 멤버목록/글 작성자 표시에 필요해 전원 조회 — 비공개 값은 user_settings로 분리됨
create policy "profiles_select" on public.profiles for select
  to authenticated using (true);
-- 막는 것: 남의 닉네임·공개설정 변경. with check로 id를 남의 것으로 바꾸는 것도 차단
create policy "profiles_update_own" on public.profiles for update
  to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
-- insert 정책 없음: 가입 트리거(security definer)가 생성. 막는 것: 남의 id로 프로필 생성
-- delete 정책 없음: auth.users 삭제 시 cascade

-- user_settings ─────────────────────────────
-- 막는 것: 남의 동네·요일·목표 메모 열람/수정 — 본인만
create policy "settings_select_own" on public.user_settings for select
  to authenticated using (user_id = (select auth.uid()));
create policy "settings_update_own" on public.user_settings for update
  to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- insert/delete 정책 없음: 가입 트리거 생성, profiles cascade

-- crews ─────────────────────────────────────
-- 막는 것: 비로그인 열람. 로그인 유저는 전원 조회 (탐색·매칭)
create policy "crews_select" on public.crews for select to authenticated using (true);
-- 막는 것: 남을 owner로 세워 크루 생성 (서버 액션이 사용자 JWT로 실행하므로 이 정책이 실제 문지기)
create policy "crews_insert_owner" on public.crews for insert
  to authenticated with check (owner_id = (select auth.uid()));
-- 막는 것: 리더 아닌 사람의 크루 수정. owner_id는 ④ 컬럼 권한으로 불변(양도는 Post-MVP)
create policy "crews_update_owner" on public.crews for update
  to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
-- 막는 것: 리더 아닌 사람의 크루 삭제
create policy "crews_delete_owner" on public.crews for delete
  to authenticated using (owner_id = (select auth.uid()));

-- crew_members ──────────────────────────────
-- 막는 것: 남의 크루 pending 신청자 열람 / show_crews=false인 사람의 소속 노출
-- 본인 행 · 리더(pending 포함) · approved 행은 같은 크루원이거나 그 멤버가 show_crews일 때
create policy "members_select" on public.crew_members for select
  to authenticated using (
    user_id = (select auth.uid())
    or public.is_crew_owner(crew_id)
    or (status = 'approved'
        and (public.is_crew_member(crew_id)
             or exists (select 1 from public.profiles p where p.id = user_id and p.show_crews)))
  );
-- 막는 것: 승인제 크루에 스스로 approved로 가입, 스스로 can_post 부여, 남 대신 가입 (리더 행은 트리거가 정책 밖에서 생성)
create policy "members_insert_join" on public.crew_members for insert
  to authenticated with check (
    user_id = (select auth.uid())
    and can_post = false
    and status = (select case when c.join_mode = 'open' then 'approved' else 'pending' end
                  from public.crews c where c.id = crew_id)
  );
-- 막는 것: 멤버가 스스로 승인/권한 변경. 리더만 남의 행 status·can_post 변경 — 리더 자기 행은 항상 approved·can_post라 수정 자체를 막음. crew_id·user_id는 ④ 컬럼 권한으로 불변
create policy "members_update_owner" on public.crew_members for update
  to authenticated
  using (public.is_crew_owner(crew_id) and user_id <> (select auth.uid()))
  with check (public.is_crew_owner(crew_id) and user_id <> (select auth.uid()));
-- 막는 것: 리더가 자기 크루를 버리고 나감(삭제만 가능) / 남의 크루에서 강퇴
create policy "members_delete" on public.crew_members for delete
  to authenticated using (
    (user_id = (select auth.uid()) and not public.is_crew_owner(crew_id))   -- 탈퇴
    or (public.is_crew_owner(crew_id) and user_id <> (select auth.uid()))   -- 강퇴·거절
  );

-- activities ────────────────────────────────
-- 막는 것: 남의 기록 열람. 본인 / 소유자가 public / 소유자가 crew이고 같은 크루 / 내가 볼 수 있는 글에 첨부됨
create policy "activities_select" on public.activities for select
  to authenticated using (
    user_id = (select auth.uid())
    or exists (select 1 from public.profiles p where p.id = user_id
               and (p.activity_visibility = 'public'
                    or (p.activity_visibility = 'crew' and public.shares_crew_with(user_id))))
    or exists (select 1 from public.posts po where po.activity_id = activities.id
               and (po.visibility = 'public' or public.is_crew_member(po.crew_id)))
  );
-- 막는 것: 남의 이름으로 기록 생성
create policy "activities_insert_own" on public.activities for insert
  to authenticated with check (user_id = (select auth.uid()));
-- 막는 것: 남의 기록 수정, 내 기록을 남에게 넘기기(user_id 변경)
create policy "activities_update_own" on public.activities for update
  to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- 막는 것: 남의 기록 삭제
create policy "activities_delete_own" on public.activities for delete
  to authenticated using (user_id = (select auth.uid()));

-- activity_routes ───────────────────────────
-- 막는 것: 프로필 공개(public/crew)만으로 경로 노출. 본인이거나 include_route=true인 볼 수 있는 글에 첨부됐을 때만
create policy "routes_select" on public.activity_routes for select
  to authenticated using (
    exists (select 1 from public.activities a where a.id = activity_id and a.user_id = (select auth.uid()))
    or exists (select 1 from public.posts po where po.activity_id = activity_routes.activity_id
               and po.include_route
               and (po.visibility = 'public' or public.is_crew_member(po.crew_id)))
  );
-- 막는 것: 남의 기록에 경로 붙이기, 야외 3종목 아닌 기록(헬스·수영·기타)에 경로 붙이기 (D-09). sport 불변이라 사후 우회도 불가
create policy "routes_insert_own" on public.activity_routes for insert
  to authenticated with check (
    exists (select 1 from public.activities a
            where a.id = activity_id and a.user_id = (select auth.uid())
              and a.sport in ('running','walking','cycling')));
-- 막는 것: 남의 경로 수정/삭제
create policy "routes_update_own" on public.activity_routes for update
  to authenticated
  using (exists (select 1 from public.activities a where a.id = activity_id and a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.activities a where a.id = activity_id and a.user_id = (select auth.uid())));
create policy "routes_delete_own" on public.activity_routes for delete
  to authenticated using (
    exists (select 1 from public.activities a where a.id = activity_id and a.user_id = (select auth.uid())));

-- exercise_sets ─────────────────────────────
-- 막는 것: 남의 세트 열람. 부모 기록을 볼 수 있으면 세트도 봄 (서브쿼리에 activities RLS가 그대로 적용됨)
create policy "sets_select" on public.exercise_sets for select
  to authenticated using (exists (select 1 from public.activities a where a.id = activity_id));
-- 막는 것: 남의 기록에 세트 끼워넣기, user_id 위조, 헬스 아닌 기록(러닝 등)에 세트 붙이기 — activities.sport는 ④에서 불변이라 나중에 종목을 바꿔 우회도 불가
create policy "sets_insert_own" on public.exercise_sets for insert
  to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.activities a
                where a.id = activity_id and a.user_id = (select auth.uid()) and a.sport = 'gym'));
-- 막는 것: 남의 세트 수정 — 이름 합치기 UPDATE가 실수로 범위를 넘어도 여기서 잘림 (D-15 시나리오)
create policy "sets_update_own" on public.exercise_sets for update
  to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "sets_delete_own" on public.exercise_sets for delete
  to authenticated using (user_id = (select auth.uid()));

-- meals ─────────────────────────────────────
-- 막는 것: 남의 식단 열람/위조/수정/삭제 — 네 정책 모두 본인 한정
create policy "meals_select_own" on public.meals for select to authenticated using (user_id = (select auth.uid()));
create policy "meals_insert_own" on public.meals for insert to authenticated with check (user_id = (select auth.uid()));
create policy "meals_update_own" on public.meals for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "meals_delete_own" on public.meals for delete to authenticated using (user_id = (select auth.uid()));

-- goals ─────────────────────────────────────
-- 막는 것: 남의 목표 열람/위조/수정/삭제
create policy "goals_select_own" on public.goals for select to authenticated using (user_id = (select auth.uid()));
create policy "goals_insert_own" on public.goals for insert to authenticated with check (user_id = (select auth.uid()));
create policy "goals_update_own" on public.goals for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "goals_delete_own" on public.goals for delete to authenticated using (user_id = (select auth.uid()));

-- ai_feedbacks ──────────────────────────────
-- 막는 것: 남의 피드백 열람
create policy "feedbacks_select_own" on public.ai_feedbacks for select
  to authenticated using (user_id = (select auth.uid()));
-- 막는 것: 사용자가 피드백을 위조/수정 — insert/update 정책 없음 → service_role(서버)만 씀
-- 막는 것: 남의 피드백 삭제 (본인 삭제는 허용)
create policy "feedbacks_delete_own" on public.ai_feedbacks for delete
  to authenticated using (user_id = (select auth.uid()));

-- posts ─────────────────────────────────────
-- 막는 것: 비멤버가 크루 전용 글 열람
create policy "posts_select" on public.posts for select
  to authenticated using (visibility = 'public' or public.is_crew_member(crew_id));
-- 막는 것: 남 이름으로 글쓰기 / 권한 없이 크루 태그 / 리더 아닌데 고정 / 남의 기록 첨부
create policy "posts_insert" on public.posts for insert
  to authenticated with check (
    author_id = (select auth.uid())
    and (crew_id is null or public.can_post_in_crew(crew_id))
    and (not is_pinned or public.is_crew_owner(crew_id))
    and (activity_id is null
         or exists (select 1 from public.activities a where a.id = activity_id and a.user_id = (select auth.uid())))
  );
-- 막는 것: 남의 글 수정 — 리더도 남의 본문은 못 고침(운영은 삭제만, D-18). 고정은 리더 본인 글만. author_id·crew_id는 ④ 컬럼 권한으로 불변(재태그는 삭제 후 재작성)
create policy "posts_update_own" on public.posts for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (
    author_id = (select auth.uid())
    and (not is_pinned or public.is_crew_owner(crew_id))
    and (activity_id is null
         or exists (select 1 from public.activities a where a.id = activity_id and a.user_id = (select auth.uid())))
  );
-- 막는 것: 남의 글 삭제 — 예외: 크루 리더는 자기 크루 글 삭제(운영)
create policy "posts_delete" on public.posts for delete
  to authenticated using (author_id = (select auth.uid()) or public.is_crew_owner(crew_id));

-- post_likes ────────────────────────────────
-- 막는 것: 못 보는 글의 좋아요 수/명단 열람 (posts RLS가 서브쿼리에 적용)
create policy "likes_select" on public.post_likes for select
  to authenticated using (exists (select 1 from public.posts p where p.id = post_id));
-- 막는 것: 남 이름으로 좋아요 / 못 보는 글에 좋아요
create policy "likes_insert_own" on public.post_likes for insert
  to authenticated with check (
    user_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
-- 막는 것: 남의 좋아요 취소
create policy "likes_delete_own" on public.post_likes for delete
  to authenticated using (user_id = (select auth.uid()));

-- comments ──────────────────────────────────
-- 막는 것: 못 보는 글의 댓글 열람
create policy "comments_select" on public.comments for select
  to authenticated using (exists (select 1 from public.posts p where p.id = post_id));
-- 막는 것: 남 이름으로 댓글 / 못 보는 글에 댓글
create policy "comments_insert_own" on public.comments for insert
  to authenticated with check (
    author_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
-- 막는 것: 남의 댓글 수정
create policy "comments_update_own" on public.comments for update
  to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
-- 막는 것: 남의 댓글 삭제 — 예외: 글이 속한 크루의 리더(운영)
create policy "comments_delete" on public.comments for delete
  to authenticated using (
    author_id = (select auth.uid())
    or exists (select 1 from public.posts p where p.id = post_id and public.is_crew_owner(p.crew_id)));

-- ═══════════════════════════════════════════
-- ④ 트리거 · 컬럼 권한
-- ═══════════════════════════════════════════

-- 크루 생성 → 리더 멤버십 (D-17 불변식)
create trigger crews_add_owner after insert on public.crews for each row execute function public.add_owner_membership();

-- updated_at 자동 갱신
create trigger set_updated_at before update on public.profiles      for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.user_settings for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.crews         for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.activities    for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.meals         for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.goals         for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.posts         for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.comments      for each row execute function public.set_updated_at();

-- 식별 컬럼 불변 (D-24 원칙 9): RLS는 "어느 행"만 정하므로 "어느 컬럼"은 컬럼 단위 GRANT로.
-- authenticated의 UPDATE 권한을 전부 회수하고 바뀌어도 되는 컬럼만 다시 부여. service_role은 영향 없음.
-- 막는 것: 리더가 crew_members.user_id를 남으로 바꿔 강제 가입 / 글 author_id·crew_id 변조 / id·user_id·created_at 변경
revoke update on all tables in schema public from authenticated;
grant update (nickname, main_sport, level, activity_visibility, show_crews)   on public.profiles      to authenticated;
grant update (real_name, region_sido, region_sigungu, preferred_days, goal_note) on public.user_settings to authenticated;
grant update (name, description, sport, level, region_sido, region_sigungu, activity_days, join_mode)
                                                                              on public.crews         to authenticated;
grant update (status, can_post)                                               on public.crew_members  to authenticated;
grant update (performed_on, started_at, duration_sec, distance_m, details, note)
                                                                              on public.activities    to authenticated;  -- sport 불변: 세트 붙은 기록의 종목 변경 차단
grant update (points)                                                         on public.activity_routes to authenticated;
grant update (exercise_name, set_no, reps, weight_kg)                         on public.exercise_sets to authenticated;
grant update (eaten_on, meal_type, items, note)                               on public.meals         to authenticated;
grant update (type, sport, target, period, is_active)                         on public.goals         to authenticated;
grant update (visibility, kind, sport, activity_id, include_route, is_pinned, content, image_path)
                                                                              on public.posts         to authenticated;
grant update (content)                                                        on public.comments      to authenticated;
-- ai_feedbacks · post_likes: authenticated UPDATE 없음 (재생성은 서버 upsert, 좋아요는 insert/delete만)
-- updated_at은 트리거가 채움 — 트리거 대입은 컬럼 권한 검사 대상이 아님

-- ═══════════════════════════════════════════
-- ⑤ storage  (버킷 post-images, public = false)
-- ═══════════════════════════════════════════
-- 사진 가시성 = 글 가시성 (D-26). 객체 이름 = posts.image_path = {author_id}/{uuid}.jpg
-- 클라는 <img src>에 인증 헤더를 못 실으므로 createSignedUrls(경로 배열, 만료초)로 URL을 받음 — 서명 시점에 아래 select 정책이 평가됨

insert into storage.buckets (id, name, public) values ('post-images', 'post-images', false)
  on conflict (id) do nothing;

-- 막는 것: 크루 밖 사용자가 크루 전용 글 사진 열람. 내 폴더이거나, 내가 볼 수 있는 글(posts RLS 상속)이 참조하는 객체만
create policy "images_select" on storage.objects for select
  to authenticated using (
    bucket_id = 'post-images'
    and ((storage.foldername(name))[1] = (select auth.uid())::text
         or exists (select 1 from public.posts p where p.image_path = name))
  );
-- 막는 것: 남의 폴더에 업로드
create policy "images_insert_own" on storage.objects for insert
  to authenticated with check (
    bucket_id = 'post-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- 막는 것: 남의 사진 삭제
create policy "images_delete_own" on storage.objects for delete
  to authenticated using (
    bucket_id = 'post-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- 글 저장 전 업로드만 하고 버린 고아 객체는 본인만 봄. 정리는 Post-MVP
