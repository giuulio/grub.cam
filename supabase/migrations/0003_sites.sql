-- Venues belong to a site: a college, or a University site (West Cambridge, Sidgwick, a museum, ...).
-- colleges -> sites with a kind; the denormalised `college` columns follow. Venue ids stay "<site>/<venue>".

alter table colleges rename to sites;
alter table sites rename constraint colleges_pkey to sites_pkey;
alter table sites add column kind text not null default 'college' check (kind in ('college', 'university'));
alter table sites alter column kind drop default;
alter policy "public read colleges" on sites rename to "public read sites";

alter table venues rename column college to site;
alter table venues rename constraint venues_college_fkey to venues_site_fkey;
alter table venues rename constraint venues_college_slug_key to venues_site_slug_key;
alter index venues_college_idx rename to venues_site_idx;
alter table venues add column url text; -- the venue's own page (fixed menus, PDFs), when it has one

alter table service_slots rename column college to site;
alter table menu_days rename column college to site;
alter table dishes rename column college to site;
alter table dishes rename constraint dishes_college_fkey to dishes_site_fkey;
alter table dishes rename constraint dishes_college_name_key_key to dishes_site_name_key_key;
alter table formals rename column college to site; -- colleges only
alter table formals rename constraint formals_college_fkey to formals_site_fkey;

drop view dish_stats;
create view dish_stats with (security_invoker = true) as
  select d.id, d.site, d.name, count(*) as times_served, min(md.date) as first_served, max(md.date) as last_served
  from dishes d
  join menu_items mi on mi.dish_id = d.id
  join menu_days md on md.id = mi.menu_day_id
  group by d.id;

-- Same as 0002, reading the venue's site. Signature unchanged, so ingest keeps working.
create or replace function save_menu(p_venue_id text, p_source_url text, p_fetched_at timestamptz, p_method text, p_days jsonb)
returns void language plpgsql set search_path = public as $$
declare
  v venues%rowtype;
  d jsonb;
  day_id uuid;
begin
  select * into strict v from venues where id = p_venue_id;
  for d in select * from jsonb_array_elements(p_days) loop
    insert into menu_days (venue_id, site, venue, date, service, note, source_url, fetched_at, method)
    values (v.id, v.site, v.slug, (d->>'date')::date, d->>'service', d->>'note', p_source_url, p_fetched_at, p_method)
    on conflict (venue_id, date, service) do update
      set note = excluded.note, source_url = excluded.source_url, fetched_at = excluded.fetched_at, method = excluded.method
    returning id into day_id;

    insert into dishes (site, name, name_key)
    select distinct on (dish_key(i->>'name')) v.site, i->>'name', dish_key(i->>'name')
    from jsonb_array_elements(d->'items') i
    order by dish_key(i->>'name')
    on conflict (site, name_key) do nothing;

    delete from menu_items where menu_day_id = day_id;
    insert into menu_items (menu_day_id, position, dish_id, name, tags, price_gbp, price_text, course, sold_out)
    select day_id, (t.n - 1)::smallint, dish.id, t.i->>'name',
      array(select jsonb_array_elements_text(coalesce(t.i->'tags', '[]'))),
      (t.i->>'price_gbp')::numeric, t.i->>'price_text', t.i->>'course', (t.i->>'sold_out')::boolean
    from jsonb_array_elements(d->'items') with ordinality t(i, n)
    join dishes dish on dish.site = v.site and dish.name_key = dish_key(t.i->>'name');
  end loop;
end $$;
revoke execute on function save_menu from public, anon, authenticated;
