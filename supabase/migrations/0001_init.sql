-- Grub: Cambridge college menus. Initial schema.
-- Reference data (colleges, venues, service_slots, formals) is seeded from data/*.yaml.
-- menu_days is written by `npm run seed` after each ingest. All tables are world-readable
-- (anon SELECT only); writes go through the service role. User-generated tables come later.

create extension if not exists pgcrypto;

create table colleges (
  slug text primary key,
  name text not null,
  short_name text,
  official_dining_url text,
  reviewed date not null,
  notice text,
  links jsonb not null default '[]',
  notes jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

create table venues (
  id text primary key,                       -- "<college>/<venue-slug>"
  college text not null references colleges(slug) on delete cascade,
  slug text not null,
  name text not null,
  type text not null check (type in ('hall','cafe','bar','other')),
  where_text text,
  hours_text text,
  access jsonb not null,                     -- {level, text, prov}
  payment jsonb not null,                    -- {university_card, bank_card, cash, text, prov}
  prices jsonb,                              -- {text, prov}
  serves text,
  dietary jsonb not null,                    -- {tags[], text, prov}
  menu_source jsonb,                         -- {kind, url, data_url, cadence, coverage, includes[], status, checked, notes}
  sort_order int not null default 0,
  updated_at timestamptz not null default now(),
  unique (college, slug)
);
create index venues_college_idx on venues(college);

create table service_slots (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null references venues(id) on delete cascade,
  college text not null,
  venue text not null,
  meal text not null check (meal in ('breakfast','brunch','lunch','dinner','snacks','bar')),
  days text[] not null,
  start_time time not null,
  end_time time not null,
  period text not null default 'all' check (period in ('term','vacation','all')),
  note text,
  prov jsonb not null default '{}'
);
create index service_slots_venue_idx on service_slots(venue_id);

create table formals (
  college text primary key references colleges(slug) on delete cascade,
  where_text text,
  days_text text,
  days text[],
  time text,
  dress text,
  format text,
  booking text,
  guests text,
  cost text,
  prov jsonb not null default '{}'
);

create table menu_days (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null references venues(id) on delete cascade,
  college text not null,
  venue text not null,
  week text not null,                        -- ISO week, e.g. 2026-W41
  date date not null,
  service text not null check (service in ('breakfast','brunch','lunch','dinner','snacks','bar')),
  items jsonb not null,                      -- Dish[]
  note text,
  source_url text not null,
  fetched_at timestamptz not null,
  method text not null check (method in ('script','llm','manual','user')),
  file_note text,
  unique (venue_id, date, service)
);
create index menu_days_venue_date_idx on menu_days(venue_id, date);
create index menu_days_date_idx on menu_days(date);

-- Row-level security: public read, no anonymous writes.
alter table colleges enable row level security;
alter table venues enable row level security;
alter table service_slots enable row level security;
alter table formals enable row level security;
alter table menu_days enable row level security;

create policy "public read colleges" on colleges for select to anon, authenticated using (true);
create policy "public read venues" on venues for select to anon, authenticated using (true);
create policy "public read service_slots" on service_slots for select to anon, authenticated using (true);
create policy "public read formals" on formals for select to anon, authenticated using (true);
create policy "public read menu_days" on menu_days for select to anon, authenticated using (true);
