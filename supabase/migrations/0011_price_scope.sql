-- What a price list line prices, so prices show on the menu: dishes of one course (or the whole meal) at some meals,
-- shown next to each dish. A line without a course is something sold at those meals: a fixed brunch menu, a sandwich, a deal.

alter table venue_prices
  add column services text[] check (services <@ array['breakfast', 'brunch', 'lunch', 'dinner', 'formal', 'snacks', 'bar']), -- null: every meal
  add column course text check (course in ('soup', 'main', 'side', 'dessert', 'other', 'meal')); -- 'meal': one price for the whole meal

create or replace function save_prices(p_venue_id text, p_observed_on date, p_source text, p_items jsonb)
returns void language plpgsql set search_path = public as $$
begin
  delete from venue_prices where venue_id = p_venue_id;
  insert into venue_prices (venue_id, position, section, name, price_gbp, non_member_gbp, services, course, observed_on, source)
  select p_venue_id, (t.n - 1)::smallint, t.i->>'section', t.i->>'name', (t.i->>'price_gbp')::numeric, (t.i->>'non_member_gbp')::numeric,
    case when t.i ? 'services' then array(select jsonb_array_elements_text(t.i->'services')) end, t.i->>'course', p_observed_on, p_source
  from jsonb_array_elements(p_items) with ordinality t(i, n);
end $$;
revoke execute on function save_prices from public, anon, authenticated;
