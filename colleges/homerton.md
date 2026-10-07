---
college: homerton
reviewed: 2026-10-07
---
# Homerton

[Master index](../menu-sources.md) · [Catering](https://www.homerton.cam.ac.uk/catering)

## Dining Hall
- **Type:** hall
- **Hours:** Easter term 2026: Mon–Fri 07:30–09:00 breakfast, 12:00–14:00 lunch, 17:30–19:00 dinner; Sat 08:00–10:00 breakfast, 12:00–14:00 lunch; Sun 12:00–14:00 roast or 11:00–14:00 brunch (alternate weeks) ([Easter 2026 times](https://www.homerton.cam.ac.uk/sites/default/files/2026-04/catering-opening-times-Easter-term-2026.docx)). Michaelmas 2026 times not yet published
- **Access:** unaccompanied visitors admitted [reported 2019](https://ssb22.user.srcf.net/buttery.html); reconfirm
- **Payment:** University card via EPOS; credit topped up through UPay (auto top-up available). Uni-card prices: main £3.69–£4.00, sides £0.30–£1.11, salad bowl £2.71, dessert £2.10; breakfast 4-item £3.47, 8-item £6.71 ([2026 price guide](https://www.homerton.cam.ac.uk/sites/default/files/2026-01/Guide-to-average-meal-prices-2026.docx))
- **Menu:**
  - **Kind:** json (embedded app)
  - **URL:** https://www.homerton.cam.ac.uk/catering
  - **Data:** `https://www.homerton.cam.ac.uk/api/cafeteria-menu?weekOffset={0..3}` (public JSON: days → breakfast / lunch / dinner → name, allergens, price; offset 4 returns 400)
  - **Cadence:** weekly tabs (This week, Next week, +2, +3)
  - **Coverage:** to 1 Nov 2026 (offset 0 runs from today, 7–11 Oct; offsets 1–3 are full Mon–Sun weeks)
  - **Includes:** dishes, prices, allergens
  - **Status:** live (7 Oct 2026)
  - **Checked:** 2026-10-07
  - **Notes:** the menu is a Vue app loaded by JavaScript, so it is invisible in the raw HTML (missed in the earlier audit). Endpoint path comes from `drupalSettings.cafeteriaMenu.apiEndpoint`. Dish names can contain line breaks (`
`). Other downloads on the page are not meal menus (Easter 2026 formal menus, Sept 2022 menu, Griffin Bar cocktail list)
- **Serves:** rotating dishes (about three mains plus sides per service); full English and continental breakfast
- **Dietary:** vegan, vegetarian, meat, fish; halal on request

## Buttery
- **Type:** cafe
- **Hours:** Easter term 2026: Mon–Fri 08:30–17:30; Sat–Sun 08:30–16:00
- **Access:** ?
- **Payment:** University card (EPOS)
- **Prices:** sandwiches £3.24–£3.96; hot paninis/wraps £4.14; hot drinks £1.50–£2.33; cakes £2.14–£2.61 (2026 guide)
- **Serves:** paninis, cold lunches, snacks, coffee; study/social space

## Griffin Bar
- **Type:** bar
- **Hours:** Easter term 2026: Mon, Wed, Thu 17:00–22:00; Tue 17:00–22:30; Fri 16:00–22:00; Sat–Sun 15:00–22:00. Google Maps: daily 18:00–23:00 [Google Maps, 2026-10-07]
- **Access:** ?
- **Payment:** ?
- **Serves:** pints, Homerton lager and gin, cocktails, wine

## Formal
- **Type:** formal
- **Days:** ? (tickets released weekly)
- **Time:** ?
- **Dress:** relaxed; gowns optional
- **Format:** candlelit three-course sit-down dinner with Fellows ([Easter 2026 formal menus](https://www.homerton.cam.ac.uk/sites/default/files/2026-04/easter-term-formal-menus-2026-for-website_1.docx))
- **Booking:** UPay tickets, released weekly, including guest tickets
- **Guests:** tickets via UPay
- **Cost:** ?
