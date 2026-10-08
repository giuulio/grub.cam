# Grub (grub.cam) — agent notes

Cambridge college and University menus, hours and access, live. Vite + React 19 + TypeScript + Tailwind 4 SPA reading Supabase (Postgres). **The database is the system of record**: sites, venues, hours and menus live there, not in the repo. A site is a college or a University site (West Cambridge, Sidgwick, a museum, …); a venue belongs to one. The repo holds code, migrations, and how each venue publishes its menu.

## Commands

| Command | What |
|---|---|
| `npm run dev` | Vite dev server (needs `VITE_SUPABASE_*` in `.env`) |
| `npm run ingest -- [--only jesus,homerton] [--dry]` | Fetch every scripted source from today until a week comes back empty → Supabase |
| `npm run ingest:manual -- menu.txt [...] [--dry]` | Save hand-transcribed menus → Supabase (format at the top of `scripts/ingest/manual.ts`) |
| `npm test` | Vitest (time logic, filters, SEO output, adapters against saved pages) |
| `npm run typecheck` / `npm run lint` | `tsc -b` + scripts tsconfig / oxlint |
| `npm run build` | typecheck + Vite build + `scripts/prerender.ts` → `dist/` (needs `VITE_SUPABASE_*`: pages are rendered from live data) |

`--dry` fetches and validates without writing. If ingest gets "fetch failed" for Magdalene locally, run with `NODE_USE_SYSTEM_CA=0` (keychain cross-signed certs break that chain).

## Layout

- `scripts/ingest/sources.ts` — **how each venue publishes its menu**: one entry per venue (`venues.id` = `<site>/<venue>`), channel (html/json/pdf/sway/canva/app/email/intranet/none), URL, cadence, notes, and an `adapter` for the 14 scripted ones (`scripts/ingest/sources/*.ts`: 11 colleges, plus `ucs.ts` for the three University Catering pages with a weekly menu). Adapters must take dates from the source, never from the requested week; tests run them on saved pages in `sources/fixtures/`.
- `scripts/schema.ts` — zod for `Dish` / `MenuDay`, checked before anything is saved; the app imports the types.
- `supabase/migrations/` — tables + RLS (anon SELECT only). `sites` (`kind` college | university) → `venues` (`url` = the venue's own page) → `service_slots`; `0004` seeded the University venues once. Menus: `menu_days` (one per venue/date/service, upserted) → `menu_items` (dishes as printed, replaced per day) → `dishes` (one per site + `dish_key(name)`, tracked across weeks); `dish_stats` view; `ingest_runs` (one row per source per run; service role only). Writes go through `save_menu()` (service role only).
- `src/lib/data.tsx` — `load()`s sites/venues/slots and the next 7 days of menus (`main.tsx` renders once it has, keeping the prerendered HTML up until then); `useMenuDates`/`useMenuOn` fetch a venue's full menu history (past and future) on demand. `src/lib/time/*` — Europe/London clock, Full Term dates, `openStatus()`; `src/lib/filters.ts` — ranking and sections (Open now / Later today / Other days / Hours not published). `src/lib/seo.ts` — per-page descriptions and schema.org data, sitemap, llms.txt.
- `src/pages/*` — the venue is the unit: `/` search (results by section, places not open today folded behind "N more" unless searching; filters in the URL: `q`, `type` (hall/cafe/bar; `hall` is labelled Dining), `site`, `guests`, `card`, `more`, and `open`; with `type=hall` also `meal`, `diet`), `/:slug` site, college or University (its venues, dining → cafés → bars; old `#venue-slug` links redirect), `/:site/:venue` venue (status, hours, menu for `?date=` (default today) with a calendar of every date that has one), `/about`, `*` 404. ← (`BackButton`) returns to the previous page, else goes up; scroll is kept per history entry (`useScrollMemory`). Every list uses `src/components/VenueCard.tsx`. White on charcoal (`#1e1e1e`), minimal text, icons from reicon.dev (`reicon-react` via `components/Icon.tsx`; venue types in `lib/icons.ts`); free-text DB fields (`notice`, `hours_text`, `access.text`, …) are research notes for editors and aren't shown.

## Menus

No projected menus: only what a source has published is saved, and sources are re-checked often instead (GitHub Actions runs `npm run ingest` at 05:15, 11:15 and 17:15 UTC; needs repo secrets `VITE_SUPABASE_URL` and `SUPABASE_SECRET_KEY`, then rebuilds the site through `CF_PAGES_DEPLOY_HOOK` when that's set). Days already saved are kept; a day the source still lists is replaced with the latest version.

Hand-transcribed venues (see `sources.ts`): open the URL (PDFs: `curl -A "Mozilla/5.0" … | pdftotext -layout - -`; Sway/Canva: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --dump-dom URL`), write a `.txt` outside the repo, `npm run ingest:manual -- file.txt`. Members-only colleges need a collaborator.

Reference data (hours, access, venues) is edited in the Supabase dashboard until there's an editor UI. Unknown hours ⇒ no slot (UI says "Hours not published", never "closed").

## Term dates

Michaelmas 2026 Full Term 6 Oct–4 Dec; Lent 2027 19 Jan–19 Mar; Easter 2027 27 Apr–18 Jun (`src/lib/time/termDates.ts`; Downing's adapter maps "WEEK n" through it). Update yearly from cam.ac.uk.

## Supabase

Project `grub` (ref `leghyhbkovkyipgoygko`, London `eu-west-2`, free tier), linked via `supabase link`. Keys in `.env` (see `.env.example`): `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (browser), `SUPABASE_SECRET_KEY` + `SUPABASE_DB_PASSWORD` (scripts/CLI only; `supabase projects api-keys --reveal` shows the secret key in full).

Schema change: add `supabase/migrations/NNNN_name.sql`, then `set -a && . ./.env && set +a && supabase db push`.

## Deploy

Static `dist/`, every page prerendered: `/jesus/caff` is `jesus/caff.html`, plus `sitemap.xml`, `llms.txt`, `llms-full.txt`, `robots.txt` and `404.html` (no SPA fallback: a missing page is a real 404). Prerendered pages leave out anything that depends on the clock (`snapshot`). Canonical origin `SITE_URL` in `src/lib/site.ts`.

Cloudflare Pages: build `npm run build`, output `dist`, env `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. Pages are as fresh as the last build: create a deploy hook (Settings → Builds → Deploy hooks) and save it as the repo secret `CF_PAGES_DEPLOY_HOOK` so each ingest run rebuilds. A venue added in the dashboard 404s until the next build.
