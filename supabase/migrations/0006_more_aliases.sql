-- Nicknames in use by the colleges themselves or their students.

-- https://women50.st-edmunds.cam.ac.uk/eddies50/14-lily-bacon-fellow-commoner/
update sites set aliases = array['Eddies'] where slug = 'st-edmunds';
-- https://www.murrayedwards.cam.ac.uk/subject/medicine; New Hall until 2008: https://murrayedwards.cam.ac.uk/about-us/history
update sites set aliases = array['Medwards', 'New Hall'] where slug = 'murray-edwards';
-- https://en.wikipedia.org/wiki/Trinity_Hall,_Cambridge
update sites set aliases = array['Tit Hall'] where slug = 'trinity-hall';
