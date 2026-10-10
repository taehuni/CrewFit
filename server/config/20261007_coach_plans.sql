begin;
create table if not exists public.coach_turns (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 message text not null check(char_length(message) between 1 and 2000),
 answer text not null check(char_length(answer) between 1 and 6000),
 proposals jsonb not null default '[]' check(jsonb_typeof(proposals)='array' and jsonb_array_length(proposals)<=7),
 created_at timestamptz not null default now(), unique(user_id,id)
);
create table if not exists public.workout_plans (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 turn_id uuid not null, position integer not null check(position between 0 and 6),
 title text not null check(char_length(title) between 1 and 100),
 sport text not null check(sport in ('running','walking','cycling','swimming','gym','other')),
 scheduled_on date not null, start_time time not null,
 minutes integer not null check(minutes between 5 and 240), note text not null default '' check(char_length(note)<=1000),
 created_at timestamptz not null default now(), unique(user_id,turn_id,position),
 foreign key(user_id,turn_id) references public.coach_turns(user_id,id) on delete cascade
);
create index if not exists coach_turns_user_time on public.coach_turns(user_id,created_at desc);
create index if not exists workout_plans_user_date on public.workout_plans(user_id,scheduled_on);
alter table public.coach_turns enable row level security;
alter table public.workout_plans enable row level security;
drop policy if exists coach_read on public.coach_turns;
create policy coach_read on public.coach_turns for select to authenticated using(user_id=auth.uid());
drop policy if exists coach_insert on public.coach_turns;
create policy coach_insert on public.coach_turns for insert to authenticated with check(user_id=auth.uid());
drop policy if exists plans_read on public.workout_plans;
create policy plans_read on public.workout_plans for select to authenticated using(user_id=auth.uid());
drop policy if exists plans_insert on public.workout_plans;
create policy plans_insert on public.workout_plans for insert to authenticated with check(user_id=auth.uid());
drop policy if exists plans_delete on public.workout_plans;
create policy plans_delete on public.workout_plans for delete to authenticated using(user_id=auth.uid());
revoke all on public.coach_turns,public.workout_plans from anon,authenticated;
grant select,insert on public.coach_turns to authenticated;
grant select,insert,delete on public.workout_plans to authenticated;
commit;
