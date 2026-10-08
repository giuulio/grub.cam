-- Price lists as posted at a venue (noticeboard, till, menu card): what an item or deal costs, not tied to a day's dishes.
-- A venue's list is replaced whole on each save (save_prices), so it is always one observation.

create table venue_prices (
  venue_id text not null references venues(id) on delete cascade,
  position smallint not null,
  section text,                       -- heading as posted: "Brunch", "Meal deals"
  name text not null,
  price_gbp numeric(6,2) not null,    -- members' price, or the only price
  non_member_gbp numeric(6,2),        -- when non-members pay more
  observed_on date not null,
  source text not null,               -- a URL, or where it was seen
  primary key (venue_id, position)
);

alter table venue_prices enable row level security;
create policy "public read venue_prices" on venue_prices for select to anon, authenticated using (true);

create function save_prices(p_venue_id text, p_observed_on date, p_source text, p_items jsonb)
returns void language plpgsql set search_path = public as $$
begin
  delete from venue_prices where venue_id = p_venue_id;
  insert into venue_prices (venue_id, position, section, name, price_gbp, non_member_gbp, observed_on, source)
  select p_venue_id, (t.n - 1)::smallint, t.i->>'section', t.i->>'name', (t.i->>'price_gbp')::numeric, (t.i->>'non_member_gbp')::numeric, p_observed_on, p_source
  from jsonb_array_elements(p_items) with ordinality t(i, n);
end $$;
revoke execute on function save_prices from public, anon, authenticated;
