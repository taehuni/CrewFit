-- Additive upgrade. Keeps existing accounts, crews, records, and posts.
begin;
create table if not exists public.member_cards (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 avatar_path text check (avatar_path is null or avatar_path like user_id::text || '/%'),
 bio text not null default '' check (char_length(bio)<=160)
);
create table if not exists public.crew_covers (
 crew_id bigint primary key references public.crews(id) on delete cascade,
 image_path text not null
);
create table if not exists public.member_blocks (
 user_id uuid references public.profiles(id) on delete cascade,
 blocked_id uuid references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,blocked_id), check(user_id<>blocked_id)
);
create or replace function public.community_blocked(p_other uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.member_blocks b where
 (b.user_id=auth.uid() and b.blocked_id=p_other) or (b.blocked_id=auth.uid() and b.user_id=p_other));
$$;
revoke all on function public.community_blocked(uuid) from public;
grant execute on function public.community_blocked(uuid) to authenticated;
create table if not exists public.notifications (
 id bigint generated always as identity primary key,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 actor_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null check(kind in ('comment','like','join_request','join_approved')),
 post_id bigint references public.posts(id) on delete cascade,
 crew_id bigint references public.crews(id) on delete cascade,
 event_key text not null unique,
 is_read boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists notifications_recipient on public.notifications(recipient_id,id desc);
create table if not exists public.content_reports (
 id bigint generated always as identity primary key,
 reporter_id uuid not null references public.profiles(id) on delete cascade,
 post_id bigint references public.posts(id) on delete set null,
 reason text not null check(reason in ('spam','abuse','privacy','other')),
 detail text not null default '' check(char_length(detail)<=1000),
 status text not null default 'received' check(status in ('received','reviewed','resolved')),
 created_at timestamptz not null default now(),
 unique(reporter_id,post_id)
);
alter table public.member_cards enable row level security;
alter table public.crew_covers enable row level security;
alter table public.member_blocks enable row level security;
alter table public.notifications enable row level security;
alter table public.content_reports enable row level security;
revoke all on public.member_cards,public.crew_covers,public.member_blocks,public.notifications,public.content_reports from anon,authenticated;
grant select,insert,delete on public.member_cards,public.crew_covers,public.member_blocks to authenticated;
grant update(avatar_path,bio) on public.member_cards to authenticated;
grant update(image_path) on public.crew_covers to authenticated;
grant select on public.notifications,public.content_reports to authenticated;
grant update(is_read) on public.notifications to authenticated;
grant insert(reporter_id,post_id,reason,detail) on public.content_reports to authenticated;
grant usage on sequence public.content_reports_id_seq to authenticated;
grant all on public.member_cards,public.crew_covers,public.member_blocks,public.notifications,public.content_reports to service_role;
drop policy if exists cards_read on public.member_cards;
create policy cards_read on public.member_cards for select to authenticated using (not public.community_blocked(user_id));
drop policy if exists cards_write on public.member_cards;
create policy cards_write on public.member_cards for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists covers_read on public.crew_covers;
create policy covers_read on public.crew_covers for select to authenticated using(true);
drop policy if exists covers_write on public.crew_covers;
create policy covers_write on public.crew_covers for all to authenticated using(public.is_crew_owner(crew_id)) with check(public.is_crew_owner(crew_id) and image_path like auth.uid()::text || '/%');
drop policy if exists blocks_own on public.member_blocks;
create policy blocks_own on public.member_blocks for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications for select to authenticated using(recipient_id=auth.uid() and not public.community_blocked(actor_id) and (post_id is null or exists(select 1 from public.posts p where p.id=post_id)));
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated using(recipient_id=auth.uid()) with check(recipient_id=auth.uid());
drop policy if exists reports_read on public.content_reports;
create policy reports_read on public.content_reports for select to authenticated using(reporter_id=auth.uid());
drop policy if exists reports_insert on public.content_reports;
create policy reports_insert on public.content_reports for insert to authenticated with check(reporter_id=auth.uid() and status='received' and exists(select 1 from public.posts p where p.id=post_id and p.author_id<>auth.uid()));
drop policy if exists posts_blocked on public.posts;
create policy posts_blocked on public.posts as restrictive for select to authenticated using(not public.community_blocked(author_id));
drop policy if exists comments_blocked on public.comments;
create policy comments_blocked on public.comments as restrictive for select to authenticated using(not public.community_blocked(author_id));

create or replace function public.community_notify() returns trigger
language plpgsql security definer set search_path='' as $$
declare recipient uuid; actor uuid; event text; post bigint; crew bigint; key text;
begin
 if tg_table_name in ('comments','post_likes') then
   select p.author_id,p.crew_id into recipient,crew from public.posts p where p.id=new.post_id;
   post:=new.post_id;
   if tg_table_name='comments' then actor:=new.author_id; event:='comment'; key:='comment:'||new.id;
   else actor:=new.user_id; event:='like'; key:='like:'||new.post_id||':'||new.user_id; end if;
 elsif tg_table_name='crew_members' then
   crew:=new.crew_id;
   if tg_op='INSERT' and new.status='pending' then
     select c.owner_id into recipient from public.crews c where c.id=crew; actor:=new.user_id; event:='join_request';
   elsif tg_op='UPDATE' then
     if old.status='pending' and new.status='approved' then
       recipient:=new.user_id; select c.owner_id into actor from public.crews c where c.id=crew; event:='join_approved';
     end if;
   end if;
   key:=event||':'||crew||':'||new.user_id||':'||new.joined_at;
 end if;
 if event is not null and recipient is not null and recipient<>actor and not exists(select 1 from public.member_blocks b where (b.user_id=recipient and b.blocked_id=actor) or (b.user_id=actor and b.blocked_id=recipient)) then
   insert into public.notifications(recipient_id,actor_id,kind,post_id,crew_id,event_key) values(recipient,actor,event,post,crew,key) on conflict(event_key) do nothing;
 end if;
 return new;
end;
$$;
revoke all on function public.community_notify() from public,anon,authenticated;
drop trigger if exists community_comment_notification on public.comments;
create trigger community_comment_notification after insert on public.comments for each row execute function public.community_notify();
drop trigger if exists community_like_notification on public.post_likes;
create trigger community_like_notification after insert on public.post_likes for each row execute function public.community_notify();
drop trigger if exists community_membership_notification on public.crew_members;
create trigger community_membership_notification after insert or update on public.crew_members for each row execute function public.community_notify();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('community-media','community-media',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
drop policy if exists community_media_read on storage.objects;
create policy community_media_read on storage.objects for select to authenticated using(bucket_id='community-media' and ((storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.member_cards c where c.avatar_path=name) or exists(select 1 from public.crew_covers c where c.image_path=name)));
drop policy if exists community_media_insert on storage.objects;
create policy community_media_insert on storage.objects for insert to authenticated with check(bucket_id='community-media' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists community_media_delete on storage.objects;
create policy community_media_delete on storage.objects for delete to authenticated using(bucket_id='community-media' and (storage.foldername(name))[1]=auth.uid()::text);

create or replace function public.feed_summaries(p_ids bigint[]) returns table(post_id bigint,likes bigint,comments bigint,liked boolean)
language sql stable security invoker set search_path='' as $$
 select p.id,(select count(*) from public.post_likes l where l.post_id=p.id),(select count(*) from public.comments c where c.post_id=p.id),exists(select 1 from public.post_likes l where l.post_id=p.id and l.user_id=auth.uid())
 from public.posts p where p.id=any(p_ids) and cardinality(p_ids)<=100;
$$;
create or replace function public.crew_recent_activity(p_ids bigint[]) returns table(crew_id bigint,last_post_at timestamptz)
language sql stable security invoker set search_path='' as $$
 select p.crew_id,max(p.created_at) from public.posts p where p.crew_id=any(p_ids) and cardinality(p_ids)<=100 group by p.crew_id;
$$;
revoke all on function public.feed_summaries(bigint[]),public.crew_recent_activity(bigint[]) from public;
grant execute on function public.feed_summaries(bigint[]),public.crew_recent_activity(bigint[]) to authenticated;
notify pgrst,'reload schema';
commit;
