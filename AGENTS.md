# Grub (grub.cam) — agent notes

Cambridge college and University menus and hours, live. Vite + React 19 + TypeScript + Tailwind 4 SPA reading Supabase (Postgres). **The database is the system of record**: sites, venues, hours and menus live there, not in the repo. A site is a college or a University site (West Cambridge, Sidgwick, a museum, …); a venue belongs to one. Those are the only two words for them, in copy, code and URLs: never "place". The repo holds code, migrations, and how each venue publishes its menu.

## Commands

| Command | What |
|---|---|
| `npm run dev` | Vite dev server (needs `VITE_SUPABASE_*` in `.env`) |
| `npm run ingest -- [--only jesus,homerton] [--from 2026-09-28] [--dry]` | Copy every source's channel to `venues`, then fetch every scripted source from this week's Monday (or `--from`'s week, to fill in the past: Jesus, Corpus, Selwyn and Robinson keep years of days) until a week ahead comes back empty → Supabase |
| `npm run ingest:manual -- menu.txt [...] [--dry]` | Save hand-transcribed menus → Supabase (format at the top of `scripts/ingest/manual.ts`) |
| `npm run ingest:prices -- prices.txt [...] [--dry]` | Save a venue's posted price list → Supabase, replacing the last one (format at the top of `scripts/ingest/prices.ts`) |
| `npm run ingest:photo -- <site>/<venue> <photo.jpg \| Commons file> --alt "…" [--credit …] [--kind menu] [--dry]` or `-- --list file` | Write a photo's sizes to `public/photos` and add it to Supabase, credited from Commons ([photo workflow](docs/operations.md#photos)) |
| `npm run ingest:hours -- hours.txt [...] [--dry] [--keep]` | Save a venue's opening hours → `service_slots`, replacing its slots unless `--keep` (format at the top of `scripts/ingest/hours.ts`) |
| `npm run submissions -- list \| show <id> \| transcribe <id> file.txt \| approve <id> \| approve --trusted \| reject <id> "why"` | The queue of what people sent in from `/send` ([review queue](docs/operations.md#submissions)) |
| `npm run models:compare -- <dir> --model a=in/out [...]` | Which OpenAI model transcribes boards best: each model on each photo in `<dir>` against its hand-checked `.txt`, scored per line, with cost (format at the top of `scripts/ingest/compare-models.ts`) |
| `npm run submissions -- smoke [--venue v] [--photo f.jpg] [--review]` | Check the deployed submission API with a throwaway account and clean up; no Google sign-in or publication/deploy test ([details](docs/operations.md#accounts)) |
| `npm run auth:google [-- --check]` | Switches on Google sign-in (the University's Raven OAuth2) and sets the site and redirect URLs, through the Management API (`SUPABASE_ACCESS_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` in `.env`; [README setup](README.md#switching-on-sending-in)) |
| `npm run submissions -- digest` | What waits for you, as Markdown (no personal data): the queue Action (`.github/workflows/queue.yml`, started at 07:00 and 18:00 UTC by pg_cron) keeps it as the body of the open "Review queue" issue, commenting when it changes so GitHub emails you |
| `npm run reviews -- list [--all] \| approve <id> \| hide <id> "why"` | Members' reviews held back by the check (their words and author, for you alone), or all of them; publish one, or take one down for good |
| `npm test` | Vitest (time logic, filters, search against a real-data snapshot, SEO output, adapters against saved pages) |
| `npm run search:snapshot` | Save what the app loads today to `src/lib/fixtures/snapshot.json` for the search tests (then re-check their dish examples) |
| `npm run typecheck` / `npm run lint` | `tsc -b` + scripts tsconfig / oxlint |
| `npm run build` | typecheck + Vite build + `scripts/prerender.ts` → `dist/` (needs `VITE_SUPABASE_*`: pages are rendered from live data) |

`--dry` fetches and validates without writing. If ingest gets "fetch failed" for Magdalene locally, run with `NODE_USE_SYSTEM_CA=0` (keychain cross-signed certs break that chain).

## Read before changing a subsystem

- [Design and page behaviour](docs/design.md): routes, layout, controls, maps and visual conventions.
- [Operations](docs/operations.md): ingest quirks, submissions, reviews, photos, auth and deployment.
- [Google sign-in setup and status](README.md#switching-on-sending-in): the setup instructions live there.

Keep these references current when behaviour changes. Keep AGENTS focused on commands, invariants and where code lives; detailed walkthroughs belong in the linked docs.

## Code map

| Area | Entry points |
|---|---|
| Menu sources and adapters | `scripts/ingest/sources.ts`, `scripts/ingest/sources/`, saved pages in `sources/fixtures/` |
| Validated ingest types | `scripts/schema.ts` (`Dish`, `MenuDay`; also imported by the app) |
| Database schema and RLS | `supabase/migrations/` |
| Initial data and menu history | `src/lib/data.tsx`: `load()`, `useMenuDates()`, `useMenuOn()` |
| Clock, terms and opening status | `src/lib/time/`, `src/lib/status.ts`, `src/components/Status.tsx` |
| Search and ranking | `src/lib/search.ts`, `src/lib/filters.ts` |
| Finder tabs, URL filters and old links | `src/lib/finder.ts`, `src/pages/Home.tsx` |
| Venue rows, prices and formal hall | `src/components/Listing.tsx` (`VenueRow`), `src/lib/prices.ts`, `src/lib/formal.ts` |
| Pages and shared layout | `src/pages/`, `src/App.tsx`, `src/index.css` |
| Map engines and shared geometry | `src/components/VenueMap.tsx`, `src/components/AppleMap.tsx`, `src/lib/mapView.ts`, `src/lib/map.ts` |
| Photos | `src/components/VenuePhoto.tsx`, `src/lib/photos.ts`, `scripts/ingest/photo.ts` |
| Accounts and sending in | `src/lib/auth.ts`, `src/lib/submit.ts`, `src/pages/Send.tsx`, `supabase/functions/submit/` |
| Model calls and prompts | `supabase/functions/_shared/openai.ts`, `supabase/functions/_shared/formats.ts` |
| Reviews | `src/components/Reviews.tsx`, `scripts/ingest/reviews.ts` |
| SEO and prerendering | `src/lib/seo.ts`, `src/entry-server.tsx`, `scripts/prerender.ts` |

## Data rules

- A **site** is a college or University site (`sites.kind`: `college` or `university`); a **venue** belongs to it, with id `<site>/<venue>`. Reference data is edited in Supabase; schema changes go in migrations. Free-text research fields (`notice`, `hours_text`, …) are editor notes, not public copy.
- A venue is somewhere people go to eat or drink, not a common room, gathering, vending machine or overflow seating. Dining (`type: hall`) serves dishes that change by date; a café has a mostly fixed list; a bar serves drinks. A café that becomes a bar in the same room is one venue: `venueTypes()` uses its café (`snacks`) and bar slots to list it under both types. A University café whose main offer changes daily is Dining and keeps its café hours.
- Formal hall is the `formal` meal, on the venue whose room holds it. Create a separate venue only when it has its own room. A `formals` row also lists a venue under Formal when its days are unknown. Formal only counts towards open now when that meal is selected or it is all the venue holds.
- Unknown hours mean no slot and “Hours not published”, never “closed”. Opening status uses Europe/London. Full Term dates live in `src/lib/time/termDates.ts`; update yearly from the University. Current entries cover Michaelmas 2026 through Easter 2027; Downing's adapter uses them for “WEEK n”.
- Save only published menus. Adapter dates must come from the source, never the requested week; emit a meal only if the source has dishes for it. Peterhouse's daily salad bar and desserts do not imply Sunday lunch. Add adapter tests against saved pages. Already saved days stay unless the source lists an updated version.
- Edit menu channel, URL and scripted status in `scripts/ingest/sources.ts`, not the dashboard: ingest copies them to `venues`. `weeksAhead` extends the default Full Term lookahead for sources such as Peterhouse.
- `servedService()` maps a source's meal to the venue's actual service when appropriate (Corpus calls Saturday brunch “Lunch”). Apply it when menus load.
- Store prices as posted. `venues.price_terms.tiers` names the columns in their source order; `note` explains other rules. Never compute prices from a percentage: show the rule. A list line can be a range, a second-tier price only, a course/whole-meal price or an item sold at selected services. Formal details are filled only when the source states them plainly.
- Use verified venue or containing-building coordinates with a `location_source`, never a college centroid or invented room point. Venues without coordinates remain in lists.
- Photos must be ours, licensed by a contributor or openly licensed on Commons, with credit and no recognisable people. A building or court is acceptable when no room photo is available; say what it shows in the alt text. Never copy photos from Google Maps, social media or college websites.

## Database and loading

`sites` → `venues` → `service_slots` / `formals`. `menu_days` is unique per venue/date/service; its `menu_items` are replaced per saved day and linked to `dishes` (one per site + `dish_key(name)`). `dish_stats` tracks history. `ingest_runs` is service-role only. `venue_prices` is replaced per venue; `save_menu()` and `save_prices()` are service-role RPCs. Moving a venue id cascades to its related rows.

Price columns: `menu_items.price_gbp` / `price2_gbp`; `venue_prices.price_gbp`, `price_max_gbp`, `non_member_gbp`, plus `services`, `course`, `tags`. `formals` holds days, gowns, dress, guests, booking and posted prices; its other text columns are research notes. `photos` has a venue or site subject; only approved rows are public. Public readers have SELECT access under RLS; member submission and review writes use the submit function, while account sessions use Supabase Auth. Review views expose no author and no venue with fewer than five published ratings.

`load()` fetches sites, venues, slots, prices, photos, ratings and seven days of menus. The browser keeps prerendered HTML until this resolves. Menu dates and individual past/future days load on demand. Prerendered pages omit clock-dependent output (`snapshot`).

## Search

Index once per loaded snapshot: one document per venue and per dish/date, with venue names on each dish. Fields rank venue name (including “<site> College”), aliases, venue type/meals, dish name, diet and service. Match exact words, English plurals, `SYNONYMS`, split/joined words, and the final word as a prefix unless followed by a space; drop stopwords.

Typos use Damerau distance (one from four letters, two from eight; a wrong first letter costs two), only for words that match nothing as typed, so “cake” never drifts to “hake”. Rank by most query words matched, then typos, worst field, whole-name match, exact words and open status. Results bypass opening-status groups.

Search sees only the selected date, meal and all selected diet tags. Home defaults to today without silently searching tomorrow; browsing may preview the next service. Aliases belong in Supabase. Add a failing judged query to `src/lib/search.test.ts` before changing search rules; its real-data snapshot is refreshed with `npm run search:snapshot`.

## UI rules

Use the shared controls, status wording, venue rows, type labels and gap links. Missing information stays visible with a way to send it. Keep menus and hours readable without an account. Keep each venue's type consistent across rows, headings and map pins. Use Figtree for titles and Public Sans elsewhere; both are self-hosted. Colours, spacing and component details are in [design](docs/design.md).

## Supabase and deployment

Project `grub`, ref `leghyhbkovkyipgoygko`, London `eu-west-2`, linked via `supabase link`. `.env.example` lists browser keys (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) and server-only credentials (`SUPABASE_SECRET_KEY`, `SUPABASE_DB_PASSWORD`). Never expose server credentials to the browser or commit them.

Schema change: add `supabase/migrations/NNNN_name.sql`, then `set -a && . ./.env && set +a && supabase db push`.

Cloudflare Workers serves static `dist/`; pushes to main build and deploy it. Every route is prerendered, with a real 404 and no SPA fallback. New venues need a build before their URLs exist. Canonical origin is `SITE_URL` in `src/lib/site.ts`. Preserve `splitHoisted()`: React can hoist the title and photo preload in either order; both must reach `<head>`.

Google sign-in is on (12 Oct 2026); setup in [README](README.md#switching-on-sending-in). Members sign in with their @cam.ac.uk Google account (Raven OAuth2); not Microsoft, whose Cambridge tenant likely needs UIS to approve an outside app. `submit` has `verify_jwt = false` because it validates user tokens through Auth itself and also accepts contributor tokens; migration `0026` independently rejects non-`@cam.ac.uk` accounts. Reading needs no account.

The submit function does not save menus, hours, price lists or venue photos directly into public data: publication uses the ingest parsers and queue scripts. Reviews are checked and saved by the function. Keep private submission evidence and personal details out of the public Review queue issue. Model spend is logged; the application has no monthly cap. An OpenAI monthly cap requires **Enforce a hard limit**; `LLM_DAILY_USD` optionally checks daily spend before calls. See [operations](docs/operations.md) for the full workflow.
