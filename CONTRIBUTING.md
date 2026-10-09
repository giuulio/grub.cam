# Contributing to grub.cam

Everything on the site is what a college or the University has published, or what someone standing in a venue has seen. There are three ways in, from the least to the most involved.

## 1. Send what you see

Every venue page has **Send a photo** links, and the footer has **Send a photo or a correction**: [grub.cam/send](https://grub.cam/send). A photo of the menu board, the price list or the opening times, and/or the text typed out. A model reads it into the format we store, you check what it read, and it goes up once a person has approved it. No account needed. This is the way for anything that changes rarely (prices, hours) and for members-only menus the scripts can't reach.

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

If your college publishes its menu on the open web (a page, a PDF, a JSON feed), the site can fetch it itself three times a day. Add it to `scripts/ingest/sources.ts`, write an adapter in `scripts/ingest/sources/<college>.ts` that returns `MenuDay[]` (dates must come from the source, never from the week asked for), save a copy of the page in `sources/fixtures/` and test the adapter against it. `npm run ingest -- --only <college> --dry` shows what it would save. See `AGENTS.md` for the conventions.

## Code

`npm test`, `npm run typecheck` and `npm run lint` must pass. The database is the system of record; schema changes are migrations in `supabase/migrations/`. Terms: a **site** is a college or a University site, a **venue** is somewhere you eat or drink in one; never "place".
