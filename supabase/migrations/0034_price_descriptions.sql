-- Fixed café/bar menus can print ingredients or choices beneath the item name.
alter table venue_prices add column description text;
comment on column venue_prices.description is 'Ingredients or choices as posted, separate from the item name.';

create or replace function save_prices(p_venue_id text, p_observed_on date, p_source text, p_items jsonb)
returns void language plpgsql set search_path = public as $$
begin
  delete from venue_prices where venue_id = p_venue_id;
  insert into venue_prices (venue_id, position, section, name, description, price_gbp, price_max_gbp, non_member_gbp, services, course, tags, observed_on, source)
  select p_venue_id, (t.n - 1)::smallint, t.i->>'section', t.i->>'name', nullif(t.i->>'description', ''), (t.i->>'price_gbp')::numeric, (t.i->>'price_max_gbp')::numeric,
    (t.i->>'non_member_gbp')::numeric,
    case when t.i ? 'services' then array(select jsonb_array_elements_text(t.i->'services')) end, t.i->>'course',
    array(select jsonb_array_elements_text(coalesce(t.i->'tags', '[]'))), p_observed_on, p_source
  from jsonb_array_elements(p_items) with ordinality t(i, n);
end $$;
