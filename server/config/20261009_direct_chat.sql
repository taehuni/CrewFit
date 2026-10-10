begin;
create table if not exists public.direct_messages (
 id uuid primary key, seq bigint generated always as identity unique,
 author_id uuid not null references public.profiles(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check(char_length(btrim(body)) between 1 and 2000),
 created_at timestamptz not null default clock_timestamp(), check(author_id<>recipient_id)
);
create index if not exists direct_messages_author_seq on public.direct_messages(author_id,seq desc);
create index if not exists direct_messages_recipient_seq on public.direct_messages(recipient_id,seq desc);
create table if not exists public.direct_chat_reads (
 user_id uuid not null references public.profiles(id) on delete cascade,
 peer_id uuid not null references public.profiles(id) on delete cascade,
 last_seq bigint not null default 0 check(last_seq>=0), primary key(user_id,peer_id),check(user_id<>peer_id)
);
alter table public.direct_messages enable row level security;
alter table public.direct_chat_reads enable row level security;
drop policy if exists direct_read on public.direct_messages;
create policy direct_read on public.direct_messages for select to authenticated using(
 (author_id=auth.uid() or recipient_id=auth.uid()) and not public.community_blocked(case when author_id=auth.uid() then recipient_id else author_id end));
drop policy if exists direct_send on public.direct_messages;
create policy direct_send on public.direct_messages for insert to authenticated with check(author_id=auth.uid() and not public.community_blocked(recipient_id));
drop policy if exists direct_seen on public.direct_chat_reads;
create policy direct_seen on public.direct_chat_reads for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
revoke all on public.direct_messages,public.direct_chat_reads from anon,authenticated;
grant select on public.direct_messages,public.direct_chat_reads to authenticated;
grant insert(id,author_id,recipient_id,body) on public.direct_messages to authenticated;
grant usage on sequence public.direct_messages_seq_seq to authenticated;
grant insert(user_id,peer_id,last_seq),update(last_seq) on public.direct_chat_reads to authenticated;
create or replace function public.direct_chat_rooms() returns table(peer_id uuid,nickname text,last_body text,last_at timestamptz,unread bigint)
language sql stable security invoker set search_path='' as $$
 with peers as(select distinct case when author_id=auth.uid() then recipient_id else author_id end as id from public.direct_messages)
 select p.id,p.nickname,l.body,l.created_at,
 (select count(*) from public.direct_messages m where m.author_id=p.id and m.recipient_id=auth.uid() and m.seq>coalesce(r.last_seq,0))
 from peers join public.profiles p on p.id=peers.id
 left join public.direct_chat_reads r on r.peer_id=p.id and r.user_id=auth.uid()
 join lateral(select body,created_at from public.direct_messages where author_id=p.id or recipient_id=p.id order by seq desc limit 1) l on true
 order by l.created_at desc;
$$;
revoke all on function public.direct_chat_rooms() from public;
grant execute on function public.direct_chat_rooms() to authenticated;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='direct_messages') then
 alter publication supabase_realtime add table public.direct_messages;
 end if;
end $$;
notify pgrst, 'reload schema';
commit;
select to_regclass('public.direct_messages'),to_regclass('public.direct_chat_reads'),to_regprocedure('public.direct_chat_rooms()');
