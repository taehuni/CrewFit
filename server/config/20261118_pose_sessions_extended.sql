-- Review-only additive migration. Preserves existing sessions; run after 20261104_pose_sessions.sql.
begin;
alter table public.pose_sessions add column if not exists exercise_label text;
create or replace function public.pose_reference_criteria_count(exercise_name text)
returns integer language sql immutable set search_path='' as $$
 select case exercise_name when 'leg_press' then 2
 when 'goblet_squat' then 2
 when 'bulgarian_split_squat' then 2
 when 'lying_leg_curl' then 2
 when 'barbell_deadlift' then 2
 when 'floor_bridge' then 2
 when 'good_morning' then 2
 when 'seated_leg_curl' then 2
 when 'leg_press_calf_raise' then 2
 when 'single_leg_press' then 2
 when 'kettlebell_deadlift' then 2
 when 'dumbbell_romanian_deadlift' then 2
 when 'bodyweight_squat' then 2
 when 'forward_lunge' then 2
 when 'floor_pushup' then 2
 when 'barbell_bench_press' then 2
 when 'dumbbell_bench_press' then 2
 when 'incline_dumbbell_press' then 2
 when 'dumbbell_chest_fly' then 2
 when 'seated_cable_press' then 2
 when 'barbell_bent_over_row' then 2
 when 'single_arm_dumbbell_row' then 2
 when 'seated_cable_row' then 2
 when 'machine_seated_row' then 2
 when 'lat_pulldown' then 2
 when 'chin_up' then 2
 when 'cable_high_row' then 2
 when 'cable_reverse_fly' then 2
 when 'front_raise' then 2
 when 'lateral_raise' then 2
 when 'standing_dumbbell_shoulder_press' then 2
 when 'incline_prone_row' then 2
 when 'seated_rear_lateral_raise' then 2
 when 'barbell_curl' then 2
 when 'hammer_curl' then 2
 when 'reverse_curl' then 2
 when 'triceps_pushdown' then 2
 when 'lying_triceps_extension' then 2
 when 'triceps_kickback' then 2
 when 'bench_dip' then 2
 when 'forearm_plank' then 2
 when 'side_plank' then 2
 when 'straight_arm_plank' then 2
 when 'plank_walkup' then 2
 when 'dead_bug' then 2
 when 'bird_dog' then 2
 when 'crunch' then 2
 when 'jumping_jack' then 2
 when 'burpee' then 2 else 0 end
$$;
create or replace function public.valid_pose_observations(items jsonb, exercise text, view_name text)
returns boolean language plpgsql immutable set search_path='' as $$
declare item jsonb; seen text[] := '{}'; allowed text[]; total integer;
begin
 if items is null or jsonb_typeof(items)<>'array' then return false; end if;
 if jsonb_array_length(items)>5 then return false; end if;
 if exercise='manual_other' then return jsonb_array_length(items)=0; end if;
 total:=public.pose_reference_criteria_count(exercise);
 if total>0 then
  if view_name<>'auto' then return false; end if;
  select array_agg('criterion_'||n::text) into allowed from generate_series(0,total-1) n;
 else
  if exercise not in ('squat','lunge','pushup') then return false; end if;
  allowed:=case when view_name='front' then array['leftKnee','rightKnee'] when exercise='pushup' then array['bodyLine'] else array['heel','torso'] end;
 end if;
 for item in select value from jsonb_array_elements(items) loop
  if jsonb_typeof(item)<>'object' or not(item ?& array['key','label','message']) then return false; end if;
  if total>0 then
   if not(item ? 'source_id') or jsonb_typeof(item->'source_id')<>'string' or item->>'source_id'<>exercise or (item-array['key','label','message','source_id'])<>'{}'::jsonb then return false; end if;
  elsif (item-array['key','label','message'])<>'{}'::jsonb then return false;
  end if;
  if jsonb_typeof(item->'key')<>'string' or jsonb_typeof(item->'label')<>'string' or jsonb_typeof(item->'message')<>'string' then return false; end if;
  if not(item->>'key'=any(allowed)) or item->>'key'=any(seen) then return false; end if;
  if char_length(btrim(item->>'label')) not between 1 and 60 or char_length(btrim(item->>'message')) not between 1 and 500 then return false; end if;
  seen:=array_append(seen,item->>'key');
 end loop;
 return true;
end $$;
-- Replace only the earlier exercise/view/repetition/observation checks; keep dates/duration/owner/RLS intact.
do $$ declare rule record; begin
 for rule in select conname,pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='public.pose_sessions'::regclass and contype='c' loop
  if rule.definition ~ '\m(exercise|view|reps|observations)\M' then
   execute format('alter table public.pose_sessions drop constraint %I',rule.conname);
  end if;
 end loop;
end $$;
alter table public.pose_sessions add constraint pose_sessions_extended_shape check(
 (exercise in ('squat','lunge','pushup') and exercise_label is null and
  ((exercise='squat' and view in ('side','front')) or (exercise='lunge' and view in ('left','right')) or (exercise='pushup' and view='side')) and
  ((view='front' and reps is null) or (view<>'front' and reps is not null and reps between 0 and 10000)))
 or (exercise in ('leg_press','goblet_squat','bulgarian_split_squat','lying_leg_curl','barbell_deadlift','floor_bridge','good_morning','seated_leg_curl','leg_press_calf_raise','single_leg_press','kettlebell_deadlift','dumbbell_romanian_deadlift','bodyweight_squat','forward_lunge','floor_pushup','barbell_bench_press','dumbbell_bench_press','incline_dumbbell_press','dumbbell_chest_fly','seated_cable_press','barbell_bent_over_row','single_arm_dumbbell_row','seated_cable_row','machine_seated_row','lat_pulldown','chin_up','cable_high_row','cable_reverse_fly','front_raise','lateral_raise','standing_dumbbell_shoulder_press','incline_prone_row','seated_rear_lateral_raise','barbell_curl','hammer_curl','reverse_curl','triceps_pushdown','lying_triceps_extension','triceps_kickback','bench_dip','forearm_plank','side_plank','straight_arm_plank','plank_walkup','dead_bug','bird_dog','crunch','jumping_jack','burpee') and view='auto' and reps is null and exercise_label is null)
 or (exercise='manual_other' and view='manual' and reps is null and exercise_label is not null and char_length(btrim(exercise_label)) between 1 and 60 and exercise_label !~ '[[:cntrl:]]')
);
alter table public.pose_sessions add constraint pose_sessions_extended_observations check(public.valid_pose_observations(observations,exercise,view));
grant insert(exercise_label) on public.pose_sessions to authenticated;
commit;
