-- The database is now the system of record. Menus are rows by date (no weekly files), how each
-- college publishes its menu lives in scripts/ingest/sources.ts, and ingest writes through save_menu().

alter table venues drop column menu_source;

alter table menu_days drop column week, drop column file_note;
update menu_days set method = 'manual' where method <> 'script';
alter table menu_days drop constraint menu_days_method_check;
alter table menu_days add constraint menu_days_method_check check (method in ('script', 'manual'));

-- One row per source per ingest run.
drop table ingest_runs;
create table ingest_runs (
  id bigint generated always as identity primary key,
  venue_id text not null references venues(id) on delete cascade,
  method text not null check (method in ('script', 'manual')),
  started_at timestamptz not null,
  finished_at timestamptz not null default now(),
  status text not null check (status in ('ok', 'empty', 'error')),
  days int,
  dishes int,
  error text
);
create index ingest_runs_venue_idx on ingest_runs(venue_id, started_at desc);
alter table ingest_runs enable row level security; -- no policies: service role only

-- "Roast  Potatoes " and "roast potatoes" are the same dish.
create function dish_key(name text) returns text language sql immutable as $$
  select trim(regexp_replace(lower(normalize(name, nfkc)), '\s+', ' ', 'g'))
$$;

-- Save one source's menu days in a transaction: upsert each (venue, date, service), add dishes not
-- seen before at this college, and replace that day's items. p_days is [{date, service, note?, items: Dish[]}].
create function save_menu(p_venue_id text, p_source_url text, p_fetched_at timestamptz, p_method text, p_days jsonb)
returns void language plpgsql set search_path = public as $$
declare
  v venues%rowtype;
  d jsonb;
  day_id uuid;
begin
  select * into strict v from venues where id = p_venue_id;
  for d in select * from jsonb_array_elements(p_days) loop
    insert into menu_days (venue_id, college, venue, date, service, note, source_url, fetched_at, method)
    values (v.id, v.college, v.slug, (d->>'date')::date, d->>'service', d->>'note', p_source_url, p_fetched_at, p_method)
    on conflict (venue_id, date, service) do update
      set note = excluded.note, source_url = excluded.source_url, fetched_at = excluded.fetched_at, method = excluded.method
    returning id into day_id;

    insert into dishes (college, name, name_key)
    select distinct on (dish_key(i->>'name')) v.college, i->>'name', dish_key(i->>'name')
    from jsonb_array_elements(d->'items') i
    order by dish_key(i->>'name')
    on conflict (college, name_key) do nothing;

    delete from menu_items where menu_day_id = day_id;
    insert into menu_items (menu_day_id, position, dish_id, name, tags, price_gbp, price_text, course, sold_out)
    select day_id, (t.n - 1)::smallint, dish.id, t.i->>'name',
      array(select jsonb_array_elements_text(coalesce(t.i->'tags', '[]'))),
      (t.i->>'price_gbp')::numeric, t.i->>'price_text', t.i->>'course', (t.i->>'sold_out')::boolean
    from jsonb_array_elements(d->'items') with ordinality t(i, n)
    join dishes dish on dish.college = v.college and dish.name_key = dish_key(t.i->>'name');
  end loop;
end $$;
revoke execute on function save_menu from public, anon, authenticated;
