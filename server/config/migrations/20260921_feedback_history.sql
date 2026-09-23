-- Existing feedback is preserved. Run once in Supabase SQL Editor.
begin;
lock table public.ai_feedbacks in share row exclusive mode;

create table if not exists public.ai_feedback_history (
  id bigint generated always as identity primary key,
  feedback_id bigint not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  period text not null check (period in ('day','week','month')),
  period_start date not null,
  content text not null,
  model text,
  llm_calls integer not null,
  created_at timestamptz not null,
  unique (feedback_id, llm_calls),
  check (period <> 'week' or extract(isodow from period_start) = 1),
  check (period <> 'month' or extract(day from period_start) = 1)
);
create index if not exists feedback_history_owner_id on public.ai_feedback_history(user_id, id desc);
alter table public.ai_feedback_history enable row level security;
revoke all on public.ai_feedback_history from public, anon, authenticated;
grant select on public.ai_feedback_history to authenticated;
grant all on public.ai_feedback_history to service_role;
grant usage, select on sequence public.ai_feedback_history_id_seq to service_role;
drop policy if exists feedback_history_select_own on public.ai_feedback_history;
create policy feedback_history_select_own on public.ai_feedback_history
  for select to authenticated using (user_id = (select auth.uid()));

-- No FK to the cache: deleting a cache row must not erase coaching history.
insert into public.ai_feedback_history(feedback_id,user_id,period,period_start,content,model,llm_calls,created_at)
select id,user_id,period,period_start,content,model,llm_calls,created_at
from public.ai_feedbacks order by created_at, id
on conflict (feedback_id,llm_calls) do nothing;

create or replace function public.archive_ai_feedback() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' then
    if new.content is not distinct from old.content and new.llm_calls = old.llm_calls then
      return new;
    end if;
  end if;
  insert into public.ai_feedback_history(feedback_id,user_id,period,period_start,content,model,llm_calls,created_at)
  values(new.id,new.user_id,new.period,new.period_start,new.content,new.model,new.llm_calls,new.created_at);
  return new;
end;
$$;
revoke all on function public.archive_ai_feedback() from public, anon, authenticated;
drop trigger if exists archive_ai_feedback on public.ai_feedbacks;
create trigger archive_ai_feedback after insert or update on public.ai_feedbacks
  for each row execute function public.archive_ai_feedback();
commit;
