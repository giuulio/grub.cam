-- No uploads without signing in: invited groups send their files to Giulio, who uploads them. Takes out 0051.
drop function if exists claim_upload_invite(text, text);
alter table submissions drop column if exists upload_invite_id;
drop table if exists upload_invites;
