-- Colleges' own short codes, their web domains, which students search with ("pet menu", "trin menu",
-- "chu menu", "sel menu" in Search Console, Oct 2026).

-- https://www.pet.cam.ac.uk
update sites set aliases = array_append(aliases, 'Pet') where slug = 'peterhouse' and not 'Pet' = any(aliases);
-- https://www.trin.cam.ac.uk
update sites set aliases = array_append(aliases, 'Trin') where slug = 'trinity' and not 'Trin' = any(aliases);
-- https://www.chu.cam.ac.uk
update sites set aliases = array_append(aliases, 'Chu') where slug = 'churchill' and not 'Chu' = any(aliases);
-- https://www.sel.cam.ac.uk
update sites set aliases = array_append(aliases, 'Sel') where slug = 'selwyn' and not 'Sel' = any(aliases);
