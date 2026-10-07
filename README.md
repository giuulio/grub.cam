# Grub — Cambridge college menus, live

**Where can I eat in Cambridge right now, and what's on?**

Grub lists the dining halls, cafés and bars of all 31 Cambridge colleges with opening hours, who can get in, how to pay, dietary provision, and — for the 21 colleges that publish one — this week's menu, dish by dish. Venues are ranked by what's open now, then what opens next; filter by meal, diet, access, bank card, venue type, or search for a dish.

Every fact links back to the College's own page and carries a provenance badge (official / reported / Google Maps / unconfirmed) so you can judge how much to trust it.

## Run it

```sh
npm install
npm run build:data   # validate data → public/data.json
npm run dev
```

See [AGENTS.md](AGENTS.md) for the data model, ingest pipeline, weekly refresh procedure and deployment notes.

## Data

- `data/` — hand-curated reference data (YAML), audited against official College pages on 7 Oct 2026.
- `menus/` — weekly dish observations, fetched by `scripts/ingest` or transcribed from PDFs/image menus.
- Menus are re-published from public College sources with attribution. If something is wrong, open an issue or a PR against the data file.

## Roadmap

- Supabase-backed ratings, reviews and "report an error"
- Parsers for the remaining PDF/Sway/Canva menus
- University cafés (West Hub etc.), distance sort, formal-hall menus
