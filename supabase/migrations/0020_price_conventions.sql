-- Each venue prices things its own way, and the app should say it the venue's way, not ours:
--   · who its one or two posted prices are for (Robinson: Members, Non-members; Clare Hall: Senior, Student;
--     St Catharine's: students and staff), the headings of its price columns, in the order it posts them;
--   · a rule for everyone else, in words (St Catharine's: VAT on top for others, a further 35% for external customers;
--     Wolfson: students 25% off with their card), shown under its menu and price list.
-- Edited in the dashboard like the rest of a venue's reference data.
alter table venues add column price_terms jsonb
  check (price_terms is null or jsonb_typeof(price_terms) = 'object');
comment on column venues.price_terms is
  '{"tiers": ["Members", "Non-members"], "note": "…", "source": "URL or where seen"}: who the posted prices (price_gbp, then non_member_gbp / price2_gbp) are for, and the rule for anyone else, in the venue''s own words.';

-- A dish's second posted price (non-members', others', …: whatever the venue's second tier is).
alter table menu_items add column price2_gbp numeric(6,2);
-- A price list line posted as a range ("Sandwiches £3.24–£3.96"): price_gbp is the low end.
alter table venue_prices add column price_max_gbp numeric(6,2);
comment on column venue_prices.non_member_gbp is 'The second posted price: the venue''s second tier (venues.price_terms.tiers[1]), non-members'' by default';

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
    insert into menu_items (menu_day_id, position, dish_id, name, tags, price_gbp, price2_gbp, price_text, course, sold_out)
    select day_id, (t.n - 1)::smallint, dish.id, t.i->>'name',
      array(select jsonb_array_elements_text(coalesce(t.i->'tags', '[]'))),
      (t.i->>'price_gbp')::numeric, (t.i->>'price2_gbp')::numeric, t.i->>'price_text', t.i->>'course', (t.i->>'sold_out')::boolean
    from jsonb_array_elements(d->'items') with ordinality t(i, n)
    join dishes dish on dish.site = v.site and dish.name_key = dish_key(t.i->>'name');
  end loop;
end $$;

create or replace function save_prices(p_venue_id text, p_observed_on date, p_source text, p_items jsonb)
returns void language plpgsql set search_path = public as $$
begin
  delete from venue_prices where venue_id = p_venue_id;
  insert into venue_prices (venue_id, position, section, name, price_gbp, price_max_gbp, non_member_gbp, services, course, tags, observed_on, source)
  select p_venue_id, (t.n - 1)::smallint, t.i->>'section', t.i->>'name', (t.i->>'price_gbp')::numeric, (t.i->>'price_max_gbp')::numeric,
    (t.i->>'non_member_gbp')::numeric,
    case when t.i ? 'services' then array(select jsonb_array_elements_text(t.i->'services')) end, t.i->>'course',
    array(select jsonb_array_elements_text(coalesce(t.i->'tags', '[]'))), p_observed_on, p_source
  from jsonb_array_elements(p_items) with ordinality t(i, n);
end $$;

-- What each venue says about its prices, where it says it (checked 9 October 2026).
update venues v set price_terms = t.terms::jsonb
from (values
  ('robinson/garden-restaurant', '{"tiers": ["Members", "Non-members"], "note": "Member prices are for Robinson members paying with their University Card; guests and other diners pay non-member prices.", "source": "https://www.robinson.cam.ac.uk/node/99"}'),
  ('wolfson/buttery-dining-hall', '{"tiers": ["Students", "Others"], "note": "Students get 25% off with their University Card.", "source": "https://www.wolfson.cam.ac.uk/catering"}'),
  ('st-catharines/hall-cafeteria', '{"tiers": ["Students and staff"], "note": "Prices are for students and staff. Everyone else pays VAT on top, and external customers a further 35%.", "source": "https://www.caths.cam.ac.uk/sites/default/files/cafeteria-new-prices-26-27.pdf"}'),
  ('clare-hall/dining-hall', '{"tiers": ["Senior", "Student"], "source": "https://www.clarehall.cam.ac.uk/wp-content/uploads/2026/10/Clare-Hall-Meal-Prices-Oct-26.pdf"}'),
  ('darwin/servery', '{"tiers": ["Members"], "source": "https://www.darwin.cam.ac.uk/dine/weekly-menu/"}'),
  ('homerton/dining-hall', '{"tiers": ["University card"], "note": "Prices are for paying with a University Card, the full student discount.", "source": "https://www.homerton.cam.ac.uk/sites/default/files/2026-01/Guide-to-average-meal-prices-2026.docx"}'),
  ('homerton/buttery', '{"tiers": ["University card"], "note": "A guide to typical prices, paying with a University Card (the full student discount).", "source": "https://www.homerton.cam.ac.uk/sites/default/files/2026-01/Guide-to-average-meal-prices-2026.docx"}'),
  ('queens/cripps-dining-hall-cafeteria', '{"tiers": ["Students"], "source": "https://qjcr.org.uk/content/QJCR_Summary_Sheet__Cost_of_Living-2.pdf"}'),
  ('downing/servery-great-hall', '{"note": "Each dish is priced on the list in the Servery. Paying by bank card without showing you''re a Downing student, you''re charged commercial prices.", "source": "https://www.dow.cam.ac.uk/current-students/catering"}'),
  ('christs/buttery', '{"note": "Students get 20% off Costa coffee.", "source": "https://www.christs.cam.ac.uk/student-life/meals"}'),
  ('pembroke/servery-trough', '{"note": "Students who pay the Student Facilities Charge get a discounted rate.", "source": "https://pem.cam.ac.uk/college/people/staff-directory/admissions-office/life-pembroke/food"}'),
  ('pembroke/cafe-84', '{"note": "Students who pay the Student Facilities Charge get a discounted rate.", "source": "https://pem.cam.ac.uk/college/people/staff-directory/admissions-office/life-pembroke/food"}'),
  ('pembroke/old-lodge-bar', '{"note": "Students who pay the Student Facilities Charge get a discounted rate.", "source": "https://pem.cam.ac.uk/college/people/staff-directory/admissions-office/life-pembroke/food"}'),
  ('churchill/dining-hall', '{"note": "A typical student dinner (a main, two sides and a dessert) costs about £7.29 (June 2026).", "source": "https://www.chu.cam.ac.uk/about/campus/dining-at-college/"}'),
  ('churchill/buttery', '{"note": "A 12-inch pizza costs about £8.90 (June 2026).", "source": "https://www.chu.cam.ac.uk/about/campus/dining-at-college/"}'),
  ('corpus-christi/cafeteria', '{"note": "A two-course meal costs about £5.25 on average.", "source": "https://www.corpus.cam.ac.uk/undergraduate-study/living-corpus/food-and-dining"}'),
  ('trinity-hall/cafeteria', '{"note": "A two-course cooked meal costs about £5 to £7 (2025-26).", "source": "https://www.trinhall.cam.ac.uk/study-with-us/undergraduates/fees-and-finance/living-costs"}')
) as t(id, terms)
where v.id = t.id;

-- Formal hall prices where the notes give them plainly (the rest of each note stays in `cost`).
update formals f set price_gbp = t.member, guest_gbp = t.guest, prices_seen = t.seen::date
from (values
  ('magdalene/hall', 12.00, 19.70, '2026-10-09'),
  ('peterhouse/hall-servery', 9.50, null, '2025-10-01'),
  ('lucy-cavendish/warburton-hall-servery', 18.07, 21.68, '2025-10-01'),
  ('queens/old-hall', 12.95, null, '2025-08-06')
) as t(venue_id, member, guest, seen)
where f.venue_id = t.venue_id and f.price_gbp is null;
