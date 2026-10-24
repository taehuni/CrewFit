begin;
alter table public.coach_turns drop constraint if exists coach_turns_proposals_check;
alter table public.coach_turns add constraint coach_turns_proposals_check check(jsonb_typeof(proposals)='array' and jsonb_array_length(proposals)<=28);
alter table public.workout_plans drop constraint if exists workout_plans_position_check;
alter table public.workout_plans add constraint workout_plans_position_check check(position between 0 and 27);
commit;
