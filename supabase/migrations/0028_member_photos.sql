-- Members' photos of a venue, 11 October 2026: a signed-in Cambridge member sends a better photo from the venue's page
-- ("Have a better photo?") and it replaces the one shown without waiting for a person. The `submit` function has a
-- model check it (a real photo of the venue, no recognisable faces, nothing unsuitable) and write its alt text; one
-- that passes is `queued`, and the photos Action (.github/workflows/photos.yml, started by the function) makes its
-- sizes, commits them to public/photos, adds it to `photos` ahead of the venue's others and marks it `approved`. One
-- that doesn't pass, or arrives when no model can look, waits for a person (`needs_review`) as anything else does.
-- `npm run submissions -- reject <id>` takes a published one down again, and the photo before it comes back.

alter table submissions drop constraint submissions_status_check;
alter table submissions add constraint submissions_status_check check (status in ('received', 'transcribed', 'needs_review', 'queued', 'approved', 'rejected'));

-- What a photo goes up with: the sender's name as their Cambridge account gives it (shown over the photo), and the
-- model's description of it (its alt text).
alter table submissions
  add column credit text,
  add column alt text;
comment on column submissions.credit is 'kind photo: the name it is credited to, from the sender''s Cambridge account';

-- Which submission a photo came from, so it can be credited as a member's and taken down with its submission. Public
-- like the rest of an approved photo's row; the submission itself (who sent it) is not.
alter table photos add column submission_id uuid references submissions(id) on delete set null;
create index photos_submission_idx on photos(submission_id) where submission_id is not null;
