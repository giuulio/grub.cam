-- The 32 college venues still without a location, 9 October 2026, placed on the building that contains them: University
-- map building centroids (as in 0013 and 0015), each with a public source tying the venue to that building. Where the
-- University map building is unnamed the comment names the range; OSM points (named nodes or ways) that lie inside the
-- same outline are given as corroboration. One venue (Lucy Cavendish's café/bar) is in a 2022 building the University map
-- does not have yet, so its point is the OpenStreetMap building outline instead.
-- Still open: Robinson's cafeteria service is being run from the Crausaz Wordsworth Building this term (menu page retitled,
-- see venues.where_text); the pin stays on the Garden Restaurant itself in the main building.
with locations(id, latitude, longitude, object_id) as (values
  -- christs/buttery: First Court south and east ranges (unnamed, CHRISTS010); College map marks "Buttery Bar" at G staircase on
  -- the east side, south of the Hall screens: https://www.christs.cam.ac.uk/sites/default/files/inline-files/A-2025-College-map_7.pdf;
  -- "In First Court ... the Buttery": https://www.christs.cam.ac.uk/facilities/buttery
  ('christs/buttery', 52.20510832, 0.12225630, 788),
  -- churchill/dining-hall: the central building (unnamed, CHU011), already holding the Buttery (0015); "a central building
  -- consisting of the dining hall, buttery, combination rooms and offices": https://en.wikipedia.org/wiki/Churchill_College,_Cambridge;
  -- Historic England DP100730 "steps to the dining hall in the central building"
  ('churchill/dining-hall', 52.21300845, 0.10333008, 152),
  -- clare/hall and clare/buttery: Old Court north range (unnamed, CLARE013), between the Chapel and the river; "the Buttery
  -- (the canteen) ... underneath the Great Hall in Old Court": https://ucs.clare.cam.ac.uk/applying-to-clare/why-clare/;
  -- "a new lift servicing three levels of the North Range of Old Court ... the Hall": https://stories.clare.cam.ac.uk/the-campaign-for-old-court/
  ('clare/hall', 52.20527983, 0.11515121, 732),
  ('clare/buttery', 52.20527983, 0.11515121, 732),
  -- clare-hall/dining-hall and clare-hall/college-bar: east wing of the main (Erskine) building (unnamed, CLAREHALL010; OSM node
  -- 4411248840 "Clare Hall" lies inside it). "The Dining Hall is located centrally within Main Site, bounded by the Common Room,
  -- College Bar, and Fellows' Garden": https://www.clarehall.cam.ac.uk/suites-rooms/; the College Bar is the Common Room bar
  -- ("a bar in the Common Room which is open after Formal Hall and at weekends": https://www.clarehall.cam.ac.uk/social/),
  -- distinct from the students' ALB Bar in the Anthony Low Building.
  ('clare-hall/dining-hall', 52.20397047, 0.10451289, 16),
  ('clare-hall/college-bar', 52.20397047, 0.10451289, 16),
  -- corpus-christi/cafeteria: the Dining Hall, New Court north range (unnamed, CORPUS015; OSM nodes 1619379290/1619379291 "Hall"
  -- sit on its edges); "By day, this space operates in a relaxed, cafeteria style": https://www.corpus.cam.ac.uk/dining-hall
  ('corpus-christi/cafeteria', 52.20318182, 0.11805642, 897),
  -- corpus-christi/pelican-bar: beneath Kwee Court, built with the Taylor Library (unnamed, CORPUS021; OSM way 148880401
  -- "Taylor Library" lies inside it) and entered down the steps in front of it: https://www.corpus.cam.ac.uk/kwee-court;
  -- "The new Pelican Bar and café sit below the newly formed court" (The Pelican, Easter 2008)
  ('corpus-christi/pelican-bar', 52.20370817, 0.11780499, 903),
  -- emmanuel/bar: Furness Lodge (unnamed, EMMA; OSM way 161131068 "Furness Lodge" lies inside it); "the refurbishment and
  -- extension of the Grade II listed Furness Lodge ... including ... a new student bar":
  -- https://architecturetoday.co.uk/youngs-court-emmanuel-college-stanton-williams-cambridge-university/
  ('emmanuel/bar', 52.20284435, 0.12581353, 1915),
  -- fitzwilliam/coffee-shop: the Central Building (University map "Hall"); "The cafe (located in the main college building)":
  -- https://mcr.fitz.cam.ac.uk/faq/coffee-shop-bar/; Buttery and JCR "located in the Central Building": https://www.fitz.cam.ac.uk/social-spaces
  ('fitzwilliam/coffee-shop', 52.21545189, 0.10596807, 983),
  -- girton/social-hub: the range closing the north-west end of Cloister Court (University map "Old Hall", GIRTON012), which joins
  -- the Tower Wing to the Cloister corridor; "located between the Tower Wing and Cloister Corridor on the ground floor", entrance
  -- "located off Cloister Court": https://www.accessable.co.uk/girton-college/access-guides/social-hub
  ('girton/social-hub', 52.22886380, 0.08339072, 993),
  -- gonville-and-caius/old-courts-cafe-bar: Master's Lodge, Hall and Buttery; "located right in the Old Courts, just downstairs
  -- from the Hall": https://www.cai.cam.ac.uk/living-here/food-and-drink/bar-and-cafe
  ('gonville-and-caius/old-courts-cafe-bar', 52.20614998, 0.11667733, 607),
  -- homerton/buttery: the 2022 dining hall; "comprises a dining hall, buttery, kitchens": https://www.feildenfowles.co.uk/projects/homerton-dining-hall/;
  -- "The Buttery is situated next to the Dining Hall": https://www.homerton.cam.ac.uk/catering
  ('homerton/buttery', 52.18577259, 0.13443527, 1541),
  -- homerton/griffin-bar: Cavendish Building, the block west of the Great Hall (HOMERTON; the site plan puts the Griffin Door
  -- between the Great Hall and the new dining hall); "Location: Ground Floor, Cavendish Building ... connected by double doors
  -- to the Great Hall": https://www.homerton.cam.ac.uk/homerton-conferences-and-events/dining/griffin-bar
  ('homerton/griffin-bar', 52.18602989, 0.13531713, 825),
  -- hughes-hall/mcr-clubroom: Margaret Wileman Building; "contains ... the MCR bar on the ground floor":
  -- https://www.hughes.cam.ac.uk/contact/disability-and-access/
  ('hughes-hall/mcr-clubroom', 52.20073538, 0.13331951, 496),
  -- kings/coffee-shop: Scott's Building, King's Parade range on Chetwynd Court (KINGS014.2); the students' union map labels
  -- "Coffee Shop/Conference office" there: https://www.kcsu.org.uk/documents/college_map.pdf; the Servery and Coffee Shop "are
  -- wrapped around the Chetwynd Court": https://www.universityrooms.com/en-GB/city/cambridge/college/kingscollege
  ('kings/coffee-shop', 52.20379377, 0.11726972, 1248),
  -- magdalene/college-bar: First Court south range (unnamed, MAGD010; OSM node 1512859733 "C" sits at its door); "the entrance to
  -- the Bar is located in First Court C staircase ... on the ground floor": https://www.magd.cam.ac.uk/college-life/building-accessibility/bar;
  -- College map lists the College Bar under C staircase: https://www.magd.cam.ac.uk/sites/default/files/2025-05/magdalene_college_map.pdf
  ('magdalene/college-bar', 52.21012755, 0.11620225, 654),
  -- murray-edwards/dome-dining-hall: the range east of Fountain Court (unnamed, MURRAYEDWARDS012); the listing describes "the
  -- smaller [court] with hall to east and library to west", the hall "roofed by dome of eight leaves":
  -- https://britishlistedbuildings.co.uk/101331922-murray-edwards-college-formerly-new-hall-cambridge-castle-ward
  ('murray-edwards/dome-dining-hall', 52.21441809, 0.10846127, 254),
  -- pembroke/old-lodge-bar: the range on Pembroke Street holding N staircase (University map "Chimney Court", PEM019; OSM node
  -- 1498617948 "N" lies inside it); "The Old Lodge Bar is housed within the JP", "a large physical space on N-Staircase":
  -- https://jp.pem.cam.ac.uk/the-jp-bar/
  ('pembroke/old-lodge-bar', 52.20227859, 0.11960994, 6),
  -- queens/cripps-dining-hall-cafeteria and queens/qbar: Cripps Court (unnamed, QUEENS011; OSM nodes 924039023 "Cripps" and
  -- 1613188615 "EE" lie inside it); "The College main catering facilities are located in Cripps Court", "The College bar is located
  -- on the ground floor of EE staircase in Cripps Court": https://www.queens.cam.ac.uk/download/student-handbook/
  ('queens/cripps-dining-hall-cafeteria', 52.20183104, 0.11400020, 9),
  ('queens/qbar', 52.20183104, 0.11400020, 9),
  -- queens/old-hall: Old Court west range (unnamed, QUEENS016; OSM node 1613188340 "Hall" lies inside it); "Old Hall, Old Court":
  -- https://www.queens.cam.ac.uk/download/student-handbook/
  ('queens/old-hall', 52.20227882, 0.11575813, 840),
  -- robinson: the main College building (unnamed, ROBINSON010), one outline for the whole range; OSM nodes 1569307323 "Dining Hall"
  -- and 1569307402 "Red Brick Café" lie inside it; the Garden Restaurant is below the JCR and bar on the garden side, lifts on
  -- K and Q staircases reach "the lower ground level (Dining Hall and Garden Restaurant)": https://www.robinson.cam.ac.uk/room-information;
  -- Red Brick "on Long Court between the Dining Room and the JCR": https://www.robinson.cam.ac.uk/college-life/red-brick-cafe-bar
  ('robinson/dining-hall', 52.20478927, 0.10518583, 53),
  ('robinson/garden-restaurant', 52.20478927, 0.10518583, 53),
  ('robinson/red-brick', 52.20478927, 0.10518583, 53),
  -- sidney-sussex/servery-dining-hall: the Hall (University map "Hall Court", SID012; OSM way 147456503 lies inside it); "The Dining
  -- Hall is located off Hall Court, which is to the left of the Porters' Lodge entrance":
  -- https://www.accessable.co.uk/sidney-sussex-college/access-guides/dining-hall
  ('sidney-sussex/servery-dining-hall', 52.20748409, 0.12028988, 773),
  -- st-catharines/hall-cafeteria: Main Court west range (unnamed, CATHS015; OSM way 157588876 "Dining Hall" lies inside it);
  -- "the self-service cafeteria in the College Hall": https://www.caths.cam.ac.uk/students/accommodation-resources/undergraduate-accommodation
  ('st-catharines/hall-cafeteria', 52.20314423, 0.11650974, 1034),
  -- st-edmunds/dining-hall and st-edmunds/edspresso: The Norfolk Building, already holding Eddie's Bar (0012); "Our traditional
  -- style main Dining Hall is situated in the Norfolk Building": https://www.st-edmunds.cam.ac.uk/conferences-events/rooms-and-facilities/;
  -- Edspresso "Located in the Norfolk Building, just past the main Reception and turn right":
  -- https://applying.st-edmunds.cam.ac.uk/living-at-st-edmunds/dining-hall-and-cafe/
  ('st-edmunds/dining-hall', 52.21292827, 0.10931800, 240),
  ('st-edmunds/edspresso', 52.21292827, 0.10931800, 240),
  -- trinity-hall/aula: North Court north range (unnamed, TRINH016; OSM node 1772727845 "Aula Bar, Crescent Room" lies inside it);
  -- "the Coffee Shop and Aula Bar in North Court": https://www.trinhall.cam.ac.uk/alumni/alumni-benefits/
  ('trinity-hall/aula', 52.20603822, 0.11596783, 1273),
  -- trinity-hall/cafeteria: the Dining Hall, Front Court west range (unnamed, TRINH014; OSM node 1772727860 "Hall" lies inside it);
  -- "Food is served in the Cafeteria and eaten in the Dining Hall": https://www.trinhall.cam.ac.uk/wp-content/uploads/2023/08/TH_College_Prospectus_2020.pdf
  ('trinity-hall/cafeteria', 52.20571065, 0.11549405, 1271)
)
update venues v set latitude = l.latitude, longitude = l.longitude,
  location_source = 'https://services8.arcgis.com/2Y48LoJE8kVvjD5n/arcgis/rest/services/UoCUniMapBuildingsGroup_View/FeatureServer/14/query?f=pjson&outFields=*&objectIds=' || l.object_id::text
from locations l where v.id = l.id;

-- lucy-cavendish/cafe-bar: "The Café in the new build": https://www.lucy.cam.ac.uk/dining-hall-and-cafe; the New Building (opened
-- 2022, Lady Margaret Road) is not on the University map, so the point is the centroid of its OpenStreetMap outline, way 1302867822
-- "The New Building", operator Lucy Cavendish College.
update venues set latitude = 52.2111956, longitude = 0.1095241,
  location_source = 'https://www.openstreetmap.org/way/1302867822'
where id = 'lucy-cavendish/cafe-bar';
