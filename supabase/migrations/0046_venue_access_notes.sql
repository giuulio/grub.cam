-- Confirmed public entry and guest requirements; reference data stays in Supabase.
alter table venues add column access_note text;
comment on column venues.access_note is 'Public entry and guest requirements, only where confirmed; no private correspondence or personal details.';

alter table venues drop constraint venues_menu_channel_check;
alter table venues add constraint venues_menu_channel_check check (menu_channel in ('html', 'json', 'pdf', 'sway', 'canva', 'app', 'email', 'intranet', 'instagram', 'none', 'unknown'));
