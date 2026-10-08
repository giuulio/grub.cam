-- Reference data stays in Supabase; editors can extend these without a frontend release.
alter table sites add column aliases text[] not null default '{}';
alter table venues add column aliases text[] not null default '{}';

-- https://www.undergraduate.study.cam.ac.uk/colleges/st-catharines-college
update sites set aliases = array['Catz'] where slug = 'st-catharines';
-- https://www.emma.cam.ac.uk/about/jobs/nonacademic/
update sites set aliases = array['Emma'] where slug = 'emmanuel';
-- https://mcr.fitz.cam.ac.uk/faq/cycling-buy-bikes/
update sites set aliases = array['Fitz'] where slug = 'fitzwilliam';
