-- Further verified containing-building points, 8 October 2026.
-- These identify the building, not an entrance or a college/site centroid.
with locations(id, latitude, longitude, object_id) as (values
  -- jesus/caff: Hall; venue/building association: https://www.jesus.cam.ac.uk/college/life-jesus/accessibility/hall
  ('jesus/caff', 52.20932706, 0.12389121, 1098),
  -- kings/servery-dining-hall: Wilkins Building; venue/building association: https://www.kings.cam.ac.uk/sites/default/files/documents/study/kings-self-guided-tour.pdf
  ('kings/servery-dining-hall', 52.20384494, 0.11657350, 1236),
  -- university-library/tea-room: Cambridge University Library (S022); venue/building association: https://www.catering.admin.cam.ac.uk/cafes/university-library-tea-room
  ('university-library/tea-room', 52.20507721, 0.10774715, 8)
)
update venues v set latitude = l.latitude, longitude = l.longitude,
  location_source = 'https://services8.arcgis.com/2Y48LoJE8kVvjD5n/arcgis/rest/services/UoCUniMapBuildingsGroup_View/FeatureServer/14/query?f=pjson&outFields=*&objectIds=' || l.object_id::text
from locations l where v.id = l.id;
