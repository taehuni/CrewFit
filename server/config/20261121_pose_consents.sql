-- Additive migration. Does not modify workouts, images or videos.
begin;
create table if not exists public.pose_analysis_consents (
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('recognition','observation')),
  version text not null check (length(version) between 1 and 40),
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id,scope,version)
);
alter table public.pose_analysis_consents enable row level security;
revoke all on public.pose_analysis_consents from anon,authenticated;
grant select,insert,update on public.pose_analysis_consents to authenticated;
drop policy if exists pose_consent_read on public.pose_analysis_consents;
create policy pose_consent_read on public.pose_analysis_consents for select to authenticated using (user_id=auth.uid());
drop policy if exists pose_consent_insert on public.pose_analysis_consents;
create policy pose_consent_insert on public.pose_analysis_consents for insert to authenticated with check (user_id=auth.uid());
drop policy if exists pose_consent_update on public.pose_analysis_consents;
create policy pose_consent_update on public.pose_analysis_consents for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
commit;
select to_regclass('public.pose_analysis_consents') as pose_analysis_consents;
