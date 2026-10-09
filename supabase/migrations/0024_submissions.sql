-- Submissions, 9 October 2026: what people in a venue send in from its page on grub.cam (a photo of the menu board, the
-- price list or the hours, or typed text), and what contributors post from their own scripts for sources only members
-- can reach. One queue for both. The Edge Function `submit` stores the photo in the private bucket, inserts the row and,
-- within a daily budget, has a model transcribe it into the text formats the ingest scripts already read
-- (ingest:manual, ingest:prices, ingest:hours); the sender checks that text before it's queued. Nothing is published
-- from here directly: `npm run submissions -- approve` (by hand, or `--trusted` for contributors' rows in the ingest
-- Action) parses the text with those same parsers and writes through save_menu()/save_prices()/service_slots.

create table contributors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  token_hash text not null unique,              -- sha256 (hex) of the token they hold; the token itself is never stored
  sites text[],                                 -- the sites they may submit for; null for any
  active boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table contributors is 'People who post menus, prices or hours from their own scripts; trusted rows are approved by the ingest Action.';

create table submissions (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null references venues(id) on delete cascade,
  kind text not null check (kind in ('menu', 'prices', 'hours', 'photo', 'other')),
  date date,                                    -- menu: the day the board is for
  service text check (service in ('breakfast', 'brunch', 'lunch', 'dinner', 'formal', 'snacks', 'bar')),
  note text,                                    -- what the sender typed: the text itself, or a message
  photo_path text,                              -- in the `submissions` bucket
  contact text,                                 -- an email the sender chose to leave; not verified
  contributor_id uuid references contributors(id) on delete set null,
  ip_hash text,                                 -- salted, for rate limiting only
  transcription text,                           -- the ingest-format text (header included), ready to parse
  transcribed_by text check (transcribed_by in ('openai', 'gemini', 'sender', 'operator', 'contributor')),
  model text,
  status text not null default 'received' check (status in ('received', 'transcribed', 'needs_review', 'approved', 'rejected')),
  review_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index submissions_status_idx on submissions(status, created_at);
create index submissions_venue_idx on submissions(venue_id, created_at desc);
create index submissions_ip_idx on submissions(ip_hash, created_at desc);
comment on column submissions.transcription is 'ingest:manual (menu), ingest:prices (prices) or ingest:hours (hours) text, header included; what approve parses.';

-- Service role only: the Edge Function and the CLI. Nothing here is public.
alter table contributors enable row level security;
alter table submissions enable row level security;

-- Photos sent in, private; the Edge Function writes them, the CLI reads them. Not the served photos (those are in the repo).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('submissions', 'submissions', false, 5242880, '{image/jpeg,image/png,image/webp,image/heic,image/heif}')
on conflict (id) do nothing;

-- Menus can now come from a sender ('user') or a contributor's script ('contributor'), through the same save_menu().
alter table menu_days drop constraint menu_days_method_check;
alter table menu_days add constraint menu_days_method_check check (method in ('script', 'manual', 'user', 'contributor'));
alter table ingest_runs drop constraint ingest_runs_method_check;
alter table ingest_runs add constraint ingest_runs_method_check check (method in ('script', 'manual', 'user', 'contributor'));
