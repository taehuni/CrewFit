-- Review and run separately. No existing workout/meal/plan data is deleted.
begin;
-- Directly authored plans do not require a fabricated AI conversation.
alter table public.workout_plans alter column turn_id drop not null;
alter table public.workout_plans alter column position drop not null;
grant update(title,sport,scheduled_on,start_time,minutes,note) on public.workout_plans to authenticated;
drop policy if exists plans_update on public.workout_plans;
create policy plans_update on public.workout_plans for update to authenticated
 using(user_id=auth.uid()) with check(user_id=auth.uid());

create table if not exists public.workout_plan_records (
 plan_id uuid primary key references public.workout_plans(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 activity_id bigint not null unique references public.activities(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.workout_plan_records enable row level security;
revoke all on public.workout_plan_records from anon,authenticated;
grant select,insert on public.workout_plan_records to authenticated;
drop policy if exists workout_plan_records_read on public.workout_plan_records;
create policy workout_plan_records_read on public.workout_plan_records for select to authenticated using(user_id=auth.uid());
drop policy if exists workout_plan_records_insert on public.workout_plan_records;
create policy workout_plan_records_insert on public.workout_plan_records for insert to authenticated with check(
 user_id=auth.uid()
 and exists(select 1 from public.workout_plans p where p.id=plan_id and p.user_id=auth.uid())
 and exists(select 1 from public.activities a where a.id=activity_id and a.user_id=auth.uid())
);

-- Locking the owner-scoped plan makes retries and concurrent submissions idempotent.
-- Activity and completion are written together; an error rolls both back.
-- Deleting a plan removes this link only, never the activity itself.
create or replace function public.record_workout_plan(p_plan_id uuid,p_activity jsonb,p_sets jsonb default '[]')
returns bigint language plpgsql security invoker set search_path='' as $$
declare v_id bigint; v_owner uuid:=auth.uid(); v_sport text;
begin
 if v_owner is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform 1 from public.workout_plans where id=p_plan_id and user_id=v_owner for update;
 if not found then raise exception 'Plan unavailable' using errcode='42501'; end if;
 select activity_id into v_id from public.workout_plan_records where plan_id=p_plan_id and user_id=v_owner;
 if found then return v_id; end if;
 if jsonb_typeof(p_activity) is distinct from 'object' or jsonb_typeof(p_sets) is distinct from 'array' then raise exception 'Invalid workout'; end if;
 v_sport:=p_activity->>'sport';
 if v_sport is null or v_sport not in ('running','walking','cycling','swimming','gym','other')
    or coalesce((p_activity->>'duration_sec')::integer,0)<1
    or coalesce(length(p_activity->>'note'),0)>1000 then raise exception 'Invalid workout'; end if;
 if v_sport='gym' then
  if jsonb_array_length(p_sets)<1 or jsonb_array_length(p_sets)>100 then raise exception 'Invalid sets'; end if;
  v_id:=public.save_gym_activity((p_activity->>'performed_on')::date,(p_activity->>'duration_sec')::integer,p_activity->>'note',p_sets);
 else
  insert into public.activities(user_id,sport,performed_on,duration_sec,distance_m,note,details)
   values(v_owner,v_sport,(p_activity->>'performed_on')::date,(p_activity->>'duration_sec')::integer,
    (p_activity->>'distance_m')::integer,p_activity->>'note',coalesce(p_activity->'details','{}'::jsonb)) returning id into v_id;
 end if;
 insert into public.workout_plan_records(plan_id,user_id,activity_id) values(p_plan_id,v_owner,v_id);
 return v_id;
end $$;
revoke all on function public.record_workout_plan(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.record_workout_plan(uuid,jsonb,jsonb) to authenticated;

-- Preserve the GPS import path. Existing finalize_gps_draft verifies auth.uid()
-- and owns GPS route creation; a failed link rolls back finalization as well.
create or replace function public.record_workout_plan_gps(p_plan_id uuid,p_draft_id uuid,p_note text default null)
returns bigint language plpgsql security invoker set search_path='' as $$
declare v_id bigint; v_owner uuid:=auth.uid();
begin
 if v_owner is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform 1 from public.workout_plans where id=p_plan_id and user_id=v_owner for update;
 if not found then raise exception 'Plan unavailable' using errcode='42501'; end if;
 select activity_id into v_id from public.workout_plan_records where plan_id=p_plan_id and user_id=v_owner;
 if found then return v_id; end if;
 if coalesce(length(p_note),0)>1000 then raise exception 'Invalid note'; end if;
 v_id:=public.finalize_gps_draft(p_draft_id,p_note);
 insert into public.workout_plan_records(plan_id,user_id,activity_id) values(p_plan_id,v_owner,v_id);
 return v_id;
end $$;
revoke all on function public.record_workout_plan_gps(uuid,uuid,text) from public,anon;
grant execute on function public.record_workout_plan_gps(uuid,uuid,text) to authenticated;
commit;
