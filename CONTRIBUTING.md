# Contributing to grub.cam

Everything on the site is what a college or the University has published, or what someone standing in a venue has seen. There are three ways in, from the least to the most involved.

## 1. Send what you see

Every gap on a venue page ("No menu here yet", "No prices here yet") has a **Send** button, and the footer has **Send a menu, prices or a correction**: [grub.cam/send](https://grub.cam/send). Sign in with your Cambridge (@cam.ac.uk) Google account (the header's **Sign in**), then a photo of the menu board, the price list or the opening times, and/or the text typed out. A model reads it into the format we store and you check what it read. A menu, price list or opening times then goes up within minutes (a model checks any change you made to its reading against your photo); anything else once a person has read it. Typing just the change ("Monday closes at 2") works too: the model applies it to what the site lists. A better photo of the venue itself ("Have a better photo?" at the top of its page) goes up within minutes once a model has checked it shows the venue and no one's face, credited to your name and licensed CC BY 4.0. This is the way for anything that changes rarely (prices, hours) and for members-only menus the scripts can't reach.

Signed in, you can also **rate a venue** out of 5, with a few words if you like, at the foot of its page. Reviews are anonymous and show once a venue has five; words are checked first, and ones that name or describe a person don't show.

## 2. Post from your own script

If your college publishes its menu where only members can see it (the intranet, an app, an email) and you can read it programmatically, you can post it in. Ask for a **contributor token** (open an issue or write to Giulio), then:

```http
POST https://leghyhbkovkyipgoygko.supabase.co/functions/v1/submit
Authorization: Bearer <the site's publishable key, in any page's source>
apikey: <the same key>
X-Contributor-Token: <your token>
Content-Type: application/json

{ "venue": "kings/servery-dining-hall", "kind": "menu", "transcription": "<the file>" }
```

`kind` is `menu`, `prices` or `hours`, and `transcription` is a complete file in that kind's text format — the same one the maintainer uses by hand:

- menus: the header and body in `scripts/ingest/manual.ts`
- price lists: `scripts/ingest/prices.ts`
- opening hours: `scripts/ingest/hours.ts`

Your rows are trusted: the ingest Action publishes them within a few hours (`npm run submissions -- approve --trusted`), and the site rebuilds. Run your script on a schedule from wherever you're logged in; nothing of ours leaves the repository's secrets, and your token only works for your college.

## 3. Write an adapter

If your college publishes its menu on the open web (a page, a PDF, a JSON feed), the site can fetch it itself every two hours. Add it to `scripts/ingest/sources.ts`, write an adapter in `scripts/ingest/sources/<college>.ts` that returns `MenuDay[]` (dates must come from the source, never from the week asked for), save a copy of the page in `sources/fixtures/` and test the adapter against it. `npm run ingest -- --only <college> --dry` shows what it would save. See `AGENTS.md` for the conventions.

## Public menu data

No account is needed to read the public menu tables. `npm run export:menus` produces the research CSV bundle in Downloads; use `-- --out /path/to/exports` to choose another folder. It reads **all stored dates**, including future publications, with pagination and count checks. Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are needed: these are the public browser configuration, also present in the live site's JavaScript. Never share a service-role/secret key.

Dated weekly ZIPs are published in [GitHub releases](https://github.com/giuulio/grub.cam/releases) by **Weekly menu dataset**, on Mondays at 08:17 UTC or when manually started. Each day's snapshot is kept unchanged. The README, field dictionary, coverage and manifest travel with every ZIP. `venues.source_diet_codes` describes a verified source convention, not whether an unlabelled dish is non-vegan. Unknown conventions remain unknown.

For direct access, the public REST API is `<VITE_SUPABASE_URL>/rest/v1/<table>` with an `apikey: <VITE_SUPABASE_PUBLISHABLE_KEY>` header. Relevant tables are `sites`, `venues`, `menu_days`, `menu_items`, `venue_prices` and `service_slots`. Request explicit columns, a stable unique `order`, and every page with `limit`/`offset` (the server caps each response). `Prefer: count=exact` returns the total in `Content-Range`. Join `menu_items.menu_day_id` to `menu_days.id`, and `menu_days.venue_id` to `venues.id`. The homepage's seven-day load is not the full dataset. Treat diet labels as recorded labels and keep any later classifications and evidence in separate columns.

## Code

`npm test`, `npm run typecheck` and `npm run lint` must pass. The database is the system of record; schema changes are migrations in `supabase/migrations/`. Terms: a **site** is a college or a University site, a **venue** is somewhere you eat or drink in one; never "place".
