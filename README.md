# grub.cam: Cambridge college menus, live

**Where can I eat in Cambridge right now, and what's on?**

Grub lists the dining halls, cafés and bars of all 31 Cambridge colleges, and the University's own cafés and canteens (West Cambridge, Sidgwick, the UL, the museums and more), with opening hours and the menu dish by dish wherever one is published. What's open now comes first; filter by type, college or site, meal or diet, or search for a dish.

## Run it

```sh
npm install
cp .env.example .env   # add the Supabase URL and publishable key
npm run dev
```

Live at [grub.cam](https://grub.cam) (once deployed). See [AGENTS.md](AGENTS.md) for the data model, ingest pipeline and deployment notes.

## Data

- Everything lives in Supabase. Menus are fetched from public college and University sources several times a day (`scripts/ingest`) or transcribed from PDFs and image menus, and re-published with attribution.
- [`scripts/ingest/sources.ts`](scripts/ingest/sources.ts) records how each venue publishes its menu.
- Something wrong? [Open an issue](https://github.com/giuulio/grub.cam/issues).

## Roadmap

- Sign-in with Cambridge accounts; ratings, reviews and error reports; editors per college or site
- Menus from collaborators for members-only colleges
- Dish history and search, favourites and alerts
- Dated hours overrides (closures, vacations)
