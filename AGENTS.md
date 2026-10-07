# Grub (grub.cam) — agent notes

Cambridge college menus, hours and access, live. Vite + React 19 + TypeScript + Tailwind 4; data in YAML/JSON validated by zod; Supabase (Postgres) as the serving DB with a static-JSON fallback.

## Commands

| Command | What |
|---|---|
| `npm run dev` | Vite dev server (reads `public/data.json`, or Supabase if `VITE_SUPABASE_*` set in `.env`) |
| `npm run build:data` | Validate `data/` + `menus/` → `public/data.json`; prints counts and halls without hours |
| `npm run ingest -- [--week 2026-W41] [--only jesus,homerton]` | Fetch scripted sources → `menus/<week>/<college>.json` |
| `npm run ingest:manual` | Compile hand-transcribed `menus/<week>/<college>.txt` → `.json` |
| `npm run seed` | Upsert everything into Supabase (needs `SUPABASE_SERVICE_ROLE_KEY` in `.env`) |
| `npm test` | Vitest (time logic, filters) |
| `npm run typecheck` / `npm run lint` | `tsc -b` + scripts tsconfig / oxlint |
| `npm run build` | build:data + typecheck + Vite build → `dist/` (static; deploy anywhere) |

## Layout

- `scripts/schema.ts` — zod schemas; the single source of truth for types (app imports from here).
- `data/colleges/<slug>.yaml` — 31 colleges: venues, access, payment, dietary, menu source, formal, notes. Every fact has a `prov` (source_kind / observed_at / confidence).
- `data/hours/<slug>.yaml` — structured service slots. `days` accepts `mon-fri`, `daily`, `sat,sun` — quote comma lists inside `{ }` flow maps (`days: "sat,sun"`); slots are `.strict()` so an unquoted one fails the build. Unknown hours ⇒ no slot (UI says "Hours not published", never "closed").
- `menus/<ISO week>/<college>.json` — dish observations. `.txt` siblings are the hand-transcribed source for non-scripted colleges (format documented at top of `scripts/ingest/manual.ts`).
- `scripts/ingest/sources/*.ts` — one adapter per machine-readable college (11): homerton, peterhouse, corpus, jesus, robinson, selwyn, st-johns, downing (Kafoodle API), darwin, wolfson, magdalene (tenkites JSON-LD).
- `supabase/migrations/0001_init.sql` — tables + RLS (anon SELECT only).
- `src/lib/time/*` — Europe/London clock, Full Term dates, `openStatus()`; `src/lib/filters.ts` — ranking.

## Weekly menu refresh (until all sources are scripted)

1. `npm run ingest` (scripted colleges).
2. For each `.txt` college — Churchill, Newnham, Queens', St Edmund's, Fitzwilliam, Pembroke, St Catharine's, Trinity, Clare Hall (Sway), Lucy Cavendish (Canva) — open the source URL (PDFs: `curl -A "Mozilla/5.0" … | pdftotext -layout - -`; Sway/Canva: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --dump-dom URL`), transcribe into `menus/<week>/<college>.txt`, run `npm run ingest:manual`.
3. `npm run build:data` then `npm run seed`.

Gotchas: Robinson's `?date=` returns the following day (adapter requests date−1 and trusts the heading). Trinity's PDF needs a browser UA. Magdalene's menu list isn't in date order — pick by the "Com DD/MM/YY" label. Downing posts one combined daily menu (stored as both lunch and dinner with a note). St Catharine's counters: 1 meat/fish, 2 vegetarian, 3 plant-based (convention, not labelled).

## Term dates

Michaelmas 2026 Full Term 6 Oct–4 Dec; Lent 2027 19 Jan–19 Mar; Easter 2027 27 Apr–18 Jun (`src/lib/time/termDates.ts`). Update yearly from cam.ac.uk.

## Deploy

Static `dist/`. Cloudflare Pages: build `npm run build`, output `dist`, env `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; SPA fallback to `/index.html` (add `public/_redirects` with `/* /index.html 200`).
