-- A photo a college or photographer supplied for us to show: while it's the one shown, a member's photo of the same
-- venue or site waits for a person instead of replacing it on its own. The banner still asks for a better one.
alter table photos add column keep boolean not null default false;
comment on column photos.keep is 'While this is the photo shown, members'' photos of its venue or site wait for review (set by ingest:photo --keep).';
