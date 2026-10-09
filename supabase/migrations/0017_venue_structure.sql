-- One structure per kind of venue, 9 Oct 2026. A venue's type is what people come to it for:
--   * Dining (`hall`): meals from a menu that changes daily or weekly; its page leads with the menu for a date;
--   * Café: what it sells and what it costs, a menu that rarely changes; its page leads with the price list;
--   * Bar: like a café, for drinks.
-- Formal hall is a section on the Dining venue that holds it, with what members need to book: when, price, guests,
-- dress, how to book. Here: the University cafés that serve a hot menu that changes become Dining, `other` goes,
-- price list lines get diet tags, and formals get the fields the page shows (the *_text columns stay editors' notes).

-- No venue is `other`.
alter table venues drop constraint venues_type_check;
alter table venues add constraint venues_type_check check (type in ('hall', 'cafe', 'bar'));

-- University venues whose main offer is a hot menu that changes (catering.admin.cam.ac.uk pages, read 8 Oct 2026):
-- weekly hot mains (Scholars Brew, Greenwich House, from the West Hub kitchen), two hot mains daily (Ground Café),
-- a hot meal of the day (Pathology, JCBC, Zest), hot food daily (The Servery), daily printed menus (CRUK), and the
-- Cavendish Café's daily hot lunch (reported; its website has only the seasonal café menu). They keep their café
-- hours, so they're listed under Cafés too.
update venues set type = 'hall'
where id in ('west-cambridge/scholars-brew', 'west-cambridge/greenwich-house-cafe', 'west-cambridge/the-servery', 'west-cambridge/cavendish-cafe',
  'biomedical-campus/ground-cafe', 'biomedical-campus/jcbc-cafe', 'biomedical-campus/cruk-cafe', 'downing-site/pathology-cafe', 'old-addenbrookes/zest-cafe');

-- Meal times their pages publish (0004 kept them in `serves`).
insert into service_slots (venue_id, site, venue, meal, days, start_time, end_time, period, note, prov)
select s.venue_id, split_part(s.venue_id, '/', 1), split_part(s.venue_id, '/', 2), s.meal, '{mon,tue,wed,thu,fri}', s.start_time::time, s.end_time::time, 'all', null,
  '{"confidence": "medium", "source_kind": "official", "observed_at": "2026-10-08"}'::jsonb
from (values
  ('biomedical-campus/ground-cafe', 'breakfast', '08:30', '11:30'),
  ('biomedical-campus/ground-cafe', 'lunch', '12:00', '14:00'),
  ('downing-site/pathology-cafe', 'lunch', '12:00', '14:00'),
  ('old-addenbrookes/zest-cafe', 'lunch', '12:00', '14:00')
) as s(venue_id, meal, start_time, end_time);

-- The Cavendish Café's daily lunch isn't published online; its seasonal PDF is the café's price list (sources.ts).
update venues set menu_channel = 'none', menu_url = null, menu_scripted = false where id = 'west-cambridge/cavendish-cafe';

-- Diet tags on price list lines, as on dishes: the codes printed after a name become tags, the name keeps the rest.
alter table venue_prices
  add column tags text[] not null default '{}' check (tags <@ array['vegetarian', 'vegan', 'plant_based', 'halal', 'gluten_free', 'kosher', 'pescatarian', 'dairy_free']);

create or replace function save_prices(p_venue_id text, p_observed_on date, p_source text, p_items jsonb)
returns void language plpgsql set search_path = public as $$
begin
  delete from venue_prices where venue_id = p_venue_id;
  insert into venue_prices (venue_id, position, section, name, price_gbp, non_member_gbp, services, course, tags, observed_on, source)
  select p_venue_id, (t.n - 1)::smallint, t.i->>'section', t.i->>'name', (t.i->>'price_gbp')::numeric, (t.i->>'non_member_gbp')::numeric,
    case when t.i ? 'services' then array(select jsonb_array_elements_text(t.i->'services')) end, t.i->>'course',
    array(select jsonb_array_elements_text(coalesce(t.i->'tags', '[]'))), p_observed_on, p_source
  from jsonb_array_elements(p_items) with ordinality t(i, n);
end $$;
revoke execute on function save_prices from public, anon, authenticated;

-- Codes as printed: Madingley V, VE; Cavendish DF, VE, GF; Occidente GF, DF, VE, and GFA (gluten-free available).
update venue_prices p set name = v.name, tags = v.tags::text[]
from (values
  ('madingley-hall/cafe', 1, 'Cheese & pickle', '{vegetarian}'),
  ('madingley-hall/cafe', 2, 'Egg & mayonnaise', '{vegetarian}'),
  ('madingley-hall/cafe', 4, 'Roasted pepper & hummus', '{vegan,vegetarian}'),
  ('madingley-hall/cafe', 5, 'Three cheese pizza', '{vegetarian}'),
  ('madingley-hall/cafe', 9, 'Soup of the day, bread roll', '{vegetarian}'),
  ('west-cambridge/cavendish-cafe', 2, 'Sweet potato falafel, pickled red onion & baba ganoush', '{dairy_free,vegan,vegetarian}'),
  ('west-cambridge/cavendish-cafe', 4, 'Honey, peach & brie', '{dairy_free}'),
  ('west-cambridge/cavendish-cafe', 7, 'Sausage roll & onion ketchup', '{dairy_free}'),
  ('west-cambridge/cavendish-cafe', 16, 'Chocolate raspberry rocky road', '{gluten_free,dairy_free,vegan,vegetarian}'),
  ('west-cambridge/cavendish-cafe', 17, 'Chocolate orange rocky road', '{dairy_free,vegan,vegetarian}'),
  ('west-cambridge/cavendish-cafe', 18, 'Granola', '{gluten_free,dairy_free,vegan,vegetarian}'),
  ('west-cambridge/occidente', 0, 'Marinara (gluten-free available)', '{dairy_free}'),
  ('west-cambridge/occidente', 1, 'Margherita (gluten-free available)', '{}'),
  ('west-cambridge/occidente', 2, 'Prosciutto e fungi (gluten-free available)', '{}'),
  ('west-cambridge/occidente', 3, 'Burmese coconut noodles with chicken', '{dairy_free}'),
  ('west-cambridge/occidente', 4, 'Katsu tofu rice bowl', '{vegan,vegetarian,gluten_free,dairy_free}'),
  ('west-cambridge/occidente', 6, 'Chargrilled monkfish & king prawn spiedini', '{gluten_free,dairy_free}'),
  ('west-cambridge/occidente', 7, 'Greek chicken souvlaki (gluten-free available)', '{}')
) as v(venue_id, position, name, tags)
where p.venue_id = v.venue_id and p.position = v.position;

-- Formal hall, as the page shows it. Filled from each row's notes (0001, 0009), only where they say it plainly.
alter table formals
  add column gowns text check (gowns in ('required', 'optional')), -- members' gowns
  add column dress_code text check (dress_code in ('black_tie', 'formal', 'smart', 'relaxed')), -- formal: jacket and tie or equivalent (`dress` is the editors' note)
  add column guests_allowed boolean,
  add column guests_max smallint check (guests_max >= 0), -- per member
  add column book_via text,                               -- the booking system, by name: "UPay", "SidNet"
  add column book_days_before smallint check (book_days_before >= 0),
  add column book_by time,                                -- with book_days_before: "by 14:00 two days before"
  add column url text,                                    -- the formal hall's own page (rules, booking)
  add column price_gbp numeric(6,2),                      -- a member's (student's) ticket
  add column guest_gbp numeric(6,2),                      -- a guest's ticket
  add column prices_seen date;                            -- when those prices were stated
comment on column formals.days is 'Formal days when the start time isn''t published (else they are service_slots with meal formal)';

update formals f set gowns = v.gowns, dress_code = v.dress
from (values
  ('christs/hall', 'required', 'smart'),
  ('churchill/dining-hall', 'optional', null),
  ('clare-hall/dining-hall', null, 'formal'),
  ('darwin/servery', 'optional', 'formal'),
  ('emmanuel/hall', 'required', null),
  ('fitzwilliam/buttery', 'required', 'formal'),
  ('girton/hall-cafeteria', 'required', null),
  ('gonville-and-caius/hall', 'required', null),
  ('homerton/dining-hall', 'optional', 'relaxed'),
  ('hughes-hall/fenners-dining-hall', 'optional', 'formal'),
  ('jesus/hall', 'required', 'formal'),
  ('kings/servery-dining-hall', null, 'relaxed'),
  ('lucy-cavendish/warburton-hall-servery', 'required', 'smart'),
  ('magdalene/hall', 'required', 'smart'),
  ('newnham/clough-hall', 'required', null),
  ('pembroke/hall', 'required', null),
  ('peterhouse/hall-servery', 'required', null),
  ('queens/cripps-dining-hall-cafeteria', 'required', null),
  ('robinson/dining-hall', 'required', 'smart'),
  ('st-edmunds/dining-hall', null, 'formal'),
  ('st-johns/hall', 'required', null),
  ('trinity-hall/cafeteria', 'required', null),
  ('wolfson/buttery-dining-hall', 'optional', 'formal')
) as v(venue_id, gowns, dress)
where f.venue_id = v.venue_id;

-- Guests: allowed wherever the notes say so; a number only where one applies every night (Robinson's differs by night).
update formals f set guests_allowed = true, guests_max = v.max::smallint
from (values
  ('christs/hall', null), ('churchill/dining-hall', null), ('clare-hall/dining-hall', 2), ('darwin/servery', 3), ('downing/servery-great-hall', null),
  ('emmanuel/hall', 4), ('fitzwilliam/buttery', 5), ('girton/hall-cafeteria', null), ('homerton/dining-hall', null), ('hughes-hall/fenners-dining-hall', null),
  ('jesus/hall', 3), ('lucy-cavendish/warburton-hall-servery', 5), ('magdalene/hall', 2), ('murray-edwards/dome-dining-hall', null), ('newnham/clough-hall', null),
  ('pembroke/hall', null), ('peterhouse/hall-servery', 2), ('queens/cripps-dining-hall-cafeteria', 5), ('robinson/dining-hall', null), ('selwyn/hall-servery', 2),
  ('sidney-sussex/servery-dining-hall', null), ('st-catharines/hall-cafeteria', null), ('st-edmunds/dining-hall', null), ('st-johns/hall', null), ('wolfson/buttery-dining-hall', 3)
) as v(venue_id, max)
where f.venue_id = v.venue_id;

-- Booking: the system, and a deadline where it's the same number of days before every formal.
update formals f set book_via = v.via, book_days_before = v.days::smallint, book_by = v.by::time
from (values
  ('christs/hall', 'Online form', 2, '14:00'),
  ('churchill/dining-hall', 'College SharePoint', null, null),
  ('clare-hall/dining-hall', 'UPay', 1, '13:45'),
  ('darwin/servery', 'UPay', null, null),
  ('downing/servery-great-hall', 'UPay', null, null),
  ('emmanuel/hall', null, 3, '19:00'),
  ('fitzwilliam/buttery', 'College Bills', 2, '14:00'),
  ('girton/hall-cafeteria', 'UPay', null, null),
  ('homerton/dining-hall', 'UPay', null, null),
  ('hughes-hall/fenners-dining-hall', 'UPay', null, null),
  ('jesus/hall', 'UPay', null, null),
  ('lucy-cavendish/warburton-hall-servery', 'Meal EPOS', null, null),
  ('magdalene/hall', 'UPay', 1, '12:00'),
  ('pembroke/hall', 'Pembroke Meals', null, null),
  ('peterhouse/hall-servery', 'UPay', 1, '11:00'),
  ('queens/cripps-dining-hall-cafeteria', 'UPay', 2, '14:00'),
  ('sidney-sussex/servery-dining-hall', 'SidNet', null, null),
  ('st-catharines/hall-cafeteria', 'UPay', null, null),
  ('trinity-hall/cafeteria', 'College intranet', null, null),
  ('wolfson/buttery-dining-hall', 'Dining Portal', 1, '12:00')
) as v(venue_id, via, days, by)
where f.venue_id = v.venue_id;

update formals f set url = v.url
from (values
  ('christs/hall', 'https://www.christs.cam.ac.uk/form/high-table-and-formal-hall'),
  ('clare/hall', 'https://www.clare.cam.ac.uk/admissions-outreach/postgraduate-study/dining-college'),
  ('darwin/servery', 'https://www.darwin.cam.ac.uk/members/info/dining-in-college/'),
  ('downing/servery-great-hall', 'https://dow.cam.ac.uk/current-students/catering'),
  ('emmanuel/hall', 'https://apps.emma.cam.ac.uk/college/documents/pdfs/FORMALS.pdf'),
  ('fitzwilliam/buttery', 'https://mcr.fitz.cam.ac.uk/overview/formal-hall/'),
  ('homerton/dining-hall', 'https://www.homerton.cam.ac.uk/current-members/facilities'),
  ('hughes-hall/fenners-dining-hall', 'https://www.hughes.cam.ac.uk/student-centre/practical/dining/formal-halls/'),
  ('jesus/hall', 'https://www.jesus.cam.ac.uk/node/3398'),
  ('lucy-cavendish/warburton-hall-servery', 'https://lucy.cam.ac.uk/formal-hall-faqs'),
  ('pembroke/hall', 'https://pem.cam.ac.uk/college/catering/information-students/formal-hall-procedure'),
  ('queens/cripps-dining-hall-cafeteria', 'https://www.queens.cam.ac.uk/life-at-queens/catering/formal-hall/'),
  ('robinson/dining-hall', 'https://mcr.robinson.cam.ac.uk/formal-hall'),
  ('st-catharines/hall-cafeteria', 'https://www.caths.cam.ac.uk/students/college-facilities-and-forms/catering-for-our-community/formal-hall'),
  ('st-edmunds/dining-hall', 'https://my-cr.st-edmunds.cam.ac.uk/facilities/catering/'),
  ('st-johns/hall', 'https://www.joh.cam.ac.uk/node/304'),
  ('trinity-hall/cafeteria', 'https://www.jcr.trinhall.cam.ac.uk/college-life/facilities/food-drink'),
  ('wolfson/buttery-dining-hall', 'https://www.wolfson.cam.ac.uk/college-life/food/formal-halls')
) as v(venue_id, url)
where f.venue_id = v.venue_id;

-- Prices stated for this year or last autumn. Not: Lucy and Peterhouse (2025/26 lists, this year's not out),
-- Magdalene (an undated JCR list the MCR's contradicts), King's (an undated estimate). Wolfson's are without wine.
update formals f set price_gbp = v.member, guest_gbp = v.guest, prices_seen = v.seen::date
from (values
  ('churchill/dining-hall', 15.70, 16.75, '2026-06-01'),
  ('clare-hall/dining-hall', 17.50, 21.00, '2026-10-01'),
  ('emmanuel/hall', 13.10, 22.65, '2025-11-01'),
  ('hughes-hall/fenners-dining-hall', 17.00, 20.00, '2026-10-07'),
  ('robinson/dining-hall', 13.70, 22.25, '2026-10-07'),
  ('sidney-sussex/servery-dining-hall', 14.50, 19.95, '2026-10-07'),
  ('wolfson/buttery-dining-hall', 17.80, 21.36, '2026-10-07')
) as v(venue_id, member, guest, seen)
where f.venue_id = v.venue_id;

-- Formal days where the start isn't published, so there's no slot (St Edmund's: "most" Tue and Fri).
update formals f set days = v.days::text[]
from (values
  ('corpus-christi/cafeteria', '{fri,sun}'),
  ('girton/hall-cafeteria', '{thu}'),
  ('homerton/dining-hall', '{tue}'),
  ('queens/old-hall', '{fri}'),
  ('sidney-sussex/servery-dining-hall', '{wed,fri,sun}'),
  ('st-catharines/hall-cafeteria', '{wed,thu,sun}'),
  ('st-edmunds/dining-hall', '{tue,fri}'),
  ('st-johns/hall', '{sun,tue,wed,thu,fri}'),
  ('trinity-hall/cafeteria', '{thu,sun}')
) as v(venue_id, days)
where f.venue_id = v.venue_id;
