-- Sending in needs a Cambridge account, 9 October 2026: Supabase Auth with Microsoft (Entra ID) as the provider,
-- pinned to the University's tenant (49a50445-bdfa-4b79-ade3-547b4f3986e9) in the dashboard, and, whatever the
-- provider, only an @cam.ac.uk address gets an account here. A submission remembers who sent it.

-- Reject any account that isn't a University one before it exists. (A trigger on auth.users: Supabase's own tables,
-- but a before-insert check is the one place every sign-up passes.)
create or replace function public.require_cam_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is null or new.email !~* '@cam\.ac\.uk$' then
    raise exception 'Only University of Cambridge accounts (@cam.ac.uk) can sign in' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.require_cam_email from public, anon, authenticated;

drop trigger if exists require_cam_email on auth.users;
create trigger require_cam_email before insert on auth.users for each row execute function public.require_cam_email();

-- Who sent a submission: the account (cascades away with it) and its email at the time, for the review.
alter table submissions
  add column user_id uuid references auth.users(id) on delete set null,
  add column user_email text;
create index submissions_user_idx on submissions(user_id, created_at desc);
