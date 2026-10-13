-- Ingest checks the scripted sources every half hour through the day (13 October 2026), so a meal cancelled or a dish
-- swapped that morning shows up before the meal, without fetching eight weeks of Jesus every time or rewriting what
-- hasn't changed. Each source's first run of the day fetches every published week; one every four hours fetches the
-- next two weeks; the rest fetch only today and tomorrow (scripts/ingest/lib/checks.ts). A day is saved again only
-- when its hash differs from the one saved, and the site is rebuilt only when something was.

-- The day as a script last saved it (note, alert, dishes in order); null for days saved by hand or by members
alter table menu_days add column content_hash text;

-- One row per scripted source: when it was last fetched, what each kind of check last did, and whether it's failing.
-- A failing source waits longer between tries (half an hour, doubling to six hours); after two failures in a row the
-- ingest Action lists it in the "Source health" issue and comments there.
create table source_checks (
  venue_id text primary key references venues(id) on delete cascade,
  checked_at timestamptz not null,
  ok_at timestamptz,
  changed_at timestamptz,
  -- London date of the last fetch of every published week, and the time of the last fetch of the next two weeks
  swept_on date,
  fortnight_at timestamptz,
  failures integer not null default 0,
  failing_since timestamptz,
  retry_at timestamptz,
  error text
);
alter table source_checks enable row level security; -- no policies: service role only
comment on table source_checks is 'Each scripted menu source''s last check, its sweeps and failures; written by npm run ingest, service role only.';

-- As in 0035, plus each day's hash (d->>'hash', set by ingest; absent from hand and member saves)
create or replace function save_menu(p_venue_id text, p_source_url text, p_fetched_at timestamptz, p_method text, p_days jsonb)
returns void language plpgsql set search_path = public as $$
declare
  v venues%rowtype;
  d jsonb;
  day_id uuid;
begin
  select * into strict v from venues where id = p_venue_id;
  for d in select * from jsonb_array_elements(p_days) loop
    insert into menu_days (venue_id, site, venue, date, service, note, alert, source_url, fetched_at, method, content_hash)
    values (v.id, v.site, v.slug, (d->>'date')::date, d->>'service', d->>'note', coalesce((d->>'alert')::boolean, false), p_source_url, p_fetched_at, p_method, d->>'hash')
    on conflict (venue_id, date, service) do update
      set note = excluded.note, alert = excluded.alert, source_url = excluded.source_url, fetched_at = excluded.fetched_at, method = excluded.method,
        content_hash = excluded.content_hash
    returning id into day_id;

    insert into dishes (site, name, name_key)
    select distinct on (dish_key(i->>'name')) v.site, i->>'name', dish_key(i->>'name')
    from jsonb_array_elements(d->'items') i
    order by dish_key(i->>'name')
    on conflict (site, name_key) do nothing;

    delete from menu_items where menu_day_id = day_id;
    insert into menu_items (menu_day_id, position, dish_id, name, tags, price_gbp, price2_gbp, price_text, course, sold_out)
    select day_id, (t.n - 1)::smallint, dish.id, t.i->>'name',
      array(select jsonb_array_elements_text(coalesce(t.i->'tags', '[]'))),
      (t.i->>'price_gbp')::numeric, (t.i->>'price2_gbp')::numeric, t.i->>'price_text', t.i->>'course', (t.i->>'sold_out')::boolean
    from jsonb_array_elements(d->'items') with ordinality t(i, n)
    join dishes dish on dish.site = v.site and dish.name_key = dish_key(t.i->>'name');
  end loop;
end $$;

-- Every half hour from 06:07 to 19:37 UTC, which covers 07:00 to 19:30 in London either side of the clock change
select cron.schedule('ingest', '7,37 6-19 * * *', $$select public.dispatch_workflow('ingest.yml')$$);
