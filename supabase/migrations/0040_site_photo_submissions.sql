-- A better photo of a site, 13 October 2026: the banner on a college's or University site's page can be replaced by a
-- member's photo, as a venue's can since 0028 ("Have a better photo?" on the banner). Such a submission is about the
-- site (`site`) and no venue, and only a photo can be. The photos Action publishes it as a site's photo (`photos.site`,
-- 0025), credited to the sender.

alter table submissions alter column venue_id drop not null;
alter table submissions add column site text references sites(slug) on delete cascade;
alter table submissions add constraint submissions_one_subject check ((venue_id is null) <> (site is null));
alter table submissions add constraint submissions_site_photo check (site is null or kind = 'photo');
create index submissions_site_idx on submissions(site, created_at desc) where site is not null;
comment on column submissions.site is 'kind photo of a site itself, for its page''s banner: the site, and no venue';

-- The leaderboard and "Just added" name the site where a contribution has no venue
create or replace view contributions with (security_invoker = false) as
  select s.id, s.venue_id, s.kind, s.topic, s.date, s.service, s.credit as author, md5(s.user_id::text) as member,
         s.created_at, coalesce(s.reviewed_at, s.created_at) as published_at, s.site
  from submissions s
  where s.status = 'approved' and s.credit is not null and s.user_id is not null;
