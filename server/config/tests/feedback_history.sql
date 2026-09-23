-- Run after the migration in a TEST Supabase DB as postgres. All fixtures roll back.
begin;
create temporary table feedback_test_users(actor text, id uuid);
insert into feedback_test_users values ('owner', gen_random_uuid()), ('other', gen_random_uuid());
grant select on feedback_test_users to authenticated, service_role;
insert into auth.users(id,email,raw_user_meta_data)
select id,id::text || '@crewfit-test.invalid',jsonb_build_object('nickname',actor) from feedback_test_users;
set local role service_role;
insert into public.ai_feedbacks(user_id,period,period_start,content,source_hash,llm_calls)
select id,'day',date '2026-09-21','first','hash1',1 from feedback_test_users;
update public.ai_feedbacks set content='second',source_hash='hash2',llm_calls=2,regen_count=1
where user_id=(select id from feedback_test_users where actor='owner');
-- A read/cache hit does not create a revision.
select id from public.ai_feedbacks where user_id=(select id from feedback_test_users where actor='owner');
do $$ begin
  if (select count(*) from public.ai_feedback_history where user_id=(select id from feedback_test_users where actor='owner')) <> 2 then
    raise exception 'FAIL: revision count';
  end if;
  if not exists(select 1 from public.ai_feedback_history where user_id=(select id from feedback_test_users where actor='owner') and content='first') then
    raise exception 'FAIL: old coaching lost';
  end if;
  -- Force archive failure: same generation version with different content.
  begin
    update public.ai_feedbacks set content='must rollback' where user_id=(select id from feedback_test_users where actor='owner');
    raise exception 'FAIL: duplicate revision accepted';
  exception when unique_violation then null;
  end;
  if not exists(select 1 from public.ai_feedbacks where user_id=(select id from feedback_test_users where actor='owner') and content='second') then
    raise exception 'FAIL: cache updated without history';
  end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from feedback_test_users where actor='owner'),true);
do $$ begin
  if (select count(*) from public.ai_feedback_history) <> 2 then raise exception 'FAIL: owner visibility'; end if;
  if exists(select 1 from public.ai_feedback_history where user_id=(select id from feedback_test_users where actor='other')) then
    raise exception 'FAIL: other user visible';
  end if;
  if has_table_privilege('authenticated','public.ai_feedback_history','INSERT')
    or has_table_privilege('authenticated','public.ai_feedback_history','UPDATE')
    or has_table_privilege('authenticated','public.ai_feedback_history','DELETE')
    or has_table_privilege('anon','public.ai_feedback_history','SELECT') then
    raise exception 'FAIL: history permissions';
  end if;
end $$;
reset role;
rollback;
