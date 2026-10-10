-- 크루 채팅 전체 복구: 기존 테이블/메시지 삭제 없음.
-- Supabase 프로젝트 hegpzybayxfcvtsniqsu의 새 SQL 쿼리에서 전체 실행하세요.
begin;
create table if not exists public.crew_messages (
 id uuid primary key, seq bigint generated always as identity unique,
 crew_id bigint not null references public.crews(id) on delete cascade,
 author_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check(char_length(btrim(body)) between 1 and 2000),
 created_at timestamptz not null default clock_timestamp()
);
create index if not exists crew_messages_room_seq on public.crew_messages(crew_id,seq desc);
create table if not exists public.crew_chat_reads (
 crew_id bigint not null references public.crews(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 last_seq bigint not null default 0 check(last_seq>=0), primary key(crew_id,user_id)
);
alter table public.crew_messages enable row level security;
alter table public.crew_chat_reads enable row level security;
drop policy if exists chat_read on public.crew_messages;
create policy chat_read on public.crew_messages for select to authenticated using(public.is_crew_member(crew_id) and not public.community_blocked(author_id));
drop policy if exists chat_send on public.crew_messages;
create policy chat_send on public.crew_messages for insert to authenticated with check(author_id=auth.uid() and public.is_crew_member(crew_id));
drop policy if exists chat_seen on public.crew_chat_reads;
create policy chat_seen on public.crew_chat_reads for all to authenticated using(user_id=auth.uid() and public.is_crew_member(crew_id)) with check(user_id=auth.uid() and public.is_crew_member(crew_id));
revoke all on public.crew_messages,public.crew_chat_reads from anon,authenticated;
grant select on public.crew_messages,public.crew_chat_reads to authenticated;
grant insert(id,crew_id,author_id,body) on public.crew_messages to authenticated;
grant usage on sequence public.crew_messages_seq_seq to authenticated;
grant insert(crew_id,user_id,last_seq),update(last_seq) on public.crew_chat_reads to authenticated;
create or replace function public.crew_chat_rooms() returns table(crew_id bigint,name text,last_body text,last_at timestamptz,unread bigint)
language sql stable security invoker set search_path='' as $$
 select c.id,c.name,l.body,l.created_at,
 (select count(*) from public.crew_messages m where m.crew_id=c.id and m.author_id<>auth.uid() and m.seq>coalesce(r.last_seq,0))
 from public.crews c join public.crew_members cm on cm.crew_id=c.id and cm.user_id=auth.uid() and cm.status='approved'
 left join public.crew_chat_reads r on r.crew_id=c.id and r.user_id=auth.uid()
 left join lateral(select body,created_at from public.crew_messages where crew_id=c.id order by seq desc limit 1) l on true
 order by l.created_at desc nulls last,c.name;
$$;
revoke all on function public.crew_chat_rooms() from public;
grant execute on function public.crew_chat_rooms() to authenticated;
-- Notifications are hints only. Every message fetch still passes RLS.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='crew_messages') then
 alter publication supabase_realtime add table public.crew_messages;
 end if;
end $$;
commit;

notify pgrst, 'reload schema';
select to_regclass('public.crew_messages') as messages_table,
       to_regclass('public.crew_chat_reads') as reads_table,
       to_regprocedure('public.crew_chat_rooms()') as rooms_function;

