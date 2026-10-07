# Grub — Cambridge college menus, live

**Where can I eat in Cambridge right now, and what's on?**

Grub lists the dining halls, cafés and bars of all 31 Cambridge colleges with opening hours, who can get in, how to pay, dietary provision, and the menu dish by dish wherever a college publishes one. Venues are ranked by what's open now, then what opens next; filter by meal, diet, access or bank card, or search for a dish.

## Run it

```sh
npm install
cp .env.example .env   # add the Supabase URL and publishable key
npm run dev
```

Live at [grub.cam](https://grub.cam) (once deployed). See [AGENTS.md](AGENTS.md) for the data model, ingest pipeline and deployment notes.

## Data

- Everything lives in Supabase. Menus are fetched from public College sources several times a day (`scripts/ingest`) or transcribed from PDFs and image menus, and re-published with attribution.
- [`scripts/ingest/sources.ts`](scripts/ingest/sources.ts) records how each college publishes its menu.
- Something wrong? [Open an issue](https://github.com/giuulio/grub.cam/issues).

## Roadmap

- Sign-in with Cambridge accounts; ratings, reviews and error reports; per-college editors
- Menus from collaborators for members-only colleges
- Dish history and search, favourites and alerts
- Dated hours overrides (closures, vacations)
