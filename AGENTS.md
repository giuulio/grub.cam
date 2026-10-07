# Grub (grub.cam) — agent notes

Cambridge college menus, hours and access, live. Vite + React 19 + TypeScript + Tailwind 4 SPA reading Supabase (Postgres). **The database is the system of record**: colleges, venues, hours and menus live there, not in the repo. The repo holds code, migrations, and how each college publishes its menus.

## Commands

| Command | What |
|---|---|
| `npm run dev` | Vite dev server (needs `VITE_SUPABASE_*` in `.env`) |
| `npm run ingest -- [--only jesus,homerton] [--dry]` | Fetch every scripted source from today until a week comes back empty → Supabase |
| `npm run ingest:manual -- menu.txt [...] [--dry]` | Save hand-transcribed menus → Supabase (format at the top of `scripts/ingest/manual.ts`) |
| `npm test` | Vitest (time logic, filters) |
| `npm run typecheck` / `npm run lint` | `tsc -b` + scripts tsconfig / oxlint |
| `npm run build` | typecheck + Vite build → `dist/` |

`--dry` fetches and validates without writing. If ingest gets "fetch failed" for Magdalene locally, run with `NODE_USE_SYSTEM_CA=0` (keychain cross-signed certs break that chain).

## Layout

- `scripts/ingest/sources.ts` — **how each college publishes its menu**: one entry per venue (`venues.id` = `<college>/<venue>`), channel (html/json/pdf/sway/canva/app/email/intranet/none), URL, cadence, notes, and an `adapter` for the 11 scripted ones (`scripts/ingest/sources/*.ts`). Adapters must take dates from the source, never from the requested week.
- `scripts/schema.ts` — zod for `Dish` / `MenuDay`, checked before anything is saved; the app imports the types.
- `supabase/migrations/` — tables + RLS (anon SELECT only). Menus: `menu_days` (one per venue/date/service, upserted) → `menu_items` (dishes as printed, replaced per day) → `dishes` (one per college + `dish_key(name)`, tracked across weeks); `dish_stats` view; `ingest_runs` (one row per source per run; service role only). Writes go through `save_menu()` (service role only).
- `src/lib/data.tsx` — loads colleges/venues/slots and the next 7 days of menus. `src/lib/time/*` — Europe/London clock, Full Term dates, `openStatus()`; `src/lib/filters.ts` — ranking.
- `src/pages/*` — `/` search (query + filter chips in the URL: `q`, `open`, `meal`, `diet`, `guests`, `card`), `/:slug` college (anchors `#venue-slug`), `/about`, `*` 404. White on charcoal (`#1e1e1e`), minimal text; free-text DB fields (`notice`, `hours_text`, `access.text`, …) are research notes for editors and aren't shown.

## Menus

No projected menus: only what a source has published is saved, and sources are re-checked often instead (GitHub Actions runs `npm run ingest` at 05:15, 11:15 and 17:15 UTC; needs repo secrets `VITE_SUPABASE_URL` and `SUPABASE_SECRET_KEY`). Days already saved are kept; a day the source still lists is replaced with the latest version.

Hand-transcribed colleges (see `sources.ts`): open the URL (PDFs: `curl -A "Mozilla/5.0" … | pdftotext -layout - -`; Sway/Canva: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --dump-dom URL`), write a `.txt` outside the repo, `npm run ingest:manual -- file.txt`. Members-only colleges need a collaborator.

Reference data (hours, access, venues) is edited in the Supabase dashboard until there's an editor UI. Unknown hours ⇒ no slot (UI says "Hours not published", never "closed").

## Term dates

Michaelmas 2026 Full Term 6 Oct–4 Dec; Lent 2027 19 Jan–19 Mar; Easter 2027 27 Apr–18 Jun (`src/lib/time/termDates.ts`; Downing's adapter maps "WEEK n" through it). Update yearly from cam.ac.uk.

## Supabase

Project `grub` (ref `leghyhbkovkyipgoygko`, London `eu-west-2`, free tier), linked via `supabase link`. Keys in `.env` (see `.env.example`): `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (browser), `SUPABASE_SECRET_KEY` + `SUPABASE_DB_PASSWORD` (scripts/CLI only; `supabase projects api-keys --reveal` shows the secret key in full).

Schema change: add `supabase/migrations/NNNN_name.sql`, then `set -a && . ./.env && set +a && supabase db push`.

## Deploy

Static `dist/`. Cloudflare Pages: build `npm run build`, output `dist`, env `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`; SPA fallback via `public/_redirects`.
