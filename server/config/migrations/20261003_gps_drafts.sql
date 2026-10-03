begin;
create table if not exists public.gps_drafts (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  sport text not null check (sport in ('running','walking','cycling')),
  performed_on date not null,
  started_at timestamptz not null,
  duration_sec integer not null check (duration_sec between 1 and 21600),
  distance_m integer not null check (distance_m >= 0),
  points jsonb not null check (jsonb_typeof(points) = 'array' and jsonb_array_length(points) between 2 and 10000),
  note text check (length(note) <= 1000),
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  activity_id bigint references public.activities(id) on delete set null
);
create index if not exists gps_drafts_owner_date on public.gps_drafts(user_id, performed_on, sport) where finalized_at is null;
alter table public.gps_drafts enable row level security;
revoke all on public.gps_drafts from public, anon, authenticated;
grant select, delete on public.gps_drafts to authenticated;
drop policy if exists gps_drafts_select on public.gps_drafts;
create policy gps_drafts_select on public.gps_drafts for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists gps_drafts_delete on public.gps_drafts;
create policy gps_drafts_delete on public.gps_drafts for delete to authenticated using (user_id = (select auth.uid()) and finalized_at is null);

create or replace function public.save_gps_draft(
  p_id uuid, p_sport text, p_started_at timestamptz, p_duration_sec integer,
  p_distance_m integer, p_note text, p_points jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_owner uuid; v_point jsonb;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_id is null or p_started_at is null or not isfinite(p_started_at) or p_points is null
    or jsonb_typeof(p_points) <> 'array' then raise exception 'Invalid measurement' using errcode = '22023'; end if;
  if jsonb_array_length(p_points) not between 2 and 10000 then raise exception 'Invalid route length' using errcode = '22023'; end if;
  for v_point in select value from jsonb_array_elements(p_points) loop
    if jsonb_typeof(v_point) <> 'array' or jsonb_array_length(v_point) <> 3 then raise exception 'Invalid route point' using errcode = '22023'; end if;
    if jsonb_typeof(v_point->0) <> 'number' or jsonb_typeof(v_point->1) <> 'number' or jsonb_typeof(v_point->2) <> 'number' then raise exception 'Invalid coordinates' using errcode = '22023'; end if;
    if (v_point->>0)::numeric not between -90 and 90 or (v_point->>1)::numeric not between -180 and 180 or (v_point->>2)::numeric <= 0 then raise exception 'Invalid coordinates' using errcode = '22023'; end if;
  end loop;
  insert into public.gps_drafts(id,user_id,sport,performed_on,started_at,duration_sec,distance_m,note,points)
  values(p_id,v_user,p_sport,(p_started_at at time zone 'Asia/Seoul')::date,p_started_at,p_duration_sec,p_distance_m,p_note,p_points)
  on conflict (id) do nothing;
  select user_id into v_owner from public.gps_drafts where id = p_id;
  if v_owner is distinct from v_user then raise exception 'Measurement not available' using errcode = '42501'; end if;
  return p_id;
end;
$$;

create or replace function public.finalize_gps_draft(p_id uuid, p_note text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_draft public.gps_drafts%rowtype; v_activity bigint;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_draft from public.gps_drafts where id = p_id and user_id = v_user for update;
  if not found then raise exception 'Measurement not available' using errcode = 'P0002'; end if;
  if v_draft.finalized_at is not null then
    if v_draft.activity_id is null then raise exception 'Original activity was deleted' using errcode = 'P0002'; end if;
    return v_draft.activity_id;
  end if;
  if length(p_note) > 1000 then raise exception 'Note too long' using errcode = '22023'; end if;
  insert into public.activities(user_id,sport,performed_on,started_at,duration_sec,distance_m,note)
  values(v_user,v_draft.sport,v_draft.performed_on,v_draft.started_at,v_draft.duration_sec,v_draft.distance_m,p_note)
  returning id into v_activity;
  insert into public.activity_routes(activity_id,points) values(v_activity,v_draft.points);
  update public.gps_drafts set finalized_at = now(), activity_id = v_activity where id = p_id;
  return v_activity;
end;
$$;
revoke all on function public.save_gps_draft(uuid,text,timestamptz,integer,integer,text,jsonb), public.finalize_gps_draft(uuid,text) from public, anon, authenticated;
grant execute on function public.save_gps_draft(uuid,text,timestamptz,integer,integer,text,jsonb), public.finalize_gps_draft(uuid,text) to authenticated;
commit;
