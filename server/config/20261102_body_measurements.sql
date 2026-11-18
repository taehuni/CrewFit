-- Additive migration. Existing tables and records are not changed.
begin;
create table if not exists public.body_measurements (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 measured_on date not null check(measured_on between date '2000-01-01' and date '2100-12-31'),
 weight_kg numeric(6,2) not null check(weight_kg between 1 and 500),
 skeletal_muscle_kg numeric(6,2) check(skeletal_muscle_kg between 0 and 500 and skeletal_muscle_kg<=weight_kg),
 body_fat_percent numeric(5,2) check(body_fat_percent between 0 and 100),
 note text not null default '' check(char_length(note)<=500),
 source_label text not null default '' check(char_length(source_label)<=60),
 created_at timestamptz not null default now()
);
create index if not exists body_measurements_user_date on public.body_measurements(user_id,measured_on desc,created_at desc,id desc);
alter table public.body_measurements enable row level security;
revoke all on public.body_measurements from anon,authenticated;
grant select,delete on public.body_measurements to authenticated;
grant insert(id,user_id,measured_on,weight_kg,skeletal_muscle_kg,body_fat_percent,note,source_label) on public.body_measurements to authenticated;
grant update(measured_on,weight_kg,skeletal_muscle_kg,body_fat_percent,note,source_label) on public.body_measurements to authenticated;
drop policy if exists body_measurements_read on public.body_measurements;
create policy body_measurements_read on public.body_measurements for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists body_measurements_insert on public.body_measurements;
create policy body_measurements_insert on public.body_measurements for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists body_measurements_update on public.body_measurements;
create policy body_measurements_update on public.body_measurements for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists body_measurements_delete on public.body_measurements;
create policy body_measurements_delete on public.body_measurements for delete to authenticated using(user_id=(select auth.uid()));
commit;
select to_regclass('public.body_measurements');
