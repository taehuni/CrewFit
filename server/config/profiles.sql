-- Supabase SQL Editor에 붙여넣어 실행. (auth.users는 Supabase Auth가 관리)
-- profiles: 로그인 유저의 앱 프로필(닉네임 등). auth.users와 1:1.

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nickname   text not null,
  created_at timestamptz default now()
);

-- RLS: 각자 자기 프로필만 읽기/수정. (service_role 서버는 RLS 우회)
alter table public.profiles enable row level security;

create policy "본인 프로필 조회" on public.profiles
  for select using (auth.uid() = id);
create policy "본인 프로필 수정" on public.profiles
  for update using (auth.uid() = id);

-- 회원가입 시 닉네임(user_metadata.nickname)으로 profiles 자동 생성.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, coalesce(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
