-- Map locations verified against the University of Cambridge's public map, 8 October 2026.
-- Cafe points identify the venue; building points identify the building named in the venue's
-- published location. No college/site centroids, guessed rooms or projected locations.
-- Remaining venues stay discoverable in Results and the directories until verified.
alter table venues
  add column latitude double precision,
  add column longitude double precision,
  add column location_source text,
  add constraint venues_location_pair check ((latitude is null) = (longitude is null)),
  add constraint venues_latitude_range check (latitude between -90 and 90),
  add constraint venues_longitude_range check (longitude between -180 and 180);

comment on column venues.location_source is 'Public source verifying the venue or its containing building; update alongside coordinates.';

with locations(id, latitude, longitude, object_id) as (values
  -- Cancer Research UK Café (University map object 17)
  ('biomedical-campus/cruk-cafe', 52.17690360, 0.13548694, 17),
  -- School of Clinical Medicine office Cafe (University map object 29)
  ('biomedical-campus/ground-cafe', 52.17597240, 0.14183468, 29),
  -- Garden Cafe (University map object 8)
  ('botanic-garden/garden-cafe', 52.19408800, 0.12820200, 8),
  -- River Room Cafe (University map object 34)
  ('clare/river-room', 52.20535708, 0.11449998, 34),
  -- Mathematical Sciences Cafe (University map object 11)
  ('cms/cafe', 52.21017100, 0.10187300, 11),
  -- Department of Pathology Cafe (University map object 20)
  ('downing-site/pathology-cafe', 52.20127657, 0.12180493, 20),
  -- The Courtyard Kitchen (University map object 21)
  ('fitzwilliam-museum/courtyard-kitchen', 52.20005184, 0.11958252, 21),
  -- Harvey's Cafe (University map object 26)
  ('gonville-and-caius/florey-cafe', 52.20263716, 0.11087775, 26),
  -- Kettle’s Yard (University map object 25)
  ('kettles-yard/garden-kitchen', 52.21092651, 0.11457162, 25),
  -- Whale Cafe (University map object 16)
  ('new-museums/whale-cafe', 52.20336600, 0.12045500, 16),
  -- Zest Cafe (University map object 24)
  ('old-addenbrookes/zest-cafe', 52.19854897, 0.12329846, 24),
  -- Café bar (University map object 32)
  ('selwyn/cafe-bar', 52.20074420, 0.10571959, 32),
  -- Servery (University map object 33)
  ('selwyn/hall-servery', 52.20071973, 0.10634018, 33),
  -- ARC Cafe (University map object 1)
  ('sidgwick/arc-cafe', 52.20225200, 0.10915200, 1),
  -- The Buttery (University map object 2)
  ('sidgwick/the-buttery', 52.20090000, 0.10851200, 2),
  -- Aristocaters Cafe (University map object 18)
  ('west-cambridge/aristocaters-cafe', 52.21026711, 0.09336549, 18),
  -- University of Cambridge Sports Centre Café (University map object 27)
  ('west-cambridge/blue-and-brew', 52.20842612, 0.08554552, 27),
  -- Department of Chemical Engineering and Biotechnology (CEB) Cafe (University map object 19)
  ('west-cambridge/ceb-cafe', 52.20915697, 0.08576009, 19),
  -- Greenwich House Cafe (University map object 10)
  ('west-cambridge/greenwich-house-cafe', 52.21524100, 0.09575400, 10),
  -- Occidente (University map object 36)
  ('west-cambridge/occidente', 52.21038756, 0.09018495, 36),
  -- Scholars Brew Cafe (University map object 14)
  ('west-cambridge/scholars-brew', 52.20887100, 0.09007900, 14),
  -- The Servery (University map object 23)
  ('west-cambridge/the-servery', 52.20928363, 0.08729935, 23),
  -- West Hub Canteen (University map object 15)
  ('west-cambridge/west-hub-canteen', 52.21031900, 0.08979700, 15)
)
update venues v set latitude = l.latitude, longitude = l.longitude,
  location_source = 'https://services8.arcgis.com/2Y48LoJE8kVvjD5n/arcgis/rest/services/UoCUniMapCafes_View/FeatureServer/3/query?f=pjson&outFields=*&objectIds=' || l.object_id::text
from locations l where v.id = l.id;

with locations(id, latitude, longitude, object_id) as (values
  -- Jeffrey Cheah Biomedical Centre (H146) (University map object 1501)
  ('biomedical-campus/jcbc-cafe', 52.17678523, 0.13668667, 1501),
  -- Yusuf Hamied Department of Chemistry (L010) (University map object 351)
  ('chemistry/cybercafe', 52.19792664, 0.12574142, 351),
  -- Hall (University map object 803)
  ('christs/hall', 52.20552253, 0.12256267, 803),
  -- The Hermitage (University map object 168)
  ('darwin/cafe', 52.20063141, 0.11345066, 168),
  -- The Hermitage (University map object 168)
  ('darwin/darbar', 52.20063141, 0.11345066, 168),
  -- The Hermitage (University map object 168)
  ('darwin/servery', 52.20063141, 0.11345066, 168),
  -- Butterfield Cafe (University map object 28)
  ('downing/lord-butterfield', 52.20168590, 0.12413048, 28),
  -- Dining Hall (University map object 452)
  ('downing/servery-great-hall', 52.19983663, 0.12368324, 452),
  -- Fiona's Cafe (University map object 1919)
  ('emmanuel/fionas', 52.20309262, 0.12474649, 1919),
  -- Hall (University map object 1140)
  ('emmanuel/hall', 52.20389296, 0.12389287, 1140),
  -- Hall (University map object 983)
  ('fitzwilliam/buttery', 52.21545189, 0.10596807, 983),
  -- Main Hall (University map object 1011)
  ('girton/hall-cafeteria', 52.22880203, 0.08424140, 1011),
  -- Master's Lodge, Hall and Buttery (University map object 607)
  ('gonville-and-caius/hall', 52.20614998, 0.11667733, 607),
  -- dining hall (University map object 1541)
  ('homerton/dining-hall', 52.18577259, 0.13443527, 1541),
  -- Fenners Building (Hughes Hall) (University map object 229)
  ('hughes-hall/fenners-dining-hall', 52.20073826, 0.13138481, 229),
  -- Hall (University map object 1098)
  ('jesus/hall', 52.20932706, 0.12389121, 1098),
  -- Warburton Hall (University map object 373)
  ('lucy-cavendish/warburton-hall-servery', 52.21148924, 0.10947068, 373),
  -- Madingley Hall (F096) (University map object 546)
  ('madingley-hall/cafe', 52.22487873, 0.03741557, 546),
  -- Hall (University map object 651)
  ('magdalene/hall', 52.21047550, 0.11650643, 651),
  -- Ramsay Hall (Bright's Building) (University map object 133)
  ('magdalene/ramsay-hall', 52.21036406, 0.11684745, 133),
  -- Buttery (University map object 1087)
  ('newnham/buttery', 52.20036016, 0.10731566, 1087),
  -- Clough Hall (University map object 347)
  ('newnham/clough-hall', 52.20022230, 0.10700413, 347),
  -- Dorothy Garrod Building (University map object 1498)
  ('newnham/iris-bar', 52.20022623, 0.10874148, 1498),
  -- Dorothy Garrod Building (University map object 1498)
  ('newnham/iris-cafe', 52.20022623, 0.10874148, 1498),
  -- Cambridge Judge Business School & Simon Sainsbury Centre (E052) (University map object 231)
  ('old-addenbrookes/judge-cafe', 52.20013677, 0.12185857, 231),
  -- Milstein House (University map object 1551)
  ('pembroke/cafe-84', 52.20147177, 0.11755391, 1551),
  -- Hall and Buttery (University map object 587)
  ('pembroke/hall', 52.20189440, 0.11884925, 587),
  -- Hall and Buttery (University map object 587)
  ('pembroke/servery-trough', 52.20189440, 0.11884925, 587),
  -- Servery, Hall and Combination Room (University map object 1015)
  ('peterhouse/hall-servery', 52.20079872, 0.11857107, 1015),
  -- Whittle Building (University map object 1397)
  ('peterhouse/whittle-building-bar', 52.20052700, 0.11740272, 1397),
  -- JCR Bar (University map object 775)
  ('sidney-sussex/college-bar', 52.20756554, 0.12136665, 775),
  -- McGrath Centre (University map object 1037)
  ('st-catharines/bar', 52.20336795, 0.11677753, 1037),
  -- The Norfolk Building (University map object 240)
  ('st-edmunds/eddies-bar', 52.21292827, 0.10931800, 240),
  -- Buttery (University map object 1065)
  ('st-johns/buttery', 52.20781278, 0.11666422, 1065),
  -- Hall (University map object 1052)
  ('st-johns/hall', 52.20813535, 0.11724710, 1052),
  -- The Bar (University map object 1506)
  ('trinity/bar', 52.20666203, 0.11767020, 1506),
  -- The Hall (University map object 1310)
  ('trinity/hall-servery', 52.20694425, 0.11613061, 1310),
  -- Cavendish Laboratory (Ray Dolby Centre) (W147) (University map object 1884)
  ('west-cambridge/cavendish-cafe', 52.21160318, 0.09072733, 1884),
  -- West Hub (W152) (University map object 1542)
  ('west-cambridge/west-hub-coffee-bar', 52.21032595, 0.08980058, 1542),
  -- Department of Computer Science and Technology (William Gates Building) (W046) (University map object 4)
  ('west-cambridge/wgb-cafe', 52.21091735, 0.09197648, 4),
  -- Dining Hall, Gallery & Club Room (University map object 138)
  ('wolfson/buttery-dining-hall', 52.19870971, 0.10101749, 138),
  -- Dining Hall, Gallery & Club Room (University map object 138)
  ('wolfson/the-den', 52.19870971, 0.10101749, 138)
)
update venues v set latitude = l.latitude, longitude = l.longitude,
  location_source = 'https://services8.arcgis.com/2Y48LoJE8kVvjD5n/arcgis/rest/services/UoCUniMapBuildingsGroup_View/FeatureServer/14/query?f=pjson&outFields=*&objectIds=' || l.object_id::text
from locations l where v.id = l.id;
