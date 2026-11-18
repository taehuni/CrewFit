-- Review and run separately. Existing rows and policies are preserved.
begin;
grant update (title, sport, scheduled_on, start_time, minutes, note)
  on public.workout_plans to authenticated;
drop policy if exists plans_update on public.workout_plans;
create policy plans_update on public.workout_plans
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
commit;
