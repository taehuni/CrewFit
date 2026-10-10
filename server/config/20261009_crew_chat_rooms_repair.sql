-- 기존 테이블과 메시지는 유지하고 누락된 목록 함수만 추가합니다.
begin;
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

notify pgrst, 'reload schema';
commit;
select to_regprocedure('public.crew_chat_rooms()') as chat_function;

