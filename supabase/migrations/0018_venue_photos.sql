-- Photos of venues (and of their menu boards, as the source for a price list). The files live in the photo bucket
-- (Cloudflare R2, public at VITE_PHOTOS_URL) as <path>-<width>.webp, one per width; this table says what they are.
-- `npm run ingest:photo` makes the sizes, uploads them and adds the row. Only approved photos are public.
-- Our own photos, or a contributor's with a licence; no copies from Google Maps or social media; no recognisable people.

create table venue_photos (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null references venues(id) on delete cascade,
  kind text not null default 'venue' check (kind in ('venue', 'menu')),
  position smallint not null default 0,      -- order within the venue's photos of that kind
  path text not null unique,                 -- "<site>/<venue>/<id>"
  widths smallint[] not null,                -- the widths made, ascending
  width int not null,                        -- the largest's size, for the aspect ratio
  height int not null,
  color text check (color ~ '^#[0-9a-f]{6}$'), -- dominant colour, shown while it loads
  alt text not null,
  credit text,
  licence text,
  taken_on date,
  source text,                               -- where it came from: "own photo", a contributor
  approved boolean not null default false,
  created_at timestamptz not null default now()
);
create index venue_photos_venue_idx on venue_photos(venue_id, kind, position);

alter table venue_photos enable row level security;
create policy "public read approved venue_photos" on venue_photos for select to anon, authenticated using (approved);
