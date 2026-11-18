-- Additive migration for review; do not run automatically against production.
-- Only summary text is stored. There are no video, image or landmark columns.
begin;
create or replace function public.valid_pose_observations(items jsonb, exercise text, view_name text)
returns boolean language plpgsql immutable set search_path = public as $$
declare item jsonb; seen text[] := '{}'; allowed text[];
begin
 if jsonb_typeof(items) <> 'array' then return false; end if;
 if jsonb_array_length(items)>5 then return false; end if;
 allowed := case when view_name='front' then array['leftKnee','rightKnee'] when exercise='pushup' then array['bodyLine'] else array['heel','torso'] end;
 for item in select value from jsonb_array_elements(items) loop
  if jsonb_typeof(item)<>'object' then return false; end if;
  if not (item ?& array['key','label','message']) or (item - array['key','label','message']) <> '{}'::jsonb then return false; end if;
  if jsonb_typeof(item->'key')<>'string' or jsonb_typeof(item->'label')<>'string' or jsonb_typeof(item->'message')<>'string' then return false; end if;
  if not (item->>'key'=any(allowed)) or item->>'key'=any(seen) then return false; end if;
  if char_length(btrim(item->>'label')) not between 1 and 60 or char_length(btrim(item->>'message')) not between 1 and 500 then return false; end if;
  seen:=array_append(seen,item->>'key');
 end loop;
 return true;
end $$;
create table if not exists public.pose_sessions (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 measured_on date not null check(measured_on between date '2000-01-01' and date '2100-12-31'),
 exercise text not null check(exercise in ('squat','lunge','pushup')),
 view text not null,
 reps integer,
 duration_seconds integer not null check(duration_seconds between 1 and 86400),
 observations jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now(),
 check((exercise='squat' and view in ('side','front')) or (exercise='lunge' and view in ('left','right')) or (exercise='pushup' and view='side')),
 check((view='front' and reps is null) or (view<>'front' and reps is not null and reps between 0 and 10000)),
 check(public.valid_pose_observations(observations,exercise,view))
);
create index if not exists pose_sessions_user_date on public.pose_sessions(user_id,measured_on desc,created_at desc,id desc);
alter table public.pose_sessions enable row level security;
revoke all on public.pose_sessions from anon,authenticated;
grant select on public.pose_sessions to authenticated;
grant insert(id,user_id,measured_on,exercise,view,reps,duration_seconds,observations) on public.pose_sessions to authenticated;
drop policy if exists pose_sessions_read on public.pose_sessions;
create policy pose_sessions_read on public.pose_sessions for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists pose_sessions_insert on public.pose_sessions;
create policy pose_sessions_insert on public.pose_sessions for insert to authenticated with check(user_id=(select auth.uid()));
commit;
select to_regclass('public.pose_sessions') as pose_sessions;
