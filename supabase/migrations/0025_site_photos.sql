-- Photos of sites too, 9 October 2026: a college or University site has a picture for the directory and its page, the
-- way every venue does. One table, `photos`, with the subject in one of two columns: `venue_id` or `site`. Files keep
-- the same scheme (`<site>/<venue>/<id>` for a venue, `<site>/<id>` for a site). Everything else is as in 0018.
alter table venue_photos rename to photos;
alter table photos alter column venue_id drop not null;
alter table photos add column site text references sites(slug) on delete cascade;
alter table photos add constraint photos_one_subject check ((venue_id is null) <> (site is null));
alter table photos add constraint photos_site_kind check (site is null or kind = 'venue'); -- a site's photo shows the site
create index photos_site_idx on photos(site, position);
alter index venue_photos_venue_idx rename to photos_venue_idx;
alter policy "public read approved venue_photos" on photos rename to "public read approved photos";
comment on table photos is 'Photos of venues (and of their menu boards, kept as sources) and of sites; only approved rows are public.';
