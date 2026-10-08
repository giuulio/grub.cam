-- How each venue publishes its menu, so the app can say which menus are missing and why.
-- Copied from scripts/ingest/sources.ts on every ingest run; edit it there, not in the dashboard.

alter table venues
  add column menu_channel text check (menu_channel in ('html', 'json', 'pdf', 'sway', 'canva', 'app', 'email', 'intranet', 'none', 'unknown')),
  add column menu_url text,                               -- where the published menu is, when it's public
  add column menu_scripted boolean not null default false; -- fetched by `npm run ingest` (else transcribed by hand, or not at all)
