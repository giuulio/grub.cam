# Cambridge cafeteria menu sources

Master index for all 31 colleges; each name links to that college's food guide (dining halls, cafés, bars, formal dining, access, payment, menu source). Audited against official pages on 7 Oct 2026: **21 of 31 colleges have a current public menu.**

**Live?** Yes = public menu showing the current week (or today), verified 7 Oct 2026; — = no public current menu. Menu URLs are listed only when public and current; outdated menu links are deliberately omitted.

Official College pages take precedence over JCR/MCR, student and third-party sources; where they conflict, the official value is used and the other is kept and labelled. A failed fetch is not proof that a venue is closed.

## File conventions

Each college guide starts with frontmatter (`college`, `reviewed`, optional `notice` for a current, actionable alert such as a closure), then one `##` section per venue, `## Formal`, and an optional `## Notes`. Venue fields: **Type** (hall | cafe | bar | other), **Where**, **Hours**, **Access**, **Payment**, **Prices** (cafés), **Menu** (halls), **Serves**, **Dietary**. Formal fields: **Where**, **Days**, **Time**, **Dress**, **Format**, **Booking**, **Guests**, **Cost**.

**Menu** sub-bullets:
- **Kind:** html | pdf | docx | json | app | intranet | email | social | none (optional platform in brackets, e.g. `app (Canva)`)
- **URL:** human-facing page
- **Data:** direct machine-readable endpoint, where one exists (optional)
- **Cadence:** daily | weekly | rolling N days | N-week cycle | ?
- **Coverage:** how far ahead the published menus go, as of **Checked**
- **Includes:** what the source carries (dishes, prices, allergens, diet tags…)
- **Status:** live | members-only | none | unverified (with the dated evidence)
- **Checked:** date last verified
- **Notes:** optional

Source markers: unmarked = official College page; `[reported YEAR](url)` = secondary source; `[Google Maps, DATE]` = Google listing (often lags official hours); `[lead: …]` = unconfirmed; `[stale]` = outdated; `?` = unknown. Official sources win conflicts; the losing value is kept and labelled.

## Colleges

| College guide | Menu URL | Format | Live? | Notes |
| --- | --- | --- | --- | --- |
| [Christ's](colleges/christs.md) | — | Intranet (403) | — | Intranet (403); JCR widget showed "Menu Unavailable!". |
| [Churchill](colleges/churchill.md) | https://www.chu.cam.ac.uk/about/campus/dining-at-college/lunch-and-dinner-menu/ | HTML, weekly | Yes | w/c 5 Oct; diet tags; no prices. |
| [Clare](colleges/clare.md) | — | Intranet (login) | — | Login; non-Clare accounts get "user not found in Drupal". |
| [Clare Hall](colleges/clare-hall.md) | https://sway.cloud.microsoft/b7Zz74Q2g96EIhE9 | Microsoft Sway (JS), weekly | Yes | w/c 5 Oct, day by day; PB/V/GF tags. |
| [Corpus Christi](colleges/corpus-christi.md) | https://www.corpus.cam.ac.uk/foodmenu/ | HTML (iframe), daily | Yes | Filled to 29 Nov. Data: `/foodmenu/menu/?reference=1&date=YYYY-MM-DD`; prices, allergens. |
| [Darwin](colleges/darwin.md) | https://www.darwin.cam.ac.uk/dine/weekly-menu/ | HTML, week tabs | Yes | This/next week + w/c to 9 Nov; prices, allergens. |
| [Downing](colleges/downing.md) | https://wba.kafoodle.com/17260 | Kafoodle app (JS), weekly | Yes | "Michaelmas 2026 – Week 1" rendered; allergens, nutrition; no prices. |
| [Emmanuel](colleges/emmanuel.md) | — | Intranet (login) | — | Login required; non-Emmanuel accounts denied. |
| [Fitzwilliam](colleges/fitzwilliam.md) | https://www.fitz.cam.ac.uk/cafe-bar-and-buttery | PDF, weekly | Yes | w/c 28 Sep and 5 Oct linked; filenames undated. |
| [Girton](colleges/girton.md) | — | Internal newsletter | — | Friday member newsletter. |
| [Gonville & Caius](colleges/gonville-and-caius.md) | — | Intranet (Raven) | — | Member meal-booking system. |
| [Homerton](colleges/homerton.md) | https://www.homerton.cam.ac.uk/catering | JSON API (embedded app), weekly | Yes | Data: `/api/cafeteria-menu?weekOffset={0..3}`; to 1 Nov; prices, allergens. |
| [Hughes Hall](colleges/hughes-hall.md) | — | UPay app (login) | — | Menus in UPay; non-Hughes accounts get an SSO error. |
| [Jesus](colleges/jesus.md) | [Lunch](https://apps.jesus.cam.ac.uk/foodmenuview/?event_id=1) · [Dinner](https://apps.jesus.cam.ac.uk/foodmenuview/?event_id=2) | HTML (iframe), daily | Yes | Filled to 2 Dec. Data: `digiboard.php?event_id={1,2}&date=YYYY-MM-DD`; prices, allergens. |
| [King's](colleges/kings.md) | — | Member email | — | Weekly member email (Sundays). |
| [Lucy Cavendish](colleges/lucy-cavendish.md) | https://www.canva.com/design/DAFvirNLKtg/view | Canva (JS), weekly | Yes | 5–11 Oct. One design, overwritten weekly; embedded on the dining page as `…/view?embed`. |
| [Magdalene](colleges/magdalene.md) | https://viewthe.menu/lyzv | HTML (viewthe.menu), weekly | Yes | w/c 5 Oct. Toolbar list not in date order; pick by "Com DD/MM/YY" label. Also bar and formal menus. |
| [Murray Edwards](colleges/murray-edwards.md) | — | Intranet (My Medwards, 403) | — | Page returns 403 / "object not found". |
| [Newnham](colleges/newnham.md) | https://newn.cam.ac.uk/weekly-menus | HTML, weekly | Yes | 5–11 Oct; also [today's menu](https://newn.cam.ac.uk/todays-menu); no prices. |
| [Pembroke](colleges/pembroke.md) | https://www.pem.cam.ac.uk/college/catering/information-students/servery-menu | PDF, 3-week cycle (dated) | Yes | w/c 5 Oct = Week 1 (only PDF linked). |
| [Peterhouse](colleges/peterhouse.md) | https://petmenu.co.uk/ | Unofficial; JSON | Yes | `servery.json` / `formal.json`: Michaelmas 2026, 28 Sep–17 Dec. |
| [Queens'](colleges/queens.md) | https://www.queens.cam.ac.uk/life-at-queens/catering/dining-hall/weekly-menu/ | HTML, weekly | Yes | w/c 5 Oct; no prices. |
| [Robinson](colleges/robinson.md) | https://www.robinson.cam.ac.uk/college-life/garden-restaurant-menu | HTML, daily (`?date=YYYY-MM-DD`) | Yes | Filled to 23 Oct; member/non-member prices; page retitled Crausaz Wordsworth Building. |
| [St Catharine's](colleges/st-catharines.md) | https://www.caths.cam.ac.uk/students/college-facilities-and-forms/catering-for-our-community/cafeteria | PDF, 4-week cycle (dated) | Yes | All 4 cycle weeks linked; dates printed in each PDF; covers term to w/c 30 Nov. |
| [St Edmund's](colleges/st-edmunds.md) | https://my.st-edmunds.cam.ac.uk/category/menus/ | Weekly posts → cycle PDFs | Yes | w/c 5 Oct posted 4 Oct; includes time changes. |
| [St John's](colleges/st-johns.md) | https://menu.joh.cam/ | HTML, rolling 7 days | Yes | 7–13 Oct; diet tags, allergens; no prices. |
| [Selwyn](colleges/selwyn.md) | https://www.sel.cam.ac.uk/current-members/hall-menu | HTML, daily (`?menu_date=YYYY-MM-DD`) | Yes | Filled to 8 Nov; no prices. |
| [Sidney Sussex](colleges/sidney-sussex.md) | — | — | — | No public menu found. |
| [Trinity](colleges/trinity.md) | https://www.trin.cam.ac.uk/download/hall-menu-this-week/ | PDF, weekly | Yes | `Hall-menu-111026.pdf` (5–11 Oct); 403 to plain curl. |
| [Trinity Hall](colleges/trinity-hall.md) | — | Intranet (Raven) | — | Daily menus on intranet. |
| [Wolfson](colleges/wolfson.md) | https://www.wolfson.cam.ac.uk/food/cafeteria-menus | HTML, daily sections | Yes | Current week only; student/other prices, allergens. |

## University cafés

| Venue | Menu URL | Format | Live? | Notes |
| --- | --- | --- | --- | --- |
| West Hub Canteen | https://www.catering.admin.cam.ac.uk/cafes/west-hub-canteen | HTML, weekly | Yes | w/c 5 Oct 2026 published on page. Mon–Fri. |
| Cavendish Café, Ray Dolby Centre | https://www.cdc.events/cavendish-cafe/ | PDF, standing menu | — | Operator's "current menu" PDF was uploaded Apr 2025; no dated weekly menu. Weekdays 08:30–15:30. |
| Courtyard Kitchen, Fitzwilliam Museum | https://www.cdc.events/services-fitzwilliam-museum-events/ | PDF, seasonal menu | Yes | Current menu PDF "April 2026" (uploaded Sep 2026). Tue–Sat 10:00–16:30; Sun 12:00–16:30. |
| All other cafés (directory) | https://www.catering.admin.cam.ac.uk/cafes | Directory | — | Discovery source; menu availability varies by café. |
