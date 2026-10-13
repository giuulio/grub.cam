-- Menus that come as documents (13 October 2026): Fitzwilliam's, Trinity's, St Edmund's, Pembroke's and St Catharine's
-- PDFs, Clare Hall's Sway, Lucy Cavendish's Canva, Churchill's and Newnham's pages, and the University cafés' price
-- lists. Each ingest run fetches each source's small listing page; a document is downloaded only when it may have
-- changed, and read (by a parser, or by the model when there's none or it can't) only when its content did. What it
-- was read as is kept here, so an unchanged document costs nothing and a cycle week's menu is copied to its later
-- weeks without reading it again (scripts/ingest/lib/docs.ts).

create table source_documents (
  venue_id text not null references venues(id) on delete cascade,
  -- stable across runs: the PDF's URL, or its filename where the link carries a token (Trinity)
  key text not null,
  url text not null,
  kind text not null check (kind in ('menu', 'prices')),
  -- a fingerprint from the listing page (Trinity's upload stamp): unchanged, the document isn't fetched
  version text,
  -- each file's ETag and Last-Modified, for asking the server whether it changed
  validators jsonb,
  hash text,
  -- ok: read (or, a price list first seen, taken as what the site already lists); failed: couldn't be read, not tried
  -- again until it changes
  status text not null check (status in ('ok', 'failed')),
  read_by text check (read_by in ('parser', 'model')),
  -- what it was read as: menu days (a cycle week's dated as `week`), or a price list
  result jsonb,
  week date,
  unsure text,
  error text,
  checked_at timestamptz not null,
  read_at timestamptz,
  -- when its content last changed; null when it hasn't since it was first seen
  changed_at timestamptz,
  primary key (venue_id, key)
);
alter table source_documents enable row level security; -- no policies: service role only
comment on table source_documents is 'Each menu or price-list document a source publishes: its fingerprints and what it was read as; written by npm run ingest, service role only.';

-- The model reading a source's document is logged with the venue and document, like a member's board
alter table model_calls drop constraint model_calls_purpose_check;
alter table model_calls add constraint model_calls_purpose_check check (purpose in ('transcribe', 'vet_photo', 'review', 'check_reading', 'read_source'));
alter table model_calls add column venue_id text references venues(id) on delete set null;
alter table model_calls add column source_url text;
