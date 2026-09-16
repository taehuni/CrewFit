-- 마이그레이션 적용 후 테스트 DB SQL Editor(postgres 역할)에서 실행.
-- 테스트 계정·기록은 ROLLBACK한다. 오류로 중단되면 ROLLBACK부터 실행.
begin;
create temporary table merge_test_users(actor text primary key, id uuid);
insert into merge_test_users values ('owner', gen_random_uuid()), ('other', gen_random_uuid());
grant select on merge_test_users to authenticated;
insert into auth.users(id, email, raw_user_meta_data)
select id, id::text || '@crewfit-test.invalid', jsonb_build_object('nickname', actor) from merge_test_users;
create temporary table merge_test_records(actor text, slot integer, id bigint);
grant select on merge_test_records to authenticated;
with created as (
  insert into public.activities(user_id, sport, performed_on, duration_sec, note)
  select id, 'gym', date '2026-09-16', 1800, slot::text from merge_test_users cross join generate_series(1,2) slot
  returning id, user_id, note
)
insert into merge_test_records select u.actor, c.note::integer, c.id from created c join merge_test_users u on c.user_id=u.id;
insert into public.exercise_sets(activity_id, user_id, exercise_name, set_no, reps, weight_kg)
select r.id, u.id, case when r.slot=1 then 'Bench' else 'bENCH' end, 1, 10, 60
from merge_test_records r join merge_test_users u on u.actor=r.actor;
insert into public.exercise_sets(activity_id, user_id, exercise_name, set_no, reps, weight_kg)
select r.id, u.id, names.name, 1, 8, 20 from merge_test_records r join merge_test_users u on u.actor=r.actor
cross join (values ('Old'), ('100%_*'), ('100abc')) names(name) where r.actor='owner';
insert into public.exercise_sets(activity_id, user_id, exercise_name, set_no, reps, weight_kg)
select r.id, u.id, 'Target', 1, 12, 30 from merge_test_records r join merge_test_users u on u.actor=r.actor
where r.actor='owner' and r.slot=1;

do $$ begin
  if has_function_privilege('anon', 'public.merge_exercise_names(text,text)', 'EXECUTE') then
    raise exception 'FAIL: anonymous execution allowed';
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from merge_test_users where actor='owner'), true);
do $$ begin
  if public.merge_exercise_names(' bench ', ' 벤치프레스 ') <> 2 then raise exception 'FAIL: case-insensitive count'; end if;
  if public.merge_exercise_names('missing', '새 이름') <> 0 then raise exception 'FAIL: nonexistent source'; end if;
  if public.merge_exercise_names('100%_*', '특수문자 운동') <> 2 then raise exception 'FAIL: literal match'; end if;
  if (select count(*) from public.exercise_sets where user_id=(select auth.uid()) and exercise_name='100abc') <> 2 then
    raise exception 'FAIL: wildcard matched unrelated rows';
  end if;
  begin
    perform public.merge_exercise_names('Old', 'Target');
    raise exception 'FAIL: duplicate set number accepted';
  exception when unique_violation then null;
  end;
  if (select count(*) from public.exercise_sets where user_id=(select auth.uid()) and exercise_name='Old') <> 2 then
    raise exception 'FAIL: conflict partially renamed records';
  end if;
  begin
    perform public.merge_exercise_names('Old', 'old');
    raise exception 'FAIL: same name accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.merge_exercise_names(null, 'new');
    raise exception 'FAIL: null name accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.exercise_sets where user_id=(select id from merge_test_users where actor='other') and lower(exercise_name)='bench') <> 2 then
    raise exception 'FAIL: another account changed';
  end if;
  if exists(select 1 from public.exercise_sets where exercise_name='벤치프레스' and (reps<>10 or weight_kg<>60 or set_no<>1)) then
    raise exception 'FAIL: set values changed';
  end if;
  if exists(select 1 from public.activities where user_id in (select id from merge_test_users) and (duration_sec<>1800 or performed_on<>date '2026-09-16')) then
    raise exception 'FAIL: parent values changed';
  end if;
end $$;
rollback;
