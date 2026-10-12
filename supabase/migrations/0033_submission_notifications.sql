-- Notify for every new submission, including those published automatically. Old rows form the baseline.
alter table public.submissions add column notified_at timestamptz;
update public.submissions set notified_at = now();
create index submissions_unnotified_idx on public.submissions(created_at) where notified_at is null;
comment on column public.submissions.notified_at is 'When the queue Action announced receipt on GitHub; service role only, independent of publication status.';

create function public.dispatch_submission_notifications()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.submissions where notified_at is null) then
    perform public.dispatch_workflow('queue.yml');
  end if;
end $$;
revoke execute on function public.dispatch_submission_notifications from public, anon, authenticated;

create function public.notify_new_submission()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.dispatch_submission_notifications();
  return null;
exception when others then
  -- A notification failure must not discard someone's submission. The retry job will pick it up.
  raise warning 'submission notification dispatch failed: %', sqlerrm;
  return null;
end $$;
revoke execute on function public.notify_new_submission from public, anon, authenticated;
create trigger submission_notification after insert on public.submissions
  for each statement execute function public.notify_new_submission();

-- Dispatch immediately above, retry missed/failed deliveries every ten minutes, keep the twice-daily digest too.
select cron.schedule('submission-notifications', '*/10 * * * *', $$select public.dispatch_submission_notifications()$$);
