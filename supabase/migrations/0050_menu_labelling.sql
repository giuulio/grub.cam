-- Source labelling is separate from a dish's tags. Unlabelled never means not vegan.
alter table venues add column menu_labelling jsonb not null default '{"diet_codes":"unknown","allergens":"unknown"}';
alter table venues add constraint venues_menu_labelling_check check (
  jsonb_typeof(menu_labelling) = 'object' and menu_labelling ?& array['diet_codes','allergens'] and
  menu_labelling->>'diet_codes' in ('present','absent','mixed','unknown') and
  menu_labelling->>'allergens' in ('present','absent','mixed','unknown')
);
comment on column venues.menu_labelling is 'Verified source labelling: diet_codes/allergens present, absent, mixed or unknown; source_url, checked_on and note. Not the completeness of item classification.';
update venues set menu_labelling = jsonb_build_object(
  'diet_codes','absent','allergens','present','source_url','https://catering.emma.cam.ac.uk/',
  'checked_on','2026-11-04','note','Public display lists allergens. Diet wording appears in dish names, without a separate diet-code key.'
) where id = 'emmanuel/hall';
update venues set menu_labelling = jsonb_build_object(
  'diet_codes','absent','allergens','present','source_url','https://www.darwin.cam.ac.uk/dine/weekly-menu/',
  'checked_on','2026-11-04','note','Weekly tables list allergens; diet suitability is stated only in some dish names, without separate diet codes.'
) where id = 'darwin/servery';
update venues set menu_labelling = jsonb_build_object(
  'diet_codes','present','allergens','present','source_url','https://menu.joh.cam/',
  'checked_on','2026-11-04','note','Separate Vegan/Vegetarian/Halal badges and Contains rows. Not every dish has a diet badge.'
) where id = 'st-johns/buttery';
update venues set menu_labelling = jsonb_build_object(
  'diet_codes','unknown','allergens','present','source_url','https://www.homerton.cam.ac.uk/api/cafeteria-menu?weekOffset=0',
  'checked_on','2026-11-04','note','Feed exposes allergen arrays and dish wording; no separate diet field. Whether the original board uses diet codes consistently is unverified.'
) where id = 'homerton/dining-hall';
