-- University venues: cafés and canteens run by or on the University's sites, not by a college.
-- From the University Catering list (catering.admin.cam.ac.uk) and each venue's own page, read 8 Oct 2026.
-- One-off seed; from here on the database is the record. Hours are as published; access only where stated.

insert into sites (slug, name, short_name, kind, official_dining_url, reviewed) values
  ('west-cambridge', 'West Cambridge', null, 'university', 'https://www.catering.admin.cam.ac.uk/food-and-drink/places-eat/out-university-centre', '2026-10-08'),
  ('sidgwick', 'Sidgwick Site', 'Sidgwick', 'university', 'https://www.catering.admin.cam.ac.uk/food-and-drink/places-eat/out-university-centre', '2026-10-08'),
  ('university-library', 'University Library', 'UL', 'university', 'https://www.catering.admin.cam.ac.uk/food-and-drink/places-eat/out-university-centre', '2026-10-08'),
  ('cms', 'Centre for Mathematical Sciences', 'CMS', 'university', 'https://www.catering.admin.cam.ac.uk/food-and-drink/places-eat/out-university-centre', '2026-10-08'),
  ('chemistry', 'Department of Chemistry', 'Chemistry', 'university', null, '2026-10-08'),
  ('downing-site', 'Downing Site', null, 'university', 'https://www.catering.admin.cam.ac.uk/food-and-drink/places-eat/out-university-centre', '2026-10-08'),
  ('new-museums', 'New Museums Site', 'New Museums', 'university', 'https://www.catering.admin.cam.ac.uk/food-and-drink/places-eat/out-university-centre', '2026-10-08'),
  ('old-addenbrookes', 'Old Addenbrooke''s Site', 'Old Addenbrooke''s', 'university', 'https://www.catering.admin.cam.ac.uk/food-and-drink/places-eat/out-university-centre', '2026-10-08'),
  ('biomedical-campus', 'Cambridge Biomedical Campus', 'Biomedical Campus', 'university', 'https://www.catering.admin.cam.ac.uk/food-and-drink/places-eat/out-university-centre', '2026-10-08'),
  ('fitzwilliam-museum', 'The Fitzwilliam Museum', 'Fitzwilliam Museum', 'university', null, '2026-10-08'),
  ('kettles-yard', 'Kettle''s Yard', null, 'university', null, '2026-10-08'),
  ('botanic-garden', 'Cambridge University Botanic Garden', 'Botanic Garden', 'university', null, '2026-10-08'),
  ('madingley-hall', 'Madingley Hall', null, 'university', null, '2026-10-08');

-- access: level only where the venue's page says who may use it; payment and diet are unknown unless stated.
insert into venues (id, site, slug, name, type, where_text, serves, hours_text, url, access, payment, dietary, sort_order)
select v.site || '/' || v.slug, v.site, v.slug, v.name, v.type, v.where_text, v.serves, v.hours_text, v.url,
  case when v.access is null
    then '{"level": "unknown", "prov": {"confidence": "low", "source_kind": "unknown"}}'::jsonb
    else jsonb_build_object('level', v.access, 'text', v.access_text, 'prov', jsonb_build_object('confidence', 'high', 'source_kind', 'official', 'observed_at', '2026-10-08', 'source_url', v.url))
  end,
  coalesce(v.payment, '{"prov": {"confidence": "low", "source_kind": "unknown"}}')::jsonb,
  jsonb_build_object('tags', to_jsonb(coalesce(v.tags, '{}'::text[])), 'prov', jsonb_build_object('confidence', case when v.tags is null then 'low' else 'medium' end, 'source_kind', case when v.tags is null then 'unknown' else 'official' end)),
  v.sort_order
from (values
  ('west-cambridge', 'west-hub-canteen', 'West Hub Canteen', 'hall', 'West Hub, JJ Thomson Avenue', 'breakfast, lunch mains (weekly menu), afternoon snacks; gluten-free and plant-based options', 'Canteen Mon–Fri 08:00–14:30; Italian Bar Mon–Fri 12:00–15:00 (official)', 'https://www.catering.admin.cam.ac.uk/cafes/west-hub-canteen', null, null, null::text, '{gluten_free,plant_based}'::text[], 0),
  ('west-cambridge', 'occidente', 'Occidente Kitchen and Bar', 'hall', 'West Hub, ground floor', 'Mediterranean bistro: stone-baked pizza, mains, sharing plates; bar with cocktails and wine; bookable', 'food Mon–Fri 12:00–15:00; drinks Mon–Tue 12:00–15:00, Wed–Fri 12:00–18:00 (official)', 'https://www.catering.admin.cam.ac.uk/cafes/occidente-kitchen-and-bar', 'public', 'staff, students, visitors and the wider public', null, null, 1),
  ('west-cambridge', 'west-hub-coffee-bar', 'West Hub Coffee Bar', 'cafe', 'West Hub, JJ Thomson Avenue', 'coffee, snacks', 'Mon–Fri 08:00–16:00 (official)', 'https://www.catering.admin.cam.ac.uk/cafes/west-hub-canteen', null, null, null, null, 2),
  ('west-cambridge', 'scholars-brew', 'Scholars Brew', 'cafe', 'Hauser Forum, 3 Charles Babbage Road', 'coffee, pastries, hot mains (weekly menu), jacket potatoes', 'Mon–Fri 08:00–17:00 (official)', 'https://www.catering.admin.cam.ac.uk/cafes/scholars-brew', null, null, null, null, 3),
  ('west-cambridge', 'the-servery', 'The Servery', 'cafe', 'Charles Babbage Road', 'porridge and granola, wraps, baguettes, hot food daily, cakes; vegan, vegetarian, gluten-free and dairy-free options', 'Mon–Fri 08:00–16:00 (official)', 'https://www.catering.admin.cam.ac.uk/cafes/servery', null, null, null, '{vegan,vegetarian,gluten_free,dairy_free}', 4),
  ('west-cambridge', 'cavendish-cafe', 'Cavendish Café', 'cafe', 'Ray Dolby Centre, 3rd floor', 'pastries, sandwiches, soup, toasties, barista coffee; £6 student lunch deal; run by Cambridge Dining Company', 'Mon–Fri 08:30–15:30 (official)', 'https://www.cdc.events/cavendish-cafe/', null, null, null, null, 5),
  ('west-cambridge', 'ceb-cafe', 'CEB Café', 'cafe', 'Chemical Engineering and Biotechnology, ground floor atrium', 'sandwiches, wraps, salads, paninis, Japanese ready meals, coffee; vegetarian, vegan and gluten-free options', 'Mon–Fri 08:00–16:00 (official)', 'https://www.catering.admin.cam.ac.uk/cafes/ceb-cafe', null, null, null, '{vegetarian,vegan,gluten_free}', 6),
  ('west-cambridge', 'wgb-cafe', 'WGB Café', 'cafe', 'William Gates Building, ground floor', null, 'not published (cl.cam.ac.uk/facilities/catering.html, 8 Oct 2026)', null, null, null, null, null, 7),
  ('west-cambridge', 'blue-and-brew', 'Blue & Brew Café', 'cafe', 'University Sports Centre, Philippa Fawcett Drive', 'barista coffee, smoothies, sandwiches, paninis, salads, pastries, cakes', 'Mon–Fri 08:30–20:00, Sat–Sun 08:30–19:00 (official)', 'https://www.catering.admin.cam.ac.uk/cafes/blue-brew-cafe', null, null, null, null, 8),
  ('west-cambridge', 'greenwich-house-cafe', 'Greenwich House Café', 'cafe', 'Greenwich House, Madingley Rise', 'hot dishes from the West Hub kitchen (weekly menu), drinks', 'Mon–Thu 08:00–15:00, Fri 08:00–14:30 (official)', 'https://www.catering.admin.cam.ac.uk/cafes/greenwich-house-cafe', null, null, null, null, 9),
  ('sidgwick', 'the-buttery', 'The Buttery', 'cafe', 'Austin Robinson Building', 'Fairtrade coffee and tea, sandwiches, wraps, sausage rolls', 'Mon–Fri 08:30–16:00 (official)', 'https://www.catering.admin.cam.ac.uk/cafes/buttery', null, null, null, null, 0),
  ('sidgwick', 'arc-cafe', 'ARC Café', 'cafe', 'Alison Richard Building, 7 West Road', 'hot food, snacks, cakes; vegetarian and vegan options', 'Mon–Fri 08:30–16:30; summer 08:30–15:30 (official)', 'https://www.catering.admin.cam.ac.uk/cafes/arc-cafe', null, null, null, '{vegetarian,vegan}', 1),
  ('university-library', 'tea-room', 'Tea Room', 'cafe', 'North Wing', 'barista coffee, sandwiches, paninis, snacks, cakes; your own food welcome', 'Mon–Fri 09:00–15:00, Sat 09:00–14:00 (official)', 'https://www.catering.admin.cam.ac.uk/cafes/university-library-tea-room', null, null, null, null, 0),
  ('cms', 'cafe', 'Café', 'cafe', 'Central core, Wilberforce Road', 'coffee, cakes, pastries, soup, focaccia, jacket potatoes, breakfast and lunch specials; 10% off with a student card; run by Lemon Zest', 'Mon–Fri 08:30–15:00 (official)', 'https://www.catering.admin.cam.ac.uk/mathematical-sciences-cafe', null, null, null, null, 0),
  ('chemistry', 'cybercafe', 'Cybercafé', 'cafe', 'Centre for Molecular Informatics, top floor, Lensfield Road', 'hot and cold drinks, soup, sandwiches, snacks; microwaves for your own food', 'Mon–Fri 08:45–15:30 except bank holidays (official)', 'https://intranet.ch.cam.ac.uk/cybercafe-and-beyond', null, null, null, null, 0),
  ('downing-site', 'pathology-cafe', 'Pathology Café', 'cafe', 'Department of Pathology, Tennis Court Road', 'hot meal and soup of the day (menu changes weekly); breakfast from 09:00, lunch 12:00–14:00', 'Mon–Wed 09:00–15:30, Thu–Fri 09:00–14:00 (official)', 'https://www.catering.admin.cam.ac.uk/cafes/department-pathology', 'university', 'all current University members; not the public', null, '{vegetarian,dairy_free}', 0),
  ('new-museums', 'whale-cafe', 'Whale Café', 'cafe', 'Museum of Zoology, Downing Street', 'hot drinks, pastries, light lunches, deli; run by Lemon Zest', 'Tue–Sat 10:00–15:00 (official)', 'https://www.catering.admin.cam.ac.uk/cafes/whale-cafe', null, null, null, null, 0),
  ('old-addenbrookes', 'judge-cafe', 'Judge Business School Café', 'cafe', 'Judge Business School, 2nd floor atrium, Trumpington Street', null, 'not published', null, null, null, null, null, 0),
  ('old-addenbrookes', 'zest-cafe', 'Zest Café', 'cafe', 'Tennis Court Road', 'paninis, sandwiches, salads, soups, hot meals 12:00–14:00, cakes; garden', 'Mon–Fri 08:30–15:00 (official)', 'https://www.catering.admin.cam.ac.uk/cafes/zest-cafe', null, null, null, '{vegetarian,vegan}', 1),
  ('biomedical-campus', 'ground-cafe', 'Ground Café', 'cafe', 'School of Clinical Medicine, Hills Road', 'breakfast 08:30–11:30; lunch 12:00–14:00 (two hot mains, soup, salad bar); grab and go all day', 'Mon–Fri 08:30–16:30 (official)', 'https://www.catering.admin.cam.ac.uk/cafes/ground-cafe', null, null, null, '{vegetarian,vegan}', 0),
  ('biomedical-campus', 'jcbc-cafe', 'JCBC Café', 'cafe', 'Jeffrey Cheah Biomedical Centre, Puddicombe Way', 'coffee, cakes, sandwiches, soups, a hot meal daily (food until 14:00); run by Lemon Zest', 'Mon–Fri 08:00–16:00, food until 14:00 (official)', 'https://www.catering.admin.cam.ac.uk/cafes/jeffrey-cheah', 'public', 'open to the public', null, null, 1),
  ('biomedical-campus', 'cruk-cafe', 'CRUK Café', 'cafe', 'Li Ka Shing Centre, Robinson Way', 'coffee bar, paninis, salads, hot and cold mains; gluten-free and vegan options', 'Mon–Fri 12:00–16:00 (official)', 'https://www.catering.admin.cam.ac.uk/cafes/cruk-cafe', null, null, null, '{gluten_free,vegan}', 2),
  ('fitzwilliam-museum', 'courtyard-kitchen', 'Courtyard Kitchen', 'cafe', 'Trumpington Street', 'freshly prepared food; run by Cambridge Dining Company', 'Tue–Sat 10:00–16:30, Sun 12:00–16:30 (official)', 'https://www.cdc.events/events/courtyardkitchen/', 'public', 'open to the public', null, null, 0),
  ('kettles-yard', 'garden-kitchen', 'Garden Kitchen', 'cafe', 'Castle Street', null, 'Tue–Sun 10:30–16:30, closed Mon (official)', 'https://www.thegardenkitchen.uk/gardenkitchenatkettlesyard', 'public', 'a space for all', null, null, 0),
  ('botanic-garden', 'garden-cafe', 'The Garden Café', 'cafe', 'Opposite Cory Lawn, 1 Brookside', null, 'daily 10:00 to 17:30 Apr–Sep, 16:30 Oct and Feb–Mar, 15:30 Nov–Jan (official); stored as 15:30 year-round', 'https://www.thegardenkitchen.uk/the-garden-cafe', null, null, null, null, 0),
  ('madingley-hall', 'cafe', 'Café & Terrace Bar', 'cafe', 'Madingley, CB23 8AQ', 'coffee, cakes, light bites, lunches; cashless', 'daily 09:30–16:00 (official)', 'https://madingleyhall.cam.ac.uk/dining/the-cafe/', 'public', 'visitors welcome', '{"cash": false, "bank_card": true, "text": "cashless", "prov": {"confidence": "medium", "source_kind": "official"}}', null, 0)
) as v(site, slug, name, type, where_text, serves, hours_text, url, access, access_text, payment, tags, sort_order);

-- Cafés get one "snacks" slot (shown as Café) per run of days; dining venues get meal slots.
insert into service_slots (venue_id, site, venue, meal, days, start_time, end_time, period, note, prov)
select s.site || '/' || s.venue, s.site, s.venue, s.meal, s.days::text[], s.start_time::time, s.end_time::time, 'all', s.note,
  jsonb_build_object('confidence', s.confidence, 'source_kind', 'official', 'observed_at', '2026-10-08')
from (values
  ('west-cambridge', 'west-hub-canteen', 'breakfast', '{mon,tue,wed,thu,fri}', '08:00', '12:00', 'Canteen 08:00–14:30; breakfast/lunch split assumed', 'low'),
  ('west-cambridge', 'west-hub-canteen', 'lunch', '{mon,tue,wed,thu,fri}', '12:00', '14:30', 'Canteen 08:00–14:30; breakfast/lunch split assumed', 'low'),
  ('west-cambridge', 'occidente', 'lunch', '{mon,tue,wed,thu,fri}', '12:00', '15:00', null, 'medium'),
  ('west-cambridge', 'occidente', 'bar', '{mon,tue}', '12:00', '15:00', null, 'medium'),
  ('west-cambridge', 'occidente', 'bar', '{wed,thu,fri}', '12:00', '18:00', null, 'medium'),
  ('west-cambridge', 'west-hub-coffee-bar', 'snacks', '{mon,tue,wed,thu,fri}', '08:00', '16:00', null, 'medium'),
  ('west-cambridge', 'scholars-brew', 'snacks', '{mon,tue,wed,thu,fri}', '08:00', '17:00', null, 'medium'),
  ('west-cambridge', 'the-servery', 'snacks', '{mon,tue,wed,thu,fri}', '08:00', '16:00', null, 'medium'),
  ('west-cambridge', 'cavendish-cafe', 'snacks', '{mon,tue,wed,thu,fri}', '08:30', '15:30', null, 'medium'),
  ('west-cambridge', 'ceb-cafe', 'snacks', '{mon,tue,wed,thu,fri}', '08:00', '16:00', null, 'medium'),
  ('west-cambridge', 'blue-and-brew', 'snacks', '{mon,tue,wed,thu,fri}', '08:30', '20:00', null, 'medium'),
  ('west-cambridge', 'blue-and-brew', 'snacks', '{sat,sun}', '08:30', '19:00', null, 'medium'),
  ('west-cambridge', 'greenwich-house-cafe', 'snacks', '{mon,tue,wed,thu}', '08:00', '15:00', null, 'medium'),
  ('west-cambridge', 'greenwich-house-cafe', 'snacks', '{fri}', '08:00', '14:30', null, 'medium'),
  ('sidgwick', 'the-buttery', 'snacks', '{mon,tue,wed,thu,fri}', '08:30', '16:00', null, 'medium'),
  ('sidgwick', 'arc-cafe', 'snacks', '{mon,tue,wed,thu,fri}', '08:30', '16:30', 'closes 15:30 in summer', 'medium'),
  ('university-library', 'tea-room', 'snacks', '{mon,tue,wed,thu,fri}', '09:00', '15:00', null, 'medium'),
  ('university-library', 'tea-room', 'snacks', '{sat}', '09:00', '14:00', null, 'medium'),
  ('cms', 'cafe', 'snacks', '{mon,tue,wed,thu,fri}', '08:30', '15:00', null, 'medium'),
  ('chemistry', 'cybercafe', 'snacks', '{mon,tue,wed,thu,fri}', '08:45', '15:30', 'except bank holidays', 'medium'),
  ('downing-site', 'pathology-cafe', 'snacks', '{mon,tue,wed}', '09:00', '15:30', null, 'medium'),
  ('downing-site', 'pathology-cafe', 'snacks', '{thu,fri}', '09:00', '14:00', null, 'medium'),
  ('new-museums', 'whale-cafe', 'snacks', '{tue,wed,thu,fri,sat}', '10:00', '15:00', null, 'medium'),
  ('old-addenbrookes', 'zest-cafe', 'snacks', '{mon,tue,wed,thu,fri}', '08:30', '15:00', null, 'medium'),
  ('biomedical-campus', 'ground-cafe', 'snacks', '{mon,tue,wed,thu,fri}', '08:30', '16:30', null, 'medium'),
  ('biomedical-campus', 'jcbc-cafe', 'snacks', '{mon,tue,wed,thu,fri}', '08:00', '16:00', 'food until 14:00', 'medium'),
  ('biomedical-campus', 'cruk-cafe', 'snacks', '{mon,tue,wed,thu,fri}', '12:00', '16:00', null, 'medium'),
  ('fitzwilliam-museum', 'courtyard-kitchen', 'snacks', '{tue,wed,thu,fri,sat}', '10:00', '16:30', null, 'medium'),
  ('fitzwilliam-museum', 'courtyard-kitchen', 'snacks', '{sun}', '12:00', '16:30', null, 'medium'),
  ('kettles-yard', 'garden-kitchen', 'snacks', '{tue,wed,thu,fri,sat,sun}', '10:30', '16:30', null, 'medium'),
  ('botanic-garden', 'garden-cafe', 'snacks', '{mon,tue,wed,thu,fri,sat,sun}', '10:00', '15:30', 'seasonal: open later outside Nov–Jan; shortest hours stored', 'low'),
  ('madingley-hall', 'cafe', 'snacks', '{mon,tue,wed,thu,fri,sat,sun}', '09:30', '16:00', null, 'medium')
) as s(site, venue, meal, days, start_time, end_time, note, confidence);
