-- Review-only additive migration. Do not execute automatically in production.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('pose-videos','pose-videos',false,33554432,array['video/webm','video/mp4'])
on conflict(id) do update set public=false,file_size_limit=33554432,allowed_mime_types=array['video/webm','video/mp4'];

create table if not exists public.pose_session_videos (
 id uuid primary key,
 session_id uuid unique references public.pose_sessions(id) on delete set null,
 -- Retain object keys; account-deletion storage removal is not implemented.
 user_id uuid not null,
 object_path text not null unique,
 mime_type text not null check(mime_type in ('video/webm','video/mp4')),
 size_bytes integer not null check(size_bytes between 12 and 33554432),
 duration_seconds double precision not null check(duration_seconds>0 and duration_seconds<=120),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 state text not null default 'uploading' check(state in ('uploading','ready','delete_pending','deleted')),
 created_at timestamptz not null default now(),
 check(object_path=user_id::text||'/'||id::text||'/'||sha256||case when mime_type='video/mp4' then '.mp4' else '.webm' end)
);
alter table public.pose_session_videos enable row level security;
revoke all on public.pose_session_videos from public,anon,authenticated;
grant select,insert,update,delete on public.pose_session_videos to service_role;
-- Restrictive policies also deny access if a broader pre-existing storage
-- policy allows authenticated users to access every bucket.
drop policy if exists pose_videos_no_client_access on storage.objects;
create policy pose_videos_no_client_access on storage.objects as restrictive
for all to anon,authenticated
using(bucket_id<>'pose-videos') with check(bucket_id<>'pose-videos');
commit;
