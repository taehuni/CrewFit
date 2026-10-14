begin;
create table if not exists public.member_follows (
 follower_id uuid not null references public.profiles(id) on delete cascade,
 following_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(follower_id, following_id),
 check(follower_id <> following_id)
);
create index if not exists member_follows_target on public.member_follows(following_id, follower_id);
alter table public.member_follows enable row level security;
revoke all on public.member_follows from anon, authenticated;
grant select, delete on public.member_follows to authenticated;
grant insert(follower_id, following_id) on public.member_follows to authenticated;
drop policy if exists follows_read on public.member_follows;
create policy follows_read on public.member_follows for select to authenticated
 using(not public.community_blocked(follower_id) and not public.community_blocked(following_id));
drop policy if exists follows_add on public.member_follows;
create policy follows_add on public.member_follows for insert to authenticated
 with check(follower_id=(select auth.uid()) and follower_id<>following_id and not public.community_blocked(following_id));
drop policy if exists follows_remove on public.member_follows;
create policy follows_remove on public.member_follows for delete to authenticated
 using(follower_id=(select auth.uid()));
commit;
select to_regclass('public.member_follows');
