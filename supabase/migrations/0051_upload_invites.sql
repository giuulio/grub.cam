-- Invited groups can send menu evidence without a Google account. These are never trusted contributor posts.
create table upload_invites (
  id uuid primary key default gen_random_uuid(),
  label text not null check (length(label) between 1 and 100),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  active boolean not null default true,
  sites text[],
  expires_at timestamptz not null,
  daily_limit integer not null default 50 check (daily_limit between 1 and 200),
  used_on date,
  used_today integer not null default 0,
  created_at timestamptz not null default now()
);
alter table upload_invites enable row level security;
alter table submissions add column upload_invite_id uuid references upload_invites(id) on delete set null;
create index submissions_upload_invite_idx on submissions(upload_invite_id);
comment on table upload_invites is 'Private revocable invitations for menu-board uploads; hashed bearer token only, scoped sites, expiry and atomic daily quota.';

create function claim_upload_invite(p_token_hash text, p_site text)
returns table (id uuid, label text) language plpgsql security definer set search_path = public as $$
declare
  invite upload_invites%rowtype;
  today date := (now() at time zone 'Europe/London')::date;
begin
  select * into invite from upload_invites i where i.token_hash = p_token_hash for update;
  if not found or not invite.active or invite.expires_at <= now() then return; end if;
  if invite.sites is not null and not (p_site = any(invite.sites)) then return; end if;
  if invite.used_on = today and invite.used_today >= invite.daily_limit then return; end if;
  update upload_invites i set used_on = today, used_today = case when invite.used_on = today then invite.used_today + 1 else 1 end where i.id = invite.id;
  return query select invite.id, invite.label;
end $$;
revoke execute on function claim_upload_invite from public, anon, authenticated;
grant execute on function claim_upload_invite to service_role;
