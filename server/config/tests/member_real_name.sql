-- D-28 권한 회귀 테스트. 마이그레이션 적용 후 Supabase SQL Editor의 postgres 역할로 실행.
-- 테스트 전용 계정/크루를 만들고 마지막에 ROLLBACK한다. 오류가 나면 ROLLBACK을 실행할 것.
begin;

create temporary table name_test_actors (actor text primary key, id uuid, crew_id bigint);
insert into name_test_actors(actor, id) values
  ('owner', gen_random_uuid()), ('member', gen_random_uuid()),
  ('pending', gen_random_uuid()), ('outsider', gen_random_uuid());
grant select on name_test_actors to authenticated;

insert into auth.users (id, email, raw_user_meta_data)
select id, id::text || '@crewfit-test.invalid',
  jsonb_build_object('nickname', actor, 'real_name', '  이름-' || actor || '  ')
from name_test_actors;

-- 가입 트리거가 이름을 trim하고 비공개 설정에만 저장했는지 검사.
do $$
declare
  v_id uuid;
  v_metadata jsonb;
  v_invalid_name text;
begin
  if (select count(*) from public.user_settings s join name_test_actors t on t.id = s.user_id
      where s.real_name = '이름-' || t.actor) <> 4 then
    raise exception 'FAIL: 가입 실명 저장';
  end if;
  -- 폼 밖 계정 생성: 키 누락, JSON null, 공백, 메타데이터 자체 NULL.
  for v_metadata in
    select metadata from (values
      ('{}'::jsonb), ('{"real_name":null}'::jsonb),
      ('{"real_name":"   "}'::jsonb), (null::jsonb)
    ) as cases(metadata)
  loop
    v_id := gen_random_uuid();
    insert into auth.users (id, email, raw_user_meta_data)
    values (v_id, v_id::text || '@crewfit-test.invalid', v_metadata);
    if not exists (
      select 1 from public.user_settings s
      join public.profiles p on p.id = s.user_id
      where s.user_id = v_id and s.real_name is null
    ) then
      raise exception 'FAIL: 실명 없는 계정의 프로필/NULL 설정 생성';
    end if;
  end loop;
  -- 값이 있는 경우에는 가입 경로에서도 DB 검증 유지.
  foreach v_invalid_name in array array[repeat('가', 51), E'잘못된\n이름'] loop
    begin
      insert into auth.users (id, email, raw_user_meta_data)
      values (gen_random_uuid(), gen_random_uuid()::text || '@crewfit-test.invalid',
        jsonb_build_object('nickname', 'invalid', 'real_name', v_invalid_name));
      raise exception 'FAIL: 잘못된 실명 가입 허용';
    exception when check_violation then null;
    end;
  end loop;
  if has_function_privilege('anon', 'public.crew_member_names(bigint)', 'EXECUTE') then
    raise exception 'FAIL: anon RPC 실행 권한';
  end if;
end $$;

insert into public.regions(sido, sigungu)
select '__name_test__', id::text from name_test_actors where actor = 'owner';
with created as (
  insert into public.crews(owner_id, name, sport, region_sido, region_sigungu)
  select id, '실명 권한 테스트', 'running', '__name_test__', id::text
  from name_test_actors where actor = 'owner'
  returning id
)
update name_test_actors set crew_id = created.id from created;

insert into public.crew_members(crew_id, user_id, status)
select crew_id, id, case when actor = 'pending' then 'pending' else 'approved' end
from name_test_actors where actor in ('member', 'pending');

set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from name_test_actors where actor = 'owner'), true);
do $$
declare v_crew bigint := (select crew_id from name_test_actors where actor = 'owner');
begin
  if (select count(*) from public.crew_member_names(v_crew)) <> 2 then
    raise exception 'FAIL: 크루장은 본인과 approved 회원만 조회';
  end if;
  if exists (select 1 from public.crew_member_names(v_crew) where real_name = '이름-pending') then
    raise exception 'FAIL: pending 실명 노출';
  end if;
  if (select count(*) from public.user_settings) <> 1 then
    raise exception 'FAIL: 크루장에게 다른 회원의 비공개 설정 노출';
  end if;
  begin
    perform public.crew_member_names(-1);
    raise exception 'FAIL: 없는 크루 접근 허용';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 일반 회원·대기자·외부인의 RPC 접근은 모두 거부.
do $$
declare actor_row record;
begin
  for actor_row in select * from name_test_actors where actor <> 'owner' loop
    perform set_config('request.jwt.claim.sub', actor_row.id::text, true);
    begin
      perform public.crew_member_names(actor_row.crew_id);
      raise exception 'FAIL: 비소유자 RPC 허용 (%)', actor_row.actor;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;

-- 본인 이름 수정만 가능, 식별 컬럼 수정·길이/빈 문자열은 차단.
select set_config('request.jwt.claim.sub', (select id::text from name_test_actors where actor = 'member'), true);
do $$
declare affected integer;
begin
  update public.user_settings set real_name = '수정한 이름' where user_id = auth.uid();
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FAIL: 본인 이름 수정'; end if;
  update public.user_settings set real_name = '변조' where user_id <> auth.uid();
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: 남의 이름 수정 허용'; end if;
  begin
    update public.user_settings set real_name = '' where user_id = auth.uid();
    raise exception 'FAIL: 빈 이름 저장 허용';
  exception when check_violation then null;
  end;
  begin
    update public.user_settings set real_name = repeat('가', 51) where user_id = auth.uid();
    raise exception 'FAIL: 이름 최대 길이 우회';
  exception when check_violation then null;
  end;
  begin
    update public.user_settings set user_id = gen_random_uuid() where user_id = auth.uid();
    raise exception 'FAIL: user_id 수정 허용';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 탈퇴 직후 이전 크루장에게 이름이 보이지 않는다.
delete from public.crew_members where user_id = auth.uid();
select set_config('request.jwt.claim.sub', (select id::text from name_test_actors where actor = 'owner'), true);
do $$
begin
  if (select count(*) from public.crew_member_names((select crew_id from name_test_actors where actor = 'owner'))) <> 1 then
    raise exception 'FAIL: 탈퇴 회원 실명 노출';
  end if;
end $$;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  begin
    perform public.crew_member_names(null);
    raise exception 'FAIL: anon RPC 호출 허용';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
