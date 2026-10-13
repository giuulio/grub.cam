# Design and page behaviour

See [AGENTS.md](../AGENTS.md) for data rules and commands, and [operations](operations.md) for publishing and deployment. This document describes the shared UI and the behaviour to preserve when changing it.

## Routes and shared shell

The front page is the finder, with one address per tab: `/` All, `/dining`, `/cafes`, `/bars`, `/formal`. `SCOPES` in `src/lib/finder.ts` defines their headings, labels and meta descriptions. Headings use the words people search for (“Cambridge college bars”). A site has `/:slug`; a venue has `/:site/:venue`. Other pages are `/send`, `/coverage`, `/about`, `/terms`, `/credits` and a real 404.

Keep old links working: `legacyPath()` handles `/explore?…`, `/?type=…` and `/?venue=<id>`; `/directory`, `/colleges` and `/university` redirect to `/` in the app and `public/_redirects`. Old site-page `#venue-slug` links redirect to the venue. There is no separate directory or site index: find a site through search or `SitePicker`.

The header is shared across pages: name, BETA label, search with `ScopeTabs` inside, GitHub star count, account control and theme toggle. It has no logo; `index.html` uses the blank `data:,` favicon. GitHub stars are read at build time in `vite.config.ts` and omitted when unavailable. The account control depends on the session and whether the sign-in provider is enabled. Contribution links belong beside gaps and in the footer.

At 1280px and wider the header is one row, with search centred in three columns. Below that, search has its own row. On a phone's finder it sits over the map or at the top of the list instead. Search filters as you type; elsewhere it opens `/?q=…`. There is no search button. The header stays in view above phone width, and sticky content clears its measured `--header-h`.

The footer has About, Find and Help links, coverage counts, copyright, terms and the not-affiliated line. `BackButton` is on `/send` only; site and venue pages have neither a back button nor breadcrumbs in the visible UI. `useScrollMemory` restores scroll per history entry.

## Finder

From tablet width up, the finder is a list of `VenueRow`s beside a slightly wider map (9fr:11fr). The list starts with the tab's heading, count and coverage line (`tabCoverage()`), then 24 rows at a time (`PAGE`) and “Show 24 more”. Filters reset the count; a pin can reveal enough rows to reach its venue. Prerendered HTML includes every row. The list scrolls independently without a scrollbar; the map clears the header, window edge and screen foot by the page gutter. After the list ends, the page can scroll to the footer.

Rows have a 4:3 photo, up to 320px wide, 20px corners, type badges, site name, venue name and one status line (meal, next service today, distance when available). Their detail depends on the tab:

- Dining: the next meal and up to five main dishes, one per line, then “+N more”. `mainDishes()` prefers `course: main`, else all dishes. Venues used only for formal hall are excluded.
- Cafés and Bars: hours and usual prices from `headlinePrices()` (coffee/tea/food, or beer/wine/spirit/soft drink). Dining without dishes can also use headline course or meal prices.
- Formal hall: When, Price, Dress and Booking using `src/lib/formal.ts`.
- Search: what matched. Gaps: what is missing and a link to `/send` for it, with a camera in a Light Blue disc and action-coloured text.

Picking a desktop pin reduces the list to that venue under “Show all N venues”. That link or a map-background click restores the full list and its scroll position. No duplicate card floats over the desktop map. Hovering a row highlights its pin. The initial fit uses the central cluster (`core`, within 1.5 km of Cambridge's middle); narrowing the list fits every remaining venue.

On a phone the map fills the screen below the measured `--finder-top`. The heading is available to screen readers. Search and horizontally scrolling filter chips overlay the top; a selected pin shows swipeable `MapCards` at the foot. Search selects its first result, clearing it hides the cards, and the map follows the selected card. Cards sit above the keyboard using `--keyboard` from the visual viewport. “List · N” switches to `view=list`; old `view=map` links still open the map. Only mount a map where one is shown.

Filters are validated by `readFilters()`. Shared across tabs: `q`, comma-separated `site`, `kind=college|university` and `open`. Dining also has `date` within the loaded week, `meal` and comma-separated `diet`. `SitePicker` has All / Colleges / University, search and any number of site checkboxes; on phones it rises from the foot. Nearest first requests location only on click, keeps it in memory, sorts by straight-line distance (`metresBetween()`) and shows that distance.

## Site and venue pages

Both use a banner across the page (a venue without a photo gets its type's tile as a short band instead), then a main column and a square map in a rail. A site's main column has its name, venue count, website and `VenueRow`s without the repeated site label, ordered Dining → Cafés → Bars. Its map fits the site's venues (`maxZoom` 17); a pin marks and scrolls to its row.

A venue starts with its site in Dark Cherry over its name, then types, formal hall (bow-tie mark) when applicable and rating when available. Diets appear in the details line only when known. Its rail has status and walk-in hours (only a link to send them when none are known), a menu calendar once there are menu dates, a square map centred on the venue, its location text and “Help fill this in”. The map includes the site's other venues and opens their pages on click. The rail sticks only when it fits (`useFits`); it never scrolls independently. On phones, hours come before menu sections, then details, map and help.

Hours show walk-in times for the current term/vacation period, falling back to the other period when only that is known. A venue serving more than one meal gets a row per meal (`mealHours()`): its name, each time, and that time's days (“Except Sat” within the table), with the days under the time when the rail is narrower than 17rem. A single-service venue groups days with identical times (`weekHours()`). What's served today is in ink, the rest muted. The table is the usual week: a change posted in today's menu notes is an amber “Today:” line under it, and `withDayTimes()` applies it to opening status everywhere (rows, map cards, the venue's status line). `formatDays()` writes one missing day as “Daily except Sat” or “Mon–Fri except Wed”. Formal hall has its own section.

Sections follow the venue's types:

- Dining shows a dated menu, with date controls and history from `useMenuDates()` / `useMenuOn()`. The date opens a calendar on phones. Meals appear one under another, headed by name and hours; there are no meal tabs. Viewing today, meals whose every sitting has ended fold to their heading (“Served earlier”), so the current or next meal is first in view; once all are over, none fold. A day's note giving a meal other times (“Dinner 18:00–18:45 this Monday”) heads that meal with them in amber (`--notice`), with the note and the usual times under it. A note marked as an alert (`menu_days.alert`: a disruption that day, such as a meal moved after a leak) gets the same box in red (`--alert`) with an alert icon; other notes (“Pie night”) stay small and muted. Course and section headings are smaller than dish names, in the venue type's colour (`.type-ink` under the section's `data-type`); diet codes are small tags (`Code`), Green-tinted for vegan, plant-based and vegetarian and grey for the rest; prices align at the right. Each price is said once, at the most general level it's true: a meal's in the meal heading, a course's (its list price, or one every dish in it shares) in the course heading, else each dish's on its row (`coursePrice()`). A meal with no dated dishes but its own posted list can show that list. A venue with no dated menu history can show its posted prices instead.
- Formal hall follows Dining, or comes first when it is all the venue holds: when, prices, guests, dress and booking, including unknown fields.
- Café and Bar show undated posted lists. `priceGroups()` splits lines by the services they belong to, puts course/meal prices beside dishes or in headings, and folds other items under “Deals and extras”. The first type's section is “Menu”; later ones use their type name. A café or bar with dated dishes also gets “Daily menu”. A single posted section, or a list with item descriptions, uses the full column width; multiple short sections can flow into two columns. Descriptions and choices sit beneath the dish name in smaller, muted text, with prices aligned beside the name.

Missing menus and price lists use `GapCard`: Light Blue, brief explanation, photo or typed text accepted, one pill action. A Dining menu without a price list says so once, in a Light Blue `GapLine` at the top of the menu; today's menu on a day without one has an inline contribution link. `venueGaps()` drives both the rail's help and Coverage; the rail's help leaves out what the page already asks for where it would be (the menu, a café or bar list, hours), and adds unknown diets except for bars.

An explicit dated meal cancellation (`No dinner – …` in the menu note, with no dishes) stays in the calendar and menu. Its heading says “Not served”, without the usual hours or prices; the note gives the published reason. Opening status excludes that meal on that date, and the hours rail includes the notice when it applies today. The usual weekly hours stay visible. A missing menu alone never means a cancelled service.

Reviews use `Reviews.tsx`: anonymous ratings after five members, newest six written reviews then “Show all”, and the member's own form when signed in. Signed out, the prompt to rate is a line with a secondary pill, quieter than the page's gaps. `RatingSummary` appears beside venue names; SEO includes `aggregateRating` when available.

## Coverage and information pages

Coverage has four counts (menus this week, café/bar price lists, hours, photos), followed by venue rows with gaps, each linking to the relevant `/send` form. `menuNote()` explains why menus are missing and links to adapter work when appropriate. `venueGaps()` prioritises menus, café/bar prices and hours, then Dining prices, formal details and photos; it does not ask members for a scripted menu. Filters (`site`, `kind`, `missing`, `order`) stay in the URL; show 24 rows at a time.

About explains the site, live coverage, ways to help and who makes it. Terms covers use, privacy, allergies, no affiliation and services that see visitors' IPs. Credits lists site and venue photos with author, licence and source.

## Visual conventions

`html { font-size: 90% }` scales rem sizes, including Tailwind. Quoted pixel sizes in comments assume 16px per rem; media-query rem breakpoints use the browser's default size. Use rem for layout; reserve px for hairlines, rings, shadows and map marks sized against the basemap.

`Container` aligns header and footer with 16/24/48px gutters and a 120rem maximum width. The finder uses those outer edges; other pages have a centred 76rem column, with a 22rem rail on large screens (17rem at tablet width). Lists and dated meals stay one column. Coverage counts, fixed price-list sections and reviews can use multiple columns.

Use Figtree for titles and venue names, Public Sans for body and controls, self-hosted through fontsource. Tokens in `index.css` use the University palette: Slate text, Cambridge Blue for selection, Green dot plus Dark Green “Open”, Dark Cherry site names (`--site-ink`), Cambridge Dark Blue for the primary action/focus, Warm Blue link underlines, and deeper Dark Blue backgrounds in dark mode. The site uses neither University branding marks nor its typeface.

Controls share heights through `Controls.tsx` and `.btn`, `.chip`, `.field`, `.icon-btn`. Actions are pills; ordinary controls use 8px corners and panels 12px. Avoid boxes inside boxes, tracked uppercase labels, arrows on buttons, and a hairline border plus wide shadow on the same box (`.raised` chooses one).

Icons come through `components/Icon.tsx` and `lib/icons.ts`: ForkKnife, HotDrink (cup and saucer), Wineglass2, custom BowTie. `TypeLabel` keeps names, glyphs and pin colours consistent. Type colours are Dining Crest, Café Green and Bar Indigo; these are the deliberate exception to avoiding indigo elsewhere. Status wording comes from `statusWords()`: “Open until …”, “Opens tomorrow …”, “Formal hall …”, never “opens” for a booked formal. The theme toggle shows the current theme (sun in light, moon in dark).

## Maps

`VenueMap` uses Apple MapKit JS when `VITE_MAPKIT_TOKEN` works, otherwise OpenFreeMap through dynamically imported MapLibre GL. Shared props, marks and framing live in `MapParts.tsx` and `mapView.ts`. Apple uses Standard style and `PointOfInterestFilter.excludingAllCategories` (the runtime name, unlike the typings' `filterExcludingAllCategories`), so its own points do not compete with venues. OpenFreeMap uses Bright / Fiord with attribution. Theme changes preserve camera and selection.

Each venue has one pin; never cluster them. `sideBySide()` offsets venues sharing a point or within 8 m (pair, triangle, then grid). Pins are 24px discs with white glyph/rim, sheen and shadow; dual-type venues split colours diagonally. Open status belongs in the list, not the pin. Selection is larger and ringed. Pin and user-dot origins must have zero size: MapKit measures rendered annotation size, so a sized origin can make marks drift.

At `LABEL_ZOOM` 15, and always for selection, `pinLabel()` adds a name with site context where needed, leaving the site out on an embedded map whose pins are all one site's. `placeLabels()` / `labelPins()` place it right or left without overlap. Preserve `labelUntilMeasured()`: MapKit reports movement before drawing, so labels need repeated measurement until projection and rendered widths agree.

Finder maps accept wheel and pinch with rotation disabled. Embedded site/venue maps let the wheel scroll the page. Desktop Safari pinch handling is in `mapGestures.ts` and bound only to the map; browser gestures elsewhere stay intact. Phone finder maps hide zoom buttons. Nearest first adds the user dot; standalone maps can have Near me and Show all controls.

`REACH` bounds zoom-out to the venue area plus about 600 m (Madingley Hall to the Biomedical Campus, Girton to Addenbrooke's). Minimum zoom depends on map size; MapKit uses the equivalent camera height and limits its centre. Widen it for a venue beyond those bounds. Finder fitting stops at zoom 15; site maps at 17; venue maps focus at street zoom.
