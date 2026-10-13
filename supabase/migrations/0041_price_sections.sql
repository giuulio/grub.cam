-- A member's price list adds to a venue's instead of replacing it, 13 October 2026: Café Lucy's specials board, sent a
-- minute after its drinks menu, took the drinks down. The submissions queue now merges a member's list by section (its
-- sections replace the ones under the same headings, the others stay; scripts/ingest/prices.ts mergeList()) and saves
-- the whole list, so a venue's list can hold lines seen on different days from different sources: a line's own
-- `observed_on` and `source` win over the call's. Called without them, it saves as before.

create or replace function save_prices(p_venue_id text, p_observed_on date, p_source text, p_items jsonb)
returns void language plpgsql set search_path = public as $$
begin
  delete from venue_prices where venue_id = p_venue_id;
  insert into venue_prices (venue_id, position, section, name, description, price_gbp, price_max_gbp, non_member_gbp, services, course, tags, observed_on, source)
  select p_venue_id, (t.n - 1)::smallint, t.i->>'section', t.i->>'name', nullif(t.i->>'description', ''), (t.i->>'price_gbp')::numeric, (t.i->>'price_max_gbp')::numeric,
    (t.i->>'non_member_gbp')::numeric,
    case when t.i ? 'services' then array(select jsonb_array_elements_text(t.i->'services')) end, t.i->>'course',
    array(select jsonb_array_elements_text(coalesce(t.i->'tags', '[]'))),
    coalesce((t.i->>'observed_on')::date, p_observed_on), coalesce(t.i->>'source', p_source)
  from jsonb_array_elements(p_items) with ordinality t(i, n);
end $$;
revoke execute on function save_prices from public, anon, authenticated;
