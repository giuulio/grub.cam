-- The WGB Café is Caffiend of Cambridge, 9 October 2026: an independent espresso bar (formerly at the Sports Centre)
-- on the ground floor of the William Gates Building. Its board at the counter carries the name; the Food Standards
-- Agency lists "Caffiend of Cambridge, William Gates Building" (FHRS 1626030, inspected 12 June 2025), and the
-- OpenStreetMap café there ("Computer Laboratory Café", the basemap's label) carries the same FHRS id. The department
-- page still calls it the WGB Café. No website of its own: its link is the Google Maps listing.

-- A new name means a new slug, and the venue id is a primary key without ON UPDATE CASCADE: move the row and
-- anything attached to it.
insert into venues select * from jsonb_populate_record(null::venues,
  (select to_jsonb(v) || '{"id": "west-cambridge/caffiend", "slug": "caffiend"}'::jsonb from venues v where id = 'west-cambridge/wgb-cafe'));
update service_slots set venue_id = 'west-cambridge/caffiend', venue = 'caffiend' where venue_id = 'west-cambridge/wgb-cafe';
update menu_days set venue_id = 'west-cambridge/caffiend', venue = 'caffiend' where venue_id = 'west-cambridge/wgb-cafe';
update ingest_runs set venue_id = 'west-cambridge/caffiend' where venue_id = 'west-cambridge/wgb-cafe';
update venue_prices set venue_id = 'west-cambridge/caffiend' where venue_id = 'west-cambridge/wgb-cafe';
update formals set venue_id = 'west-cambridge/caffiend' where venue_id = 'west-cambridge/wgb-cafe';
delete from venues where id = 'west-cambridge/wgb-cafe';

update venues set
  name = 'Caffiend of Cambridge',
  aliases = array['WGB Café', 'Computer Laboratory Café'],
  where_text = 'William Gates Building, ground floor, south-west corner (W046)',
  serves = 'espresso drinks, single or double; Genera (with real orange zest); teas, hot chocolate; sandwiches and snacks. Time Out Love Local winner 2015 (board at the counter)',
  hours_text = 'Mon–Fri 08:30–16:00 [OpenStreetMap, checked 2026-03-26]; not published by the department',
  url = 'https://maps.google.com/?cid=3671640934368876173',
  payment = '{"bank_card": true, "text": "all cards except Amex (board at the counter)", "prov": {"confidence": "medium", "source_kind": "official", "observed_at": "2026-10-09"}}',
  -- The café's own point (OSM node 5170793551), inside the William Gates Building on the University map; Google's
  -- listing sits within metres of it. It replaces the building centroid.
  latitude = 52.210696, longitude = 0.0916353,
  location_source = 'https://www.openstreetmap.org/node/5170793551'
where id = 'west-cambridge/caffiend';

insert into service_slots (venue_id, site, venue, meal, days, start_time, end_time, period, note, prov) values
  ('west-cambridge/caffiend', 'west-cambridge', 'caffiend', 'snacks', '{mon,tue,wed,thu,fri}', '08:30', '16:00', 'all', 'OpenStreetMap, checked 2026-03-26',
   '{"confidence": "low", "source_kind": "reported", "observed_at": "2026-10-09"}');
