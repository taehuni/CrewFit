-- Supabase SQL Editor에서 이 파일만 실행. 기존 테이블·기록은 초기화하지 않는다.
-- 헬스 수정 함수·권한 및 기록 삭제 시 게시글 경로 첨부를 해제하는 트리거를 추가한다.
begin;

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

notify pgrst, 'reload schema';
commit;
