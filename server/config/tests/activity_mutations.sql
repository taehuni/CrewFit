-- 마이그레이션 적용 후 테스트 DB의 Supabase SQL Editor(postgres 역할)에서 실행.
-- 테스트 계정·기록을 만들고 ROLLBACK한다. 오류가 나면 ROLLBACK부터 실행.
begin;
create temporary table activity_test_actors(actor text primary key, id uuid, gym_id bigint, running_id bigint);
insert into activity_test_actors(actor,id) values ('owner',gen_random_uuid()),('other',gen_random_uuid());
grant select on activity_test_actors to authenticated;
insert into auth.users(id,email,raw_user_meta_data)
select id,id::text || '@crewfit-test.invalid',jsonb_build_object('nickname',actor,'real_name','테스트')
from activity_test_actors;
insert into public.activities(user_id,sport,performed_on,duration_sec,note)
select a.id,s.sport,date '2026-09-14',1800,'before' from activity_test_actors a cross join (values ('gym'),('running')) s(sport);
update activity_test_actors t set
  gym_id=(select a.id from public.activities a where a.user_id=t.id and a.sport='gym'),
  running_id=(select a.id from public.activities a where a.user_id=t.id and a.sport='running');
insert into public.exercise_sets(activity_id,user_id,exercise_name,set_no,reps,weight_kg)
select gym_id,id,'Squat',1,10,20 from activity_test_actors;
insert into public.activity_routes(activity_id,points)
select running_id,'[]'::jsonb from activity_test_actors;
insert into public.posts(author_id,visibility,kind,sport,activity_id,include_route,content)
select id,'public','log','running',running_id,true,'mutation test' from activity_test_actors where actor='owner';

do $$ begin
  if has_function_privilege('anon','public.update_gym_activity(bigint,date,integer,text,jsonb)','EXECUTE') then
    raise exception 'FAIL: anon execute allowed';
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from activity_test_actors where actor='owner'),true);
do $$
declare
  own_id bigint := (select gym_id from activity_test_actors where actor='owner');
  other_id bigint := (select gym_id from activity_test_actors where actor='other');
  run_id bigint := (select running_id from activity_test_actors where actor='owner');
  affected integer;
begin
  perform public.update_gym_activity(own_id,'2026-09-13',2405,'after',
    '[{"exercise_name":"Squat","set_no":1,"reps":12,"weight_kg":0},{"exercise_name":"Squat","set_no":2,"reps":null,"weight_kg":null}]');
  if not exists(select 1 from public.activities where id=own_id and duration_sec=2405 and performed_on='2026-09-13' and sport='gym') then
    raise exception 'FAIL: common fields update';
  end if;
  if (select count(*) from public.exercise_sets where activity_id=own_id) <> 2 then
    raise exception 'FAIL: sets not replaced';
  end if;
  begin
    perform public.update_gym_activity(own_id,'2026-09-12',999,'bad',
      '[{"exercise_name":"Bad","set_no":1,"reps":-1,"weight_kg":20}]');
    raise exception 'FAIL: invalid set accepted';
  exception when check_violation then null;
  end;
  if not exists(select 1 from public.activities where id=own_id and duration_sec=2405 and note='after')
    or (select count(*) from public.exercise_sets where activity_id=own_id) <> 2 then
    raise exception 'FAIL: partial update after failed set';
  end if;
  begin
    perform public.update_gym_activity(own_id,'2026-09-14',100,'bad','[]');
    raise exception 'FAIL: empty sets accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.update_gym_activity(other_id,'2026-09-14',100,'bad',
      '[{"exercise_name":"X","set_no":1,"reps":1,"weight_kg":0}]');
    raise exception 'FAIL: another user updated';
  exception when no_data_found then null;
  end;
  begin
    perform public.update_gym_activity(run_id,'2026-09-14',100,'bad',
      '[{"exercise_name":"X","set_no":1,"reps":1,"weight_kg":0}]');
    raise exception 'FAIL: running changed via gym RPC';
  exception when no_data_found then null;
  end;
  delete from public.activities where id=other_id;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: another user deleted'; end if;
  delete from public.activities where id=own_id;
  delete from public.activities where id=run_id;
end $$;
reset role;
do $$ begin
  if exists(select 1 from public.exercise_sets where activity_id=(select gym_id from activity_test_actors where actor='owner'))
    or exists(select 1 from public.activity_routes where activity_id=(select running_id from activity_test_actors where actor='owner')) then
    raise exception 'FAIL: child cascade';
  end if;
  if not exists(select 1 from public.posts where author_id=(select id from activity_test_actors where actor='owner') and activity_id is null and not include_route) then
    raise exception 'FAIL: post attachment was not cleared';
  end if;
  if not exists(select 1 from public.activities where id=(select gym_id from activity_test_actors where actor='other') and note='before') then
    raise exception 'FAIL: other member changed';
  end if;
end $$;
rollback;
