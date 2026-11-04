-- A price posted as where it starts ("From £2.00": pastries, focaccia by filling), for both columns, rather than a
-- list that can't be read.
alter table venue_prices add column price_from boolean not null default false;
comment on column venue_prices.price_from is 'The prices are where they start, as posted ("From £2.00"), in both columns.';

create or replace function save_prices(p_venue_id text, p_observed_on date, p_source text, p_items jsonb)
returns void language plpgsql set search_path = public as $$
begin
  delete from venue_prices where venue_id = p_venue_id;
  insert into venue_prices (venue_id, position, section, name, description, price_gbp, price_max_gbp, price_from, non_member_gbp, non_member_text, services, course, tags, observed_on, source)
  select p_venue_id, (t.n - 1)::smallint, t.i->>'section', t.i->>'name', nullif(t.i->>'description', ''), (t.i->>'price_gbp')::numeric, (t.i->>'price_max_gbp')::numeric,
    coalesce((t.i->>'price_from')::boolean, false),
    (t.i->>'non_member_gbp')::numeric, nullif(t.i->>'non_member_text', ''),
    case when t.i ? 'services' then array(select jsonb_array_elements_text(t.i->'services')) end, t.i->>'course',
    array(select jsonb_array_elements_text(coalesce(t.i->'tags', '[]'))),
    coalesce((t.i->>'observed_on')::date, p_observed_on), coalesce(t.i->>'source', p_source)
  from jsonb_array_elements(p_items) with ordinality t(i, n);
end $$;
revoke execute on function save_prices from public, anon, authenticated;
