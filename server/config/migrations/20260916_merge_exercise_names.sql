-- 기존 데이터는 보존한다. Supabase SQL Editor에서 이 파일만 실행.
begin;
-- D-05/D-15: 서버 API에서 사용자 JWT로 호출. 이름만 한 문장으로 변경한다.
create or replace function public.merge_exercise_names(p_from text, p_to text)
returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  v_from text := btrim(p_from);
  v_to text := btrim(p_to);
  v_updated integer;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if v_from is null or v_to is null
    or char_length(v_from) not between 1 and 100
    or char_length(v_to) not between 1 and 100
    or lower(v_from) = lower(v_to) then
    raise exception 'invalid exercise names' using errcode = '22023';
  end if;
  update public.exercise_sets
    set exercise_name = v_to
    where user_id = (select auth.uid()) and lower(exercise_name) = lower(v_from);
  get diagnostics v_updated = row_count;
  return v_updated;
end $$;
revoke all on function public.merge_exercise_names(text, text) from public, anon, authenticated;
grant execute on function public.merge_exercise_names(text, text) to authenticated;
notify pgrst, 'reload schema';
commit;
