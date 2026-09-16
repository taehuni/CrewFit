-- D-28: 보존할 데이터가 있으면 이 마이그레이션 사용. schema.sql 리셋은 초기화 가능한 개발 DB 전용.
-- Supabase SQL Editor에서 이 파일만 적용 후 tests/member_real_name.sql로 권한 확인.
begin;

alter table public.user_settings add column if not exists real_name text;
alter table public.user_settings drop constraint if exists user_settings_real_name_check;
alter table public.user_settings add constraint user_settings_real_name_check check (
  real_name is null or (real_name = btrim(real_name)
    and char_length(real_name) between 1 and 50 and real_name !~ '[[:cntrl:]]')
);

-- 신규 폼에서 이미 가입한 계정만 유효한 입력값을 복구한다. 닉네임·이메일로 실명을 추정하지 않는다.
update public.user_settings s
set real_name = btrim(u.raw_user_meta_data->>'real_name')
from auth.users u
where u.id = s.user_id and s.real_name is null
  and char_length(btrim(u.raw_user_meta_data->>'real_name')) between 1 and 50
  and btrim(u.raw_user_meta_data->>'real_name') !~ '[[:cntrl:]]';

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, nickname)
    values (new.id, coalesce(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1)));
  -- 가입 폼은 필수. 메타데이터가 없는 관리자 생성 등은 NULL 허용 (D-28).
  insert into user_settings (user_id, real_name)
    values (new.id, nullif(btrim(new.raw_user_meta_data->>'real_name'), ''));
  return new;
end $$;

-- settings_select_own / settings_update_own은 그대로 유지한다.
grant update (real_name) on public.user_settings to authenticated;

-- 크루장 전용 실명 조회. user_settings의 다른 비공개 컬럼은 반환하지 않는다 (D-28).
create or replace function public.crew_member_names(p_crew_id bigint)
returns table (user_id uuid, real_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.crews c
    where c.id = p_crew_id and c.owner_id = (select auth.uid())
  ) then
    raise exception '크루장만 실명을 조회할 수 있습니다' using errcode = '42501';
  end if;
  return query
    select m.user_id, s.real_name
    from public.crew_members m
    join public.user_settings s on s.user_id = m.user_id
    where m.crew_id = p_crew_id and m.status = 'approved';
end $$;
revoke all on function public.crew_member_names(bigint) from public, anon, authenticated;
grant execute on function public.crew_member_names(bigint) to authenticated;

commit;
