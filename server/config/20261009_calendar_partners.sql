begin;
create table if not exists public.calendar_exports (
 user_id uuid not null references public.profiles(id) on delete cascade,
 plan_id uuid not null references public.workout_plans(id) on delete cascade,
 event_id text not null, event_url text not null,
 created_at timestamptz not null default now(), primary key(user_id,plan_id)
);
alter table public.calendar_exports enable row level security;
drop policy if exists calendar_read on public.calendar_exports;
create policy calendar_read on public.calendar_exports for select to authenticated using(user_id=auth.uid());
drop policy if exists calendar_insert on public.calendar_exports;
create policy calendar_insert on public.calendar_exports for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.workout_plans p where p.id=plan_id and p.user_id=auth.uid()));
revoke all on public.calendar_exports from anon,authenticated;
grant select,insert on public.calendar_exports to authenticated;
create table if not exists public.partner_reservations (
 id uuid primary key, user_id uuid not null references public.profiles(id) on delete cascade,
 offer_id text not null, facility_name text not null, offer_name text not null,
 amount integer not null check(amount>=0), visit_on date not null,
 status text not null default 'pending' check(status in ('pending','test_paid','cancelled')),
 mode text not null default 'simulation' check(mode='simulation'),
 created_at timestamptz not null default now(), paid_at timestamptz,
 cancelled_at timestamptz
);
create index if not exists partner_reservations_user_time on public.partner_reservations(user_id,created_at desc);
alter table public.partner_reservations enable row level security;
drop policy if exists reservations_read on public.partner_reservations;
create policy reservations_read on public.partner_reservations for select to authenticated using(user_id=auth.uid());
revoke all on public.partner_reservations from anon,authenticated;
grant select on public.partner_reservations to authenticated;
grant select,insert,update,delete on public.partner_reservations to service_role;
notify pgrst,'reload schema';
commit;
select to_regclass('public.calendar_exports') as calendar_table,to_regclass('public.partner_reservations') as reservations_table;
