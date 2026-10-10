begin;
alter table public.coach_turns add column if not exists meal_proposals jsonb not null default '[]' check(jsonb_typeof(meal_proposals)='array' and jsonb_array_length(meal_proposals)<=7);
create table if not exists public.nutrition_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 goal text not null default 'balanced' check(goal in ('balanced','fitness','muscle','weight')),
 allergies text not null default '' check(char_length(allergies)<=300),
 avoid text not null default '' check(char_length(avoid)<=300),
 preference text not null default '' check(char_length(preference)<=300)
);
create table if not exists public.meal_plans (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 turn_id uuid not null,position integer not null check(position between 0 and 6),
 title text not null check(char_length(title) between 1 and 100),scheduled_on date not null,
 meal_type text not null check(meal_type in ('breakfast','lunch','dinner','snack')),
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 10),
 note text not null default '' check(char_length(note)<=1000),created_at timestamptz not null default now(),
 unique(user_id,turn_id,position), unique(user_id,id),
 foreign key(user_id,turn_id) references public.coach_turns(user_id,id) on delete cascade
);
alter table public.nutrition_preferences enable row level security;
alter table public.meal_plans enable row level security;
drop policy if exists nutrition_own on public.nutrition_preferences;
create policy nutrition_own on public.nutrition_preferences for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists meal_plans_own on public.meal_plans;
create policy meal_plans_own on public.meal_plans for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
revoke all on public.nutrition_preferences,public.meal_plans from anon,authenticated;
grant select,insert,update on public.nutrition_preferences to authenticated;
grant select,insert,delete on public.meal_plans to authenticated;
create index if not exists meal_plans_user_date on public.meal_plans(user_id,scheduled_on);
-- A stable source marker keeps retries from creating duplicate meal records.
-- It remains after plan deletion; it deliberately is not a foreign key.
alter table public.meals add column if not exists source_meal_plan_id uuid;
create unique index if not exists meals_source_plan_unique on public.meals(user_id,source_meal_plan_id) where source_meal_plan_id is not null;
commit;
select to_regclass('public.nutrition_preferences') as nutrition_preferences,to_regclass('public.meal_plans') as meal_plans;
