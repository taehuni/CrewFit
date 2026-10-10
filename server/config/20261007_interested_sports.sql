-- Additive migration: preserves existing accounts and records. Safe to repeat.
begin;
alter table public.user_settings add column if not exists interested_sports text[]
  constraint user_settings_interested_sports_check check (
    interested_sports is null or (
      cardinality(interested_sports) <= 6
      and array_position(interested_sports, null) is null
      and interested_sports <@ array['running','walking','cycling','swimming','gym','other']::text[]
    )
  );
grant update(interested_sports) on public.user_settings to authenticated;
commit;
