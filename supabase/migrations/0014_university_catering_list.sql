-- University venues checked against the University Catering list (catering.admin.cam.ac.uk/cafes), 9 Oct 2026.
-- 24 entries; all but ADC Bar were already here, and every catering page we link to is the one the list resolves to
-- (its /food-and-drink/places-eat/out-university-centre/... links redirect to /cafes/...). Two entries are mislabelled
-- there: "Footprint Cafés (Old Addenbrooke's Site)" links to a dead Judge Business School page about a social venture
-- in Cambodia (our old-addenbrookes/judge-cafe stays unlinked), and "Ground Café (Downing Site)" is at the Clinical
-- School on Hills Road, as its own page says.

-- ADC Bar: the University's ADC Theatre. Opens around performances only, so no fixed hours (no slot). Wikipedia says
-- from 45 minutes before the show; not on the theatre's page.
insert into sites (slug, name, short_name, kind, official_dining_url, reviewed) values
  ('adc-theatre', 'ADC Theatre', null, 'university', 'https://www.catering.admin.cam.ac.uk/cafes', '2026-10-09');

insert into venues (id, site, slug, name, type, where_text, serves, hours_text, url, access, payment, dietary, aliases, sort_order,
  latitude, longitude, location_source)
values ('adc-theatre/bar', 'adc-theatre', 'bar', 'Bar', 'bar', 'Park Street, off Jesus Lane',
  'wines, beers and ciders on tap, spirits, soft drinks, snacks, a show cocktail each season; Dann''s Farm ice cream in the interval',
  'before the show and in the interval; no fixed hours published (official). Reported: opens 45 minutes before the show [Wikipedia]',
  'https://www.adctheatre.com/your-visit/adc-bar/',
  '{"level": "unknown", "text": "theatre audiences, before the show and in the interval (official)", "prov": {"confidence": "medium", "source_kind": "official", "observed_at": "2026-10-09", "source_url": "https://www.adctheatre.com/your-visit/adc-bar/"}}',
  '{"prov": {"confidence": "low", "source_kind": "unknown"}}',
  '{"tags": [], "prov": {"confidence": "low", "source_kind": "unknown"}}',
  array['ADC Bar'], 0,
  -- ADC Theatre (K011), building centroid on the University map
  52.20847199, 0.11984573,
  'https://services8.arcgis.com/2Y48LoJE8kVvjD5n/arcgis/rest/services/UoCUniMapBuildingsGroup_View/FeatureServer/14/query?f=pjson&outFields=*&objectIds=935');

-- The University Catering list is the official directory for every site on it: link the current address, not the
-- old one that redirects to it. Chemistry's Cybercafé isn't on the list.
update sites set official_dining_url = 'https://www.catering.admin.cam.ac.uk/cafes', reviewed = '2026-10-09'
where kind = 'university' and slug <> 'chemistry';

-- Names the venues go by on their own pages and the University map, for search.
update venues set aliases = array['Garden Kitchen'] where id = 'botanic-garden/garden-cafe'; -- "Garden Kitchen at The Botanic Garden" (operator's menu)
update venues set aliases = array['West Café'] where id = 'west-cambridge/scholars-brew'; -- "formerly the West Café"
update venues set aliases = array['Ray Dolby Centre Café'] where id = 'west-cambridge/cavendish-cafe'; -- Cambridge Dining Co.'s page
update venues set aliases = array['Sports Centre Café'] where id = 'west-cambridge/blue-and-brew'; -- University map
update venues set aliases = array['Clinical School Café'] where id = 'biomedical-campus/ground-cafe'; -- CMS café page, University map
update venues set aliases = array['Jeffrey Cheah Biomedical Centre Café'] where id = 'biomedical-campus/jcbc-cafe';
update venues set aliases = array['Cancer Research UK Café'] where id = 'biomedical-campus/cruk-cafe';
