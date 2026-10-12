-- The Actions run on Supabase's clock, 12 October 2026. GitHub's own cron is best effort, and on this repo it dropped
-- most runs: no ingest at all on 12 Oct before 11:00 UTC, the hourly publishing run twice in 11 hours, the 07:00
-- review queue never. pg_cron runs on time and starts each workflow through GitHub's API (workflow_dispatch), with a
-- fine-grained token (Actions: read and write on giuulio/grub.cam) kept in Vault, set once in the SQL editor:
--   select vault.create_secret('github_pat_…', 'github_dispatch_token');
-- (to replace it: select vault.update_secret(id, 'github_pat_…') from vault.secrets where name = 'github_dispatch_token')
-- The submit function starts the publishing workflow the same way, so the token lives only here.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Starts one of the repo's workflows on main; the request's id (its answer lands in net._http_response), or null
-- when there's no token yet.
create or replace function public.dispatch_workflow(workflow text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare token text;
begin
  if workflow not in ('ingest.yml', 'photos.yml', 'queue.yml') then
    raise exception 'unknown workflow %', workflow;
  end if;
  select decrypted_secret into token from vault.decrypted_secrets where name = 'github_dispatch_token';
  if token is null then
    raise warning 'dispatch_workflow(%): no github_dispatch_token in Vault', workflow;
    return null;
  end if;
  return net.http_post(
    url := 'https://api.github.com/repos/giuulio/grub.cam/actions/workflows/' || workflow || '/dispatches',
    body := jsonb_build_object('ref', 'main'),
    headers := jsonb_build_object('authorization', 'Bearer ' || token, 'accept', 'application/vnd.github+json', 'user-agent', 'grub.cam', 'content-type', 'application/json')
  );
end $$;
revoke execute on function public.dispatch_workflow from public, anon, authenticated;
grant execute on function public.dispatch_workflow to service_role;

-- A reading its sender never confirmed can't be confirmed after a day (the submit function refuses): a person takes it
create or replace function public.hand_over_unconfirmed()
returns integer language sql security definer set search_path = '' as $$
  with moved as (
    update public.submissions set status = 'needs_review', review_note = 'the sender didn’t confirm the reading within a day'
    where status = 'transcribed' and created_at < now() - interval '1 day'
    returning 1
  )
  select count(*)::integer from moved
$$;
revoke execute on function public.hand_over_unconfirmed from public, anon, authenticated;

-- UTC, as the workflows' old schedules were: the ingest every two hours through the day, publishing hourly to catch
-- anything the submit function's own start missed, the review queue each morning and after the evening's ingest
select cron.schedule('ingest', '37 4,6,8,10,12,14,16,18 * * *', $$select public.dispatch_workflow('ingest.yml')$$);
select cron.schedule('publish', '23 * * * *', $$select public.dispatch_workflow('photos.yml')$$);
select cron.schedule('review-queue', '0 7,18 * * *', $$select public.dispatch_workflow('queue.yml')$$);
select cron.schedule('hand-over-unconfirmed', '10 * * * *', $$select public.hand_over_unconfirmed()$$);

-- What a correction ("Report a change") is about, chosen on /send, so the queue can say it
alter table submissions
  add column topic text check (topic in ('hours', 'prices', 'menu', 'formal', 'diet', 'location', 'closed', 'other'));
