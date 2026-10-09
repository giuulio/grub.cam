-- College venues placed on the building that contains them, 9 October 2026: University map building centroids
-- (as in 0013), each with a public source tying the venue to that building. Where the source is OpenStreetMap, the
-- OSM point for the venue lies inside that building's outline on the University map, so the two maps agree; the
-- building's own name is often blank on the University map (college ranges such as First Court are unnamed).
-- Still unmapped (no named building, or no source placing the venue in one): most cafeterias, butteries and bars in
-- the older courts, and every Robinson, Queens', Trinity Hall, St Catharine's, Clare Hall and Lucy Cavendish venue.
with locations(id, latitude, longitude, object_id) as (values
  -- christs/upper-hall: building 790 (unnamed); OSM node 13240602369 "Upper Hall" lies inside it
  ('christs/upper-hall', 52.20561029, 0.12266484, 790),
  -- churchill/buttery: building 152 (unnamed, central building); OSM node 13237755599 "Churchill College Buttery" lies inside it
  ('churchill/buttery', 52.21300845, 0.10333008, 152),
  -- clare/cellars: Clare College Chapel; "set in the atmospheric crypt under the Chapel": https://ucs.clare.cam.ac.uk/applying-to-clare/why-clare/
  ('clare/cellars', 52.20530789, 0.11573824, 733),
  -- corpus-christi Leckhampton: Leckhampton House; College site plan: "LECKHAMPTON HOUSE (Hall, Bar, Post Room, TV Room)": https://www.corpus.cam.ac.uk/sites/default/files/downloads/leckhampton_0.pdf
  ('corpus-christi/leckhampton-dining-hall', 52.20148384, 0.10128362, 882),
  ('corpus-christi/leckhampton-bar', 52.20148384, 0.10128362, 882),
  -- jesus/the-roost: West Court; "A new café pavilion and basement bar extends the building's north elevation": https://www.niallmclaughlin.com/news/jesus-college-planning-approval/
  ('jesus/the-roost', 52.20889555, 0.12124079, 1396),
  -- kings/college-bar: Wilkins Building; OSM node 9678576398 "King's College Bar" lies inside it
  ('kings/college-bar', 52.20384494, 0.11657350, 1236),
  -- murray-edwards/art-cafe: building 971 (unnamed); OSM node 14122711753 "Art Cafe" lies inside it
  ('murray-edwards/art-cafe', 52.21419432, 0.10861017, 971),
  -- st-johns bar and café: Buttery; built with the buttery dining room as one set of social spaces in Second Court
  -- ("a new bar and a completely reconstructed buttery dining room alongside … the college's first-ever café"):
  -- https://www.bdonline.co.uk/news/mcw-architects-completes-new-buttery-at-st-johns-college-cambridge/5124395.article
  ('st-johns/bar', 52.20781278, 0.11666422, 1065),
  ('st-johns/cafe', 52.20781278, 0.11666422, 1065)
)
update venues v set latitude = l.latitude, longitude = l.longitude,
  location_source = 'https://services8.arcgis.com/2Y48LoJE8kVvjD5n/arcgis/rest/services/UoCUniMapBuildingsGroup_View/FeatureServer/14/query?f=pjson&outFields=*&objectIds=' || l.object_id::text
from locations l where v.id = l.id;
