-- A dish's allergens as its source lists them: the common name ("milk", "sulphites" for "Sulphur dioxide"), with the
-- source's detail in brackets ("gluten (wheat)", "nuts (walnuts)"), and "may contain …" for what it may contain. A
-- label we don't know is kept as printed. Empty means none listed, never none present.
alter table menu_items add column allergens text[] not null default '{}';

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
    insert into menu_items (menu_day_id, position, dish_id, name, tags, price_gbp, price2_gbp, price_text, course, sold_out, allergens)
    select day_id, (t.n - 1)::smallint, dish.id, t.i->>'name',
      array(select jsonb_array_elements_text(coalesce(t.i->'tags', '[]'))),
      (t.i->>'price_gbp')::numeric, (t.i->>'price2_gbp')::numeric, t.i->>'price_text', t.i->>'course', (t.i->>'sold_out')::boolean,
      array(select jsonb_array_elements_text(coalesce(t.i->'allergens', '[]')))
    from jsonb_array_elements(d->'items') with ordinality t(i, n)
    join dishes dish on dish.site = v.site and dish.name_key = dish_key(t.i->>'name');
  end loop;
end $$;
