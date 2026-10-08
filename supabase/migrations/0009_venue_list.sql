-- The venue list, reviewed 8 Oct 2026 against each college's own pages, University Catering and the
-- University map (map.cam.ac.uk, café layer). A venue is somewhere you go to eat or drink:
--   * a café that becomes a bar in the evening, in the same room, is one venue (one type for its icon;
--     its café and bar hours put it under both in the app);
--   * formal hall is a meal ('formal'). Where it's held in the room people eat cafeteria meals in, it's a
--     service of that venue; where it has a room of its own (St John's Hall, Christ's Hall, ...), that room
--     is a dining venue. The formals table now hangs off the venue that holds them;
--   * not venues: common rooms, tea and coffee gatherings, vending machines, overflow seating.
-- Unknown hours ⇒ no slot. Formal end times are rarely published: "about two hours" is noted where assumed.

-- Formal hall is a meal: slots now, menus when a college publishes them.
alter table service_slots drop constraint service_slots_meal_check;
alter table service_slots add constraint service_slots_meal_check check (meal in ('breakfast', 'brunch', 'lunch', 'dinner', 'formal', 'snacks', 'bar'));
alter table menu_days drop constraint menu_days_service_check;
alter table menu_days add constraint menu_days_service_check check (service in ('breakfast', 'brunch', 'lunch', 'dinner', 'formal', 'snacks', 'bar'));

-- Venue ids are primary keys without ON UPDATE CASCADE: a new slug means a new row, with its slots, menus and
-- ingest runs moved over.
create function pg_temp.move_venue(old_id text, new_slug text) returns void language plpgsql as $$
declare
  new_id text := split_part(old_id, '/', 1) || '/' || new_slug;
begin
  insert into venues select * from jsonb_populate_record(null::venues, (select to_jsonb(v) || jsonb_build_object('id', new_id, 'slug', new_slug) from venues v where id = old_id));
  update service_slots set venue_id = new_id, venue = new_slug where venue_id = old_id;
  update menu_days set venue_id = new_id, venue = new_slug where venue_id = old_id;
  update ingest_runs set venue_id = new_id where venue_id = old_id;
  delete from venues where id = old_id;
end $$;

-- The same room under two names: `gone`'s hours (and anything else attached) move to `keep`.
create function pg_temp.absorb(keep text, gone text) returns void language plpgsql as $$
begin
  update service_slots set venue_id = keep, venue = split_part(keep, '/', 2) where venue_id = gone;
  update menu_days set venue_id = keep, venue = split_part(keep, '/', 2) where venue_id = gone;
  update ingest_runs set venue_id = keep where venue_id = gone;
  delete from venues where id = gone;
end $$;

-- Not venues: a tea break, a coffee-and-cake gathering, vending machines, spare seating for the Servery.
-- Hughes Hall's Garden Room Café opened in October 2020 alongside a marquee as overflow for the dining hall;
-- nothing about it since 2021, and the College's dining page doesn't mention it.
delete from venues where id in ('st-edmunds/common-room', 'clare-hall/common-room', 'lucy-cavendish/oldham-common-room', 'selwyn/borradaile-room', 'hughes-hall/garden-room-cafe');

-- Robinson: the cafeteria is the Garden Restaurant; formal hall is in the Dining Hall (added below).
select pg_temp.move_venue('robinson/garden-restaurant-dining-hall', 'garden-restaurant');
update venues set name = 'Garden Restaurant' where id = 'robinson/garden-restaurant';

-- Cafés that are bars in the evening, in the same room.
select pg_temp.absorb('christs/buttery', 'christs/buttery-bar');
update venues set
  hours_text = 'café through the day, bar in the evenings (times ?)',
  serves = 'sandwiches, paninis, crisps, fruit, pastries, cakes, Costa coffee; in the evening a bar with drinks incl. a non-alcoholic range; sofas, TV, darts ([page](https://www.christs.cam.ac.uk/facilities/buttery))',
  aliases = array['Buttery Bar']
where id = 'christs/buttery';

select pg_temp.move_venue('downing/lord-butterfield-cafe', 'lord-butterfield');
select pg_temp.absorb('downing/lord-butterfield', 'downing/evening-bar');
update venues set
  name = 'Lord Butterfield Café and Bar',
  where_text = 'Butterfield building; the JCR is downstairs',
  hours_text = 'café Mon–Fri 10:00–18:00 (Oct 2026), 10:00–19:30 from Nov 2026; bar Michaelmas/Lent 20:30–23:30, Easter term 20:30–23:00. Google Maps returned only Wed 10:00–16:00 [Google Maps, 2026-10-07]',
  serves = 'breakfast sandwiches, baguettes, cakes, coffee; student-staffed evening bar with parties, open mic nights, quizzes and gigs',
  url = 'https://www.dow.cam.ac.uk/current-students/college-spaces-and-facilities/lord-butterfield-cafe-and-bar',
  aliases = array['Butterfield']
where id = 'downing/lord-butterfield';

select pg_temp.absorb('fitzwilliam/coffee-shop', 'fitzwilliam/bar');
update venues set
  name = 'Coffee Shop and Bar',
  where_text = 'main College building; the café becomes the College Bar in the evening ([MCR](https://mcr.fitz.cam.ac.uk/group/formal-hall))',
  hours_text = 'café term: Mon–Fri 08:00–18:00; Sat 08:00–17:00; Sun 09:00–17:00; breakfast to 10:30; vacation Mon–Fri 08:00–15:00. Bar term: Mon–Fri 18:00–23:00; Sat 17:00–23:00; Sun 17:00–22:30 (varies for events and vacation). Google Maps differs for the café (Mon–Sat 08:00–18:00, Sun closed), probably outdated [Google Maps, 2026-10-07]',
  serves = 'breakfast, sandwiches, snacks, coffee and tea; alcoholic and non-alcoholic drinks and snacks in the evening',
  access = access || '{"text": "public (café, official page); evening bar access not stated"}'
where id = 'fitzwilliam/coffee-shop';

select pg_temp.move_venue('girton/social-hub-cafe', 'social-hub');
select pg_temp.absorb('girton/social-hub', 'girton/social-hub-bar');
update venues set
  name = 'Social Hub',
  where_text = 'Social Hub (opened 2019); the counter opens as a bar in the evening. The Cellar Bar beneath is booked for events (e.g. JCR ents), not a regular venue ([dining](https://girton.cam.ac.uk/dining-and-socialising))',
  hours_text = 'café by day, bar in the evening (times ?)',
  serves = 'hot and cold food and drinks; evening bar; table football, bar games'
where id = 'girton/social-hub';

select pg_temp.move_venue('jesus/college-cafe', 'the-roost');
select pg_temp.absorb('jesus/the-roost', 'jesus/evening-bar');
update venues set
  name = 'The Roost', type = 'bar',
  where_text = 'West Court (reported)',
  hours_text = 'café by day, bar in the evening (times ?)',
  serves = 'coffee, tea, cakes and food by day; beer, wine, cocktails in the evening; terrace over the lawn ([Varsity](https://www.varsity.co.uk/violet/16199))'
where id = 'jesus/the-roost';

select pg_temp.absorb('magdalene/college-bar', 'magdalene/college-cafe');
update venues set
  name = 'College Bar and Café',
  hours_text = 'café Mon–Fri 14:00–19:00; bar Tue–Sat 19:00–23:00 ([catering](https://www.magd.cam.ac.uk/study-magdalene/undergraduate-study/accommodation-and-food/catering))',
  serves = 'drinks and light snacks by day; bar in the evening'
where id = 'magdalene/college-bar';

select pg_temp.absorb('murray-edwards/art-cafe', 'murray-edwards/college-bar');
update venues set
  where_text = 'roof terrace overlooking Fountain Court',
  hours_text = 'public hours Mon–Fri 08:30–17:00; Sat–Sun 09:00–17:00; Google Maps agrees. Student-run bar in the evenings (times ?)',
  serves = 'homemade cake, hot/iced coffee, smoothies; study space. In the evening a student-run bar with poetry readings, themed bops, music nights',
  access = access || '{"text": "public (daytime); the evening bar is student-run"}'
where id = 'murray-edwards/art-cafe';

select pg_temp.absorb('queens/qbar', 'queens/cafe');
update venues set
  name = 'Café & QBar',
  where_text = 'JCR Bar, Cripps Court',
  hours_text = 'café term: Mon–Fri 10:30–16:00; vacation Mon–Fri 10:30–15:30; closed for some private functions. Bar term: Sun–Thu 18:30–23:00; Fri–Sat 18:30–23:30; food Wed–Sun 19:00–21:30. Summer vacation daily 18:30–22:00',
  serves = 'sandwiches, paninis, cakes, barista coffee; beers, spirits, soft drinks, bar food menu ([page](https://www.queens.cam.ac.uk/life-at-queens/catering/cafe-qbar/))',
  payment = '{"cash": false, "prov": {"confidence": "medium", "source_kind": "official"}, "text": "UPay (University card) or contactless; no cash", "bank_card": true, "university_card": true}'
where id = 'queens/qbar';

select pg_temp.move_venue('robinson/red-brick-cafe', 'red-brick');
select pg_temp.absorb('robinson/red-brick', 'robinson/red-brick-bar');
update venues set
  name = 'Red Brick Café/Bar',
  where_text = 'Long Court, between Dining Room and JCR',
  hours_text = 'Michaelmas 2026: Mon–Fri 08:00–23:00; Sat–Sun 10:00–23:00; licensed bar 18:00–23:00 daily. Pizza from 18:00; weekend bar supper 18:00–20:00. Google Maps shows older hours (Mon–Fri 09:30–23:00, Sat–Sun 11:00–23:00) [Google Maps, 2026-10-07]',
  serves = 'sandwiches, hot pastries, cakes, barista coffee, meal deals, pizza; alcoholic and soft drinks in the evening ([page](https://www.robinson.cam.ac.uk/college-life/red-brick-cafe-bar)); pastries only at breakfast early in term. Page says breakfast "8am to 10.30pm", probably a typo for 10:30',
  url = 'https://www.robinson.cam.ac.uk/college-life/red-brick-cafe-bar',
  payment = '{"prov": {"confidence": "medium", "source_kind": "official"}, "text": "member card (food purse / bar purse) or debit card", "bank_card": true, "university_card": true}'
where id = 'robinson/red-brick';

select pg_temp.move_venue('selwyn/cafe', 'cafe-bar');
select pg_temp.absorb('selwyn/cafe-bar', 'selwyn/bar');
update venues set
  name = 'Café-Bar',
  where_text = 'Old Court, next to A staircase ([University map](https://map.cam.ac.uk/))',
  hours_text = 'term: café daily 11:00–15:00; bar 18:00–23:00; Google Maps agrees (Cafe-Bar daily 11:00–15:00, 18:00–23:00)',
  serves = 'coffee, cake; alcoholic and non-alcoholic drinks; paninis, pastries, pizzas; outside seating, TV for major events (University map)'
where id = 'selwyn/cafe-bar';

select pg_temp.absorb('st-catharines/bar', 'st-catharines/coffee-bar');
update venues set
  name = 'Bar & Coffee Bar',
  where_text = 'beneath the McGrath Centre',
  hours_text = 'Coffee Bar term: Mon–Fri 09:00–16:00 ([official](https://www.caths.cam.ac.uk/students/college-facilities-and-forms/catering-for-our-community/bar)); MCR page says 10:00. Bar term: Wed–Sat 19:00–23:00 (official); MCR page says Mon–Sat 17:00–23:00, Sun 17:00–22:00',
  serves = 'hot and cold drinks, sandwiches, hot panini/ciabatta, pastries, snacks; soft drinks and alcohol in the evening; bops and events',
  prices = '{"prov": {"confidence": "medium", "observed_at": "2026-10-07", "source_kind": "official"}, "text": "? (2026/27 menu PDF linked from bar page)"}',
  access = access || '{"text": "? (student-run bar)"}'
where id = 'st-catharines/bar';

select pg_temp.absorb('trinity/bar', 'trinity/coffee-shop');
update venues set
  name = 'Bar & Coffee Shop',
  hours_text = 'café by day, bar in the evening (times ? not reconfirmed)',
  serves = 'daytime food and coffee; drinks in the evening; the bar doubles as the daytime café ([Varsity](https://www.varsity.co.uk/lifestyle/23991))'
where id = 'trinity/bar';

select pg_temp.move_venue('trinity-hall/coffee-shop', 'aula');
select pg_temp.absorb('trinity-hall/aula', 'trinity-hall/aula-bar');
update venues set
  name = 'Coffee Shop & Aula Bar',
  where_text = 'the Aula, under North Court, Central Site',
  hours_text = 'coffee shop through the day, Aula Bar in the evening (times ?)',
  serves = 'barista coffee, hot drinks, smoothies, sandwiches, homemade cakes, snacks; drinks in the evening; student-run Crescent Room club nights ([food and drink](https://trinhall.cam.ac.uk/study-with-us/life-trinity-hall/food-and-drink))'
where id = 'trinity-hall/aula';

select pg_temp.absorb('wolfson/the-den', 'wolfson/the-den-bar');
update venues set
  hours_text = 'daily from 09:15, hot drinks to 22:00; licensed bar daily 17:00–00:00',
  serves = 'sandwiches, snacks, drinks; licensed bar in the evening'
where id = 'wolfson/the-den';

-- Missing venues, and formal halls held in a room of their own. Access is stated only where sourced.
insert into venues (id, site, slug, name, type, where_text, hours_text, serves, url, access, payment, dietary, sort_order)
select v.site || '/' || v.slug, v.site, v.slug, v.name, v.type, v.where_text, v.hours_text, v.serves, v.url,
  case when v.access is null
    then '{"level": "unknown", "prov": {"confidence": "low", "source_kind": "unknown"}}'::jsonb
    else jsonb_build_object('level', v.access, 'text', v.access_text, 'prov', jsonb_build_object('confidence', 'medium', 'source_kind', 'official', 'observed_at', '2026-10-08'))
  end,
  '{"prov": {"confidence": "low", "source_kind": "unknown"}}'::jsonb,
  '{"tags": [], "prov": {"confidence": "low", "source_kind": "unknown"}}'::jsonb,
  v.sort_order
from (values
  ('emmanuel', 'bar', 'Bar', 'bar', 'Furness Lodge, Young''s Court (opened 2023)', '? (student-run)', 'drinks ([architects](https://ad-c.org/2024/07/16/youngs-court-emmanuel-college-adc/))', null, null, null, 2),
  ('st-edmunds', 'eddies-bar', 'Eddie''s Bar', 'bar', 'Norfolk Building, by the Combination Room (CR)', 'term: Sun–Thu 19:30–23:30; Fri–Sat 19:30–00:30; usually an hour later for bops ([CR](https://my-cr.st-edmunds.cam.ac.uk/?p=59))', 'drinks; run by students', null, null, null, 2),
  ('west-cambridge', 'aristocaters-cafe', 'Aristocaters Café', 'cafe', 'Electrical Engineering Division, 9 JJ Thomson Avenue', 'not published (on the University map''s café layer, 8 Oct 2026)', null, 'https://www.aristocaters.co.uk/Our_Cafes/', null, null, 10),
  ('christs', 'hall', 'Hall', 'hall', 'sixteenth-century Hall, between First and Second Court', 'formal hall Sun–Fri in term, food served from 19:30; never Sat', 'formal hall: three-course served dinner', null, 'members_guests', 'formal hall: members and booked guests', 1),
  ('clare', 'hall', 'Hall', 'hall', null, 'formal hall four times a week in term (days ?); graduate formal Fri 19:30. Buttery lunch can be taken up to the Hall ([dining](https://clare.cam.ac.uk/admissions-outreach/undergraduate-study/life-clare/dining-and-catering))', 'formal hall: three courses with Fellows', null, 'members_guests', 'formal hall: members and booked guests', 1),
  ('jesus', 'hall', 'Hall', 'hall', null, 'formal hall 19:30 Tue, Fri, Sun in term. The formal page also lists Wed (postgraduates, in Upper Hall); the cafeteria page says Tue–Fri and Sun', 'formal hall: three courses served by candlelight', 'https://www.jesus.cam.ac.uk/node/3398', 'members_guests', 'formal hall: members and booked guests (up to 3)', 1),
  ('magdalene', 'hall', 'Hall', 'hall', 'sixteenth-century Hall, First Court', 'formal hall 19:30 "most nights of the week during Full Term" (College); Tue, Thu, Sun per JCR', 'formal hall: candlelit three courses, waiter service', null, 'members_guests', 'formal hall: members and booked guests', 1),
  ('newnham', 'clough-hall', 'Clough Hall', 'hall', 'Clough', 'formal hall 19:30 through term (days ?)', 'formal hall: three-course dinner', null, 'members_guests', 'formal hall: members and booked guests', 1),
  ('pembroke', 'hall', 'Hall', 'hall', null, 'formal hall every evening in term, grace 19:15 ([graduate guide](https://gp.pem.cam.ac.uk/graduatelife/graduates-guide-to-cambridge/)). Servery meals are eaten in the Buttery, not Hall', 'formal hall: table service', 'https://www.pem.cam.ac.uk/college/catering/information-students/formal-hall-procedure', 'members_guests', 'formal hall: members and booked guests', 1),
  ('queens', 'old-hall', 'Old Hall', 'hall', null, 'Formal Friday in term (time ?) ([JCR prospectus 2025](https://qjcr.org.uk/content/Queens%27-Alternative-Prospectus-2025-1.pdf)); other formals are in Cripps Dining Hall', 'formal hall: traditionally served Friday dinner', null, 'members_guests', 'formal hall: members and booked guests', 1),
  ('robinson', 'dining-hall', 'Dining Hall', 'hall', null, 'formal hall Tue, Fri in term; refreshments on the Hall Balcony 19:00, dinner 19:30', 'formal hall: served dinner; Fellows on high table Fri', null, 'members_guests', 'formal hall: members and booked guests', 1),
  ('st-johns', 'hall', 'Hall', 'hall', 'sixteenth-century Hall', 'formal hall five nights a week in term, not Mon or Sat (time ?); 150 tickets', 'formal hall: candlelit three courses, gowns', null, 'members_guests', 'formal hall: members and booked guests', 1)
) as v(site, slug, name, type, where_text, hours_text, serves, url, access, access_text, sort_order);

update venues set aliases = array['Harvey''s'] where id = 'gonville-and-caius/florey-cafe'; -- University map: "Harvey's Cafe", Harvey Court

-- Hours found in this review. Formal slots only where both the days and the start are published.
insert into service_slots (venue_id, site, venue, meal, days, start_time, end_time, period, note, prov)
select s.venue_id, split_part(s.venue_id, '/', 1), split_part(s.venue_id, '/', 2), s.meal, s.days, s.start_time::time, s.end_time::time, s.period, s.note,
  jsonb_build_object('confidence', 'medium', 'source_kind', 'official', 'observed_at', '2026-10-08')
from (values
  ('magdalene/college-bar', 'snacks', '{mon,tue,wed,thu,fri}'::text[], '14:00', '19:00', 'all', null),
  ('magdalene/college-bar', 'bar', '{tue,wed,thu,fri,sat}', '19:00', '23:00', 'all', null),
  ('st-edmunds/eddies-bar', 'bar', '{sun,mon,tue,wed,thu}', '19:30', '23:30', 'term', 'usually an hour later for bops'),
  ('st-edmunds/eddies-bar', 'bar', '{fri,sat}', '19:30', '00:30', 'term', 'usually an hour later for bops'),
  ('christs/hall', 'formal', '{sun,mon,tue,wed,thu,fri}', '19:30', '21:30', 'term', 'end not published (about two hours)'),
  ('churchill/dining-hall', 'formal', '{thu,fri,sun}', '19:30', '21:30', 'term', 'end not published (about two hours)'),
  ('clare-hall/dining-hall', 'formal', '{wed}', '19:00', '22:00', 'all', '19:00 for 19:30'),
  ('darwin/servery', 'formal', '{wed,fri}', '19:20', '21:20', 'term', 'most weeks; check-in 19:00; end not published (about two hours)'),
  ('downing/servery-great-hall', 'formal', '{mon,wed,fri,sun}', '19:30', '21:00', 'term', null),
  ('emmanuel/hall', 'formal', '{mon,tue,thu,fri,sat,sun}', '19:30', '21:30', 'term', 'traditional Formal Mon, Fri, Sat, Sun; group bookings Tue, Thu; end not published (about two hours)'),
  ('fitzwilliam/buttery', 'formal', '{wed,fri}', '19:30', '21:30', 'term', 'other nights by arrangement; end not published (about two hours)'),
  ('hughes-hall/fenners-dining-hall', 'formal', '{tue,fri}', '19:30', '21:30', 'term', 'usually; drinks 19:00; end not published (about two hours)'),
  ('jesus/hall', 'formal', '{tue,fri,sun}', '19:30', '21:30', 'term', 'end not published (about two hours)'),
  ('pembroke/hall', 'formal', '{mon,tue,wed,thu,fri,sat,sun}', '19:15', '21:15', 'term', 'grace 19:15; end not published (about two hours)'),
  ('peterhouse/hall-servery', 'formal', '{mon,tue,wed,thu,fri,sat,sun}', '19:30', '21:30', 'term', 'end not published (about two hours)'),
  ('queens/cripps-dining-hall-cafeteria', 'formal', '{wed,sun}', '19:30', '21:30', 'term', 'end not published (about two hours)'),
  ('robinson/dining-hall', 'formal', '{tue,fri}', '19:30', '21:30', 'term', 'refreshments 19:00; end not published (about two hours)'),
  ('selwyn/hall-servery', 'formal', '{tue,thu}', '19:30', '21:30', 'term', 'end not published (about two hours)'),
  ('wolfson/buttery-dining-hall', 'formal', '{tue,fri}', '19:15', '21:45', 'term', 'drinks, dinner, coffee and port'),
  ('wolfson/buttery-dining-hall', 'formal', '{tue}', '19:15', '21:45', 'vacation', 'drinks, dinner, coffee and port')
) as s(venue_id, meal, days, start_time, end_time, period, note);

-- Formals belong to the venue that holds them (Queens' has two: Cripps and Old Hall).
alter table formals add column venue_id text references venues(id) on delete cascade;
update formals f set venue_id = m.venue_id
from (values
  ('christs', 'christs/hall'), ('churchill', 'churchill/dining-hall'), ('clare', 'clare/hall'), ('clare-hall', 'clare-hall/dining-hall'),
  ('corpus-christi', 'corpus-christi/cafeteria'), ('darwin', 'darwin/servery'), ('downing', 'downing/servery-great-hall'), ('emmanuel', 'emmanuel/hall'),
  ('fitzwilliam', 'fitzwilliam/buttery'), ('girton', 'girton/hall-cafeteria'), ('gonville-and-caius', 'gonville-and-caius/hall'), ('homerton', 'homerton/dining-hall'),
  ('hughes-hall', 'hughes-hall/fenners-dining-hall'), ('jesus', 'jesus/hall'), ('kings', 'kings/servery-dining-hall'), ('lucy-cavendish', 'lucy-cavendish/warburton-hall-servery'),
  ('magdalene', 'magdalene/hall'), ('murray-edwards', 'murray-edwards/dome-dining-hall'), ('newnham', 'newnham/clough-hall'), ('pembroke', 'pembroke/hall'),
  ('peterhouse', 'peterhouse/hall-servery'), ('queens', 'queens/cripps-dining-hall-cafeteria'), ('robinson', 'robinson/dining-hall'), ('selwyn', 'selwyn/hall-servery'),
  ('sidney-sussex', 'sidney-sussex/servery-dining-hall'), ('st-catharines', 'st-catharines/hall-cafeteria'), ('st-edmunds', 'st-edmunds/dining-hall'), ('st-johns', 'st-johns/hall'),
  ('trinity', 'trinity/hall-servery'), ('trinity-hall', 'trinity-hall/cafeteria'), ('wolfson', 'wolfson/buttery-dining-hall')
) as m(site, venue_id)
where f.site = m.site;
alter table formals drop constraint formals_pkey;
alter table formals alter column venue_id set not null;
alter table formals add primary key (venue_id);
comment on column formals.site is 'denormalised from venues.site';

insert into formals (site, venue_id, where_text, days_text, format, prov) values
  ('queens', 'queens/old-hall', 'Old Hall', 'Fri in term (Formal Friday) ([JCR prospectus 2025](https://qjcr.org.uk/content/Queens%27-Alternative-Prospectus-2025-1.pdf))', 'traditionally served dinner',
   '{"confidence": "medium", "observed_at": "2026-10-08", "source_kind": "reported"}');
update formals set where_text = 'Hall, between First and Second Court' where venue_id = 'christs/hall';
update formals set where_text = 'Hall (the Buttery is the cafeteria)' where venue_id = 'clare/hall';
update formals set where_text = 'Hall; postgraduates dine separately in Upper Hall on Wed' where venue_id = 'jesus/hall';
update formals set where_text = 'Hall (servery meals are eaten in the Buttery)', days_text = 'every evening in term ([graduate guide](https://gp.pem.cam.ac.uk/graduatelife/graduates-guide-to-cambridge/))' where venue_id = 'pembroke/hall';
update formals set where_text = 'Hall (Garden Restaurant is the cafeteria)' where venue_id = 'robinson/dining-hall';
update formals set days_text = 'Mon, Wed, Fri, Sun (term) ([catering](https://dow.cam.ac.uk/current-students/catering))', time = '19:30–21:00' where venue_id = 'downing/servery-great-hall';
update formals set days_text = 'Tue ([facilities](https://www.homerton.cam.ac.uk/current-members/facilities)); tickets released weekly' where venue_id = 'homerton/dining-hall';
update formals set days_text = 'five nights in term, not Mon or Sat ([St John''s](https://www.joh.cam.ac.uk/node/304))' where venue_id = 'st-johns/hall';
update formals set days_text = days_text || '; College page: "most nights of the week during Full Term"' where venue_id = 'magdalene/hall';

-- Dining first (cafeteria, then the formal hall), then cafés, then bars, on the colleges changed here.
update venues v set sort_order = o.n - 1
from (
  select id, row_number() over (partition by site order by case type when 'hall' then 0 when 'cafe' then 1 when 'bar' then 2 else 3 end, sort_order, id) as n
  from venues
  where site in ('christs', 'clare', 'clare-hall', 'downing', 'emmanuel', 'fitzwilliam', 'girton', 'hughes-hall', 'jesus', 'lucy-cavendish', 'magdalene',
    'murray-edwards', 'newnham', 'pembroke', 'queens', 'robinson', 'selwyn', 'st-catharines', 'st-edmunds', 'st-johns', 'trinity', 'trinity-hall', 'wolfson')
) o
where v.id = o.id;
