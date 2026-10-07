-- Grub: Cambridge college menus. Initial schema.
-- Reference data (colleges, venues, service_slots, formals) is seeded from data/*.yaml.
-- Menus accumulate over time: menu_days (one per venue/date/service) -> menu_items (each dish as
-- printed that day) -> dishes (one per college per normalised name, so a dish can be followed
-- across weeks). Public tables are anon SELECT only; writes go through the service role.

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
  note text,
  source_url text not null,
  fetched_at timestamptz not null,
  method text not null check (method in ('script','llm','manual','user')),
  file_note text,
  unique (venue_id, date, service)
);
create index menu_days_venue_date_idx on menu_days(venue_id, date);
create index menu_days_date_idx on menu_days(date);

create table dishes (
  id bigint generated always as identity primary key,
  college text not null references colleges(slug) on delete cascade,
  name text not null,                        -- display name, as first seen
  name_key text not null,                    -- normalised name; computed by dishKey() in scripts/lib/dishKey.ts
  created_at timestamptz not null default now(),
  unique (college, name_key)
);

create table menu_items (
  menu_day_id uuid not null references menu_days(id) on delete cascade,
  position smallint not null,
  dish_id bigint not null references dishes(id),
  name text not null,                        -- as printed that day
  tags text[] not null default '{}',
  price_gbp numeric(6,2),
  price_text text,
  course text check (course in ('soup','main','side','dessert','other')),
  sold_out boolean,
  primary key (menu_day_id, position)
);
create index menu_items_dish_idx on menu_items(dish_id);

create view dish_stats with (security_invoker = true) as
  select d.id, d.college, d.name, count(*) as times_served, min(md.date) as first_served, max(md.date) as last_served
  from dishes d
  join menu_items mi on mi.dish_id = d.id
  join menu_days md on md.id = mi.menu_day_id
  group by d.id;

-- One row per source fetch, for spotting broken scrapers and stale menus. Service role only.
create table ingest_runs (
  id bigint generated always as identity primary key,
  college text not null references colleges(slug) on delete cascade,
  week text not null,
  method text not null check (method in ('script','llm','manual')),
  started_at timestamptz not null,
  finished_at timestamptz not null default now(),
  status text not null check (status in ('ok','empty','error')),
  services int,
  dishes int,
  error text
);
create index ingest_runs_college_idx on ingest_runs(college, started_at desc);

-- Row-level security: public read, no anonymous writes.
alter table colleges enable row level security;
alter table venues enable row level security;
alter table service_slots enable row level security;
alter table formals enable row level security;
alter table menu_days enable row level security;
alter table dishes enable row level security;
alter table menu_items enable row level security;
alter table ingest_runs enable row level security;  -- no policies: service role only

create policy "public read colleges" on colleges for select to anon, authenticated using (true);
create policy "public read venues" on venues for select to anon, authenticated using (true);
create policy "public read service_slots" on service_slots for select to anon, authenticated using (true);
create policy "public read formals" on formals for select to anon, authenticated using (true);
create policy "public read menu_days" on menu_days for select to anon, authenticated using (true);
create policy "public read dishes" on dishes for select to anon, authenticated using (true);
create policy "public read menu_items" on menu_items for select to anon, authenticated using (true);
