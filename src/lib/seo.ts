// What search engines and AI agents read: each page's description and schema.org data, the sitemap, and
// llms.txt / llms-full.txt. Pure functions of the loaded data; scripts/prerender.ts writes them out at build time.
import type { Data } from './data.tsx'
import { DIET_SHORT, dishTags, MEAL_LABEL, MEALS, periodSlots, TYPE_LABEL } from './filters.ts'
import { SCOPES } from './finder.ts'
import { photoSrc, sitePhoto, venuePhoto } from './photos.ts'
import { dishPrice, formatGbp, mealPrices } from './prices.ts'
import { formalBooking, formalDress, formalPrice } from './formal.ts'
import { alternateNames, SITE_DESCRIPTION, SITE_NAME, SITE_URL, siteName, sitePath, siteSearchName, venuePath } from './site.ts'
import { dailyMeals, hasFormalMenu, hasMenu, hasPrices, holdsFormal, kindWords, list, mealWords, placed as placedIn } from './summary.ts'
import { formatDays, formatISODate } from './time/clock.ts'
import { isFormalOnly, venueTypes, type Day, type DietTag, type MenuDay, type Photo, type Site, type Slot, type Venue, type VenueType } from './types.ts'

/**
 * `image`: a photo for link previews (og:image); `jsonLd`: one or more schema.org things; `daily`: what the page shows
 * changes from day to day (a menu), so the sitemap dates it to the build, while the rest go without a date they don't have
 */
export type Page = { path: string; description: string; jsonLd?: object | object[]; image?: string; daily?: boolean; noindex?: boolean }

const TYPE_SCHEMA: Record<VenueType, string> = { hall: 'FoodEstablishment', cafe: 'CafeOrCoffeeShop', bar: 'BarOrPub' }
const DAY_SCHEMA: Record<Day, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' }
const DIET_SCHEMA: Partial<Record<DietTag, string>> = {
  vegan: 'https://schema.org/VeganDiet',
  vegetarian: 'https://schema.org/VegetarianDiet',
  halal: 'https://schema.org/HalalDiet',
  gluten_free: 'https://schema.org/GlutenFreeDiet',
  kosher: 'https://schema.org/KosherDiet',
}
/** Menus in structured data: the next few days, so venue pages stay small. */
const MENU_DAYS_IN_JSONLD = 3

const abs = (path: string) => SITE_URL + path
const siteType = (s: Site) => (s.kind === 'college' ? 'CollegeOrUniversity' : 'Place')
const day = (iso: string) => formatISODate(iso, { weekday: 'short', day: 'numeric', month: 'short' })
/** "Jesus College, Cambridge"; a University site is already in Cambridge by name, so it's placed by the University */
const placed = (s: Site) => (s.kind === 'college' ? `${siteSearchName(s)}, Cambridge` : `${siteSearchName(s)}, University of Cambridge`)

// Page titles: what people search for first (the venue or site, its meals' menus, "formal hall", "opening times" as
// people in Britain search it, "prices", "Cambridge"), the site's name last. The pages set them; the prerenderer lifts
// them into <head>.

/** The front page and its tabs. */
export const TAB_TITLES: Record<string, string> = {
  '/': `Cambridge food map: college menus, cafés and bars · ${SITE_NAME}`,
  '/dining': `Cambridge college menus and meal times · ${SITE_NAME}`,
  '/cafes': `Cambridge college and University cafés: opening hours and prices · ${SITE_NAME}`,
  '/bars': `Cambridge college bars: opening hours and drink prices · ${SITE_NAME}`,
  '/formal': `Cambridge college formal hall: nights, prices and dress code · ${SITE_NAME}`,
}

/** "Jesus College, Cambridge: dining hall menus, formal hall, café and bar opening times · grub.cam", from what the site has. */
export function siteTitle(s: Site, venues: Venue[]): string {
  const daily = venues.filter((v) => !(v.type === 'hall' && isFormalOnly(v)))
  const kinds = new Set(daily.flatMap(venueTypes))
  const hall = s.kind === 'college' ? 'dining hall' : 'canteen'
  const menus = kinds.has('hall') && daily.some(hasMenu)
  // Things in their own right, then the kinds whose opening times it gives
  const things = [menus && `${hall} menus`, venues.some(holdsFormal) && 'formal hall'].filter((x): x is string => !!x)
  const timed = [kinds.has('hall') && !menus && hall, kinds.has('cafe') && 'café', kinds.has('bar') && 'bar'].filter((x): x is string => !!x)
  const what = timed.length ? `${list([...things, ...timed])} opening times` : list([...things, 'opening times'])
  return `${placed(s)}: ${what} · ${SITE_NAME}`
}

/**
 * "Caff, Jesus College, Cambridge: lunch and dinner menus, prices and opening times · grub.cam", from what the venue
 * is and has: the meals it serves, its formal hall, its prices.
 */
export function venueTitle(v: Venue): string {
  if (v.type === 'hall' && isFormalOnly(v)) return `${v.name}, ${placed(v.site)}: formal hall ${hasFormalMenu(v) ? 'menu, ' : ''}nights, price and dress code · ${SITE_NAME}`
  const meals = mealWords(v)
  const menu = hasMenu(v)
  const parts = [
    menu ? (v.type === 'hall' ? `${meals ? `${meals} ` : ''}menus` : `${kindWords(v)} menu`) : `${kindWords(v)} opening times`,
    hasPrices(v) && (v.type === 'bar' && !menu ? 'drink prices' : 'prices'),
    holdsFormal(v) && 'formal hall',
    menu && 'opening times',
  ].filter((x): x is string => !!x)
  return `${v.name}, ${placed(v.site)}: ${list(parts)} · ${SITE_NAME}`
}

/** Home › Jesus College › Caff, for a rich result's breadcrumb. */
function breadcrumbs(trail: [name: string, path: string][]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [['Home', '/'] as [string, string], ...trail].map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(path) })),
  }
}

/** "Lunch Mon–Fri 12:00–13:45; Dinner Daily 17:40–18:40" (the meal only when there's more than one). */
export function hoursText(slots: Slot[]): string {
  const meals = new Set(slots.map((s) => s.meal)).size > 1
  return slots.map((s) => `${meals ? `${MEAL_LABEL[s.meal]} ` : ''}${formatDays(s.days)} ${s.start}–${s.end}`).join('; ')
}

/** A venue's menus with dishes, by date then meal. */
const menusOf = (v: Venue) => v.menu.filter((d) => d.items.length).sort((a, b) => a.date.localeCompare(b.date) || MEALS.indexOf(a.service) - MEALS.indexOf(b.service))

const clip = (s: string, n = 160) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/[\s,;]+\S*$/, '')}…`)

function venueDescription(v: Venue, date: string): string {
  const hours = hoursText(periodSlots(v.slots, date))
  const today = v.menu.some((d) => d.date === date && d.items.length)
  // "Today's lunch and dinner menus": the meals with dishes today
  const meals = dailyMeals(v).filter((m) => v.menu.some((d) => d.date === date && d.service === m && d.items.length)).map((m) => MEAL_LABEL[m].toLowerCase())
  const todays = `Today's ${meals.length ? `${list(meals)} ` : ''}${meals.length > 1 ? 'menus' : 'menu'}`
  const menu = hasMenu(v) ? `${today ? todays : 'Published menus'}${hasPrices(v) ? ' and prices' : ''}. ` : v.prices?.length ? 'Menu and prices as posted. ' : ''
  const formal = v.type === 'hall' && isFormalOnly(v)
  // A formal hall's dress, price and booking, as far as they're published
  const f = v.formal
  const details = formal && f ? [formalDress(f), formalPrice(f), formalBooking(f) && `Book: ${formalBooking(f)}`].filter(Boolean).map((s) => `${s}. `).join('') : ''
  const aliases = alternateNames(v)
  const name = `${v.name}${aliases.length ? ` (${aliases[0]})` : ''}`
  const what = formal ? 'formal hall' : `${kindWords(v)}${holdsFormal(v) ? ' and formal hall' : ''}`
  return clip(`${name}, ${placed(v.site)}: ${what}. ${menu}${hours ? `${formal ? 'Nights' : 'Open'} ${hours}. ` : 'Opening hours not published yet. '}${details}`.trim())
}

function venueJsonLd(v: Venue, date: string): object {
  const dates = [...new Set(menusOf(v).map((d) => d.date))].slice(0, MENU_DAYS_IN_JSONLD)
  const sections = menusOf(v).filter((d) => dates.includes(d.date))
  return {
    '@context': 'https://schema.org',
    '@type': TYPE_SCHEMA[v.type],
    name: v.name,
    alternateName: alternateNames(v).length ? alternateNames(v) : undefined,
    url: abs(venuePath(v)),
    sameAs: v.url ?? undefined,
    containedInPlace: { '@type': siteType(v.site), name: siteName(v.site), alternateName: alternateNames(v.site).length ? alternateNames(v.site) : undefined, url: abs(sitePath(v.site)) },
    address: { '@type': 'PostalAddress', streetAddress: [v.where, siteName(v.site)].filter(Boolean).join(', '), addressLocality: 'Cambridge', addressCountry: 'GB' },
    geo: v.latitude != null && v.longitude != null ? { '@type': 'GeoCoordinates', latitude: v.latitude, longitude: v.longitude } : undefined,
    // Members' rating, once there are 5 reviews (the same rule as the page)
    aggregateRating: v.rating ? { '@type': 'AggregateRating', ratingValue: v.rating.average.toFixed(1), reviewCount: v.rating.reviews, bestRating: 5, worstRating: 1 } : undefined,
    openingHoursSpecification: periodSlots(v.slots, date).map((s) => ({ '@type': 'OpeningHoursSpecification', name: MEAL_LABEL[s.meal], dayOfWeek: s.days.map((d) => DAY_SCHEMA[d]), opens: s.start, closes: s.end })),
    image: venueImage(v),
    hasMenu: sections.length
      ? {
          '@type': 'Menu',
          hasMenuSection: sections.map((d) => ({
            '@type': 'MenuSection',
            name: `${MEAL_LABEL[d.service]}, ${formatISODate(d.date, { weekday: 'long', day: 'numeric', month: 'long' })}`,
            hasMenuItem: d.items.map((i) => ({ i, price: dishPrice(i, mealPrices(v.prices, d.service))?.gbp })).map(({ i, price }) => ({
              '@type': 'MenuItem',
              name: i.name,
              suitableForDiet: dietUrls(i.tags),
              offers: price != null ? { '@type': 'Offer', price: price.toFixed(2), priceCurrency: 'GBP' } : undefined,
            })),
          })),
        }
      : undefined,
  }
}

/** A photo at the largest width up to 1600px, for link previews and structured data. */
function imageOf(p: Photo | undefined): string | undefined {
  const src = p && photoSrc(p, p.widths.filter((w) => w <= 1600).at(-1) ?? p.widths[0])
  // Link previews need an absolute URL; photos are served from the site itself unless VITE_PHOTOS_URL says otherwise
  return src && (src.startsWith('/') ? abs(src) : src)
}
const venueImage = (v: Venue) => imageOf(venuePhoto(v))

function dietUrls(tags: DietTag[]): string[] | undefined {
  const urls = tags.flatMap((t) => DIET_SCHEMA[t] ?? [])
  return urls.length ? urls : undefined
}

/** Every rendered page, with its description, indexing policy and structured data. Titles come from the pages themselves. */
export function pages(data: Data, date: string): Page[] {
  const organization = { '@type': 'Organization', name: SITE_NAME, url: abs('/'), logo: abs('/logo.png') }
  const home: Page = {
    path: '/',
    daily: true,
    description: SITE_DESCRIPTION,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: abs('/'),
      description: SITE_DESCRIPTION,
      inLanguage: 'en-GB',
      publisher: organization,
      potentialAction: { '@type': 'SearchAction', target: `${abs('/')}?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
    },
  }
  // The front page's other tabs: Dining, Cafés, Bars, Formal hall, each listing its venues for search engines
  const TABS: Record<string, (v: Venue) => boolean> = {
    '/dining': (v) => venueTypes(v).includes('hall') && !isFormalOnly(v),
    '/cafes': (v) => venueTypes(v).includes('cafe'),
    '/bars': (v) => venueTypes(v).includes('bar'),
    '/formal': holdsFormal,
  }
  const tabs = SCOPES.filter((s) => s.path !== '/').map((s): Page => {
    const mine = data.venues.filter(TABS[s.path])
    return {
      path: s.path,
      description: s.description,
      daily: mine.some(hasMenu),
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: TAB_TITLES[s.path].replace(` · ${SITE_NAME}`, ''),
        url: abs(s.path),
        numberOfItems: mine.length,
        itemListElement: mine.map((v, i) => ({ '@type': 'ListItem', position: i + 1, name: `${v.name}, ${siteName(v.site)}`, url: abs(venuePath(v)) })),
      },
    }
  })
  const about: Page = { path: '/about', description: 'What grub.cam is, where its opening hours and menus come from, and how to help build it.' }
  const contribute: Page = { path: '/contribute', description: "Help fill in grub.cam: what it has for Cambridge's college and University venues, the colleges by how complete they are, who has sent in the most, and every venue still missing something, with the way to send it in." }
  const terms: Page = { path: '/terms', description: "grub.cam's terms of use and privacy: information as published by each venue, no cookies, no tracking." }
  const credits: Page = { path: '/credits', description: 'Who took the photos of venues on grub.cam, and the open licences they share them under.' }
  const sendPage: Page = { path: '/send', noindex: true, description: 'Send a menu board, price list or opening times from a Cambridge college café, hall or bar, as a photo or as text, to add it to grub.cam.' }
  const sites = data.sites.map((s): Page => {
    const mine = data.venues.filter((v) => v.site.slug === s.slug)
    // "Caff (dining hall), Hall (formal hall), The Roost (bar)"
    const named = mine.map((v) => `${v.name} (${v.type === 'hall' && isFormalOnly(v) ? 'formal hall' : kindWords(v)})`)
    return {
      path: sitePath(s),
      daily: mine.some(hasMenu),
      // Menus and prices only where it has them
      description: clip(`Where to eat and drink at ${placedIn(s)}: ${named.join(', ')}. ${mine.some(hasMenu) ? `Today's menus, opening hours${mine.some(hasPrices) ? ' and prices' : ''}` : mine.some(hasPrices) ? 'Opening hours and prices' : 'Opening hours, as each venue publishes them'}.`),
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': siteType(s),
          name: siteName(s),
          alternateName: alternateNames(s).length ? alternateNames(s) : undefined,
          url: abs(sitePath(s)),
          containsPlace: mine.map((v) => ({ '@type': TYPE_SCHEMA[v.type], name: v.name, url: abs(venuePath(v)) })),
          ...(imageOf(sitePhoto(s)) ? { image: imageOf(sitePhoto(s)) } : {}),
        },
        breadcrumbs([[siteName(s), sitePath(s)]]),
      ],
      image: imageOf(sitePhoto(s)),
    }
  })
  const venues = data.venues.map((v): Page => ({
    path: venuePath(v),
    daily: hasMenu(v),
    description: venueDescription(v, date),
    jsonLd: [venueJsonLd(v, date), breadcrumbs([[siteName(v.site), sitePath(v.site)], [v.name, venuePath(v)]])],
    image: venueImage(v),
  }))
  return [home, ...tabs, about, contribute, terms, credits, sendPage, ...sites, ...venues]
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
/**
 * "Today’s", "St John’s", "Queens’", "Café ’84": a description's straight apostrophes as typographic ones. Google has shown a
 * plain "'" in our descriptions as a literal "&#39;" in its snippets (Oct 2026); a ’ is never escaped, so it can't be.
 */
const curly = (s: string) => s.replace(/(?<=[\p{L}\p{N}])'|'(?=\d)/gu, '’').replace(/'/g, '‘')
const unescapeText = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')

/**
 * What React's renderToString hoists to the front of a page: its <title>, and a <link rel="preload"> for an image
 * fetched with high priority (a page's banner photo), in either order. They belong in <head>, not in the body: left
 * there, the page's <title> is empty.
 */
const HOISTED = /^(?:<title>.*?<\/title>|<(?:link|meta)\b[^>]*\/?>)+/s

/** Splits a rendered page into its title (as text), the other hoisted tags (for the <head>) and the body. */
export function splitHoisted(out: string): { title: string; head: string; html: string } {
  const lead = out.match(HOISTED)?.[0] ?? ''
  const title = lead.match(/<title>(.*?)<\/title>/s)
  return { title: title ? unescapeText(title[1]) : '', head: lead.replace(/<title>.*?<\/title>/s, ''), html: out.slice(lead.length) }
}

/** The <head> tags for one prerendered page (besides <title>). */
export function headTags(page: Page, title: string): string {
  const url = abs(page.path)
  const description = escapeAttr(curly(page.description))
  const tags = [
    `<meta name="description" content="${description}" />`,
    // Large image previews in results (a page's photo), otherwise Google's defaults
    `<meta name="robots" content="${page.noindex ? 'noindex' : 'max-image-preview:large'}" />`,
    `<link rel="canonical" href="${escapeAttr(url)}" />`,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${escapeAttr(url)}" />`,
    `<meta name="twitter:card" content="${page.image ? 'summary_large_image' : 'summary'}" />`,
  ]
  if (page.image) tags.push(`<meta property="og:image" content="${escapeAttr(page.image)}" />`)
  // "<" escaped so a dish name can't close the script tag
  if (page.jsonLd) tags.push(`<script type="application/ld+json">${JSON.stringify(page.jsonLd).replace(/</g, '\\u003c')}</script>`)
  return tags.join('\n    ')
}

/** Indexable pages; only those with a menu carry the build's date, since a lastmod that's always today is one Google ignores. */
export function sitemap(list: Page[], lastmod: string): string {
  const urls = list.filter((p) => !p.noindex).map((p) => `  <url><loc>${abs(p.path)}</loc>${p.daily ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

const NOTES = [
  'Times are Europe/London. Menus are only what each venue has published; nothing is projected.',
  '"Hours not published" means unknown, not closed.',
  'Every page is plain HTML with schema.org data (opening hours, menus with diet tags).',
  'Not affiliated with the University of Cambridge or its colleges.',
]

/** llms.txt (llmstxt.org): what the site is, and a link to every college and University site. */
export function llmsTxt(data: Data): string {
  const list = (kind: Site['kind']) =>
    data.sites
      .filter((s) => s.kind === kind)
      .map((s) => `- [${siteSearchName(s)}](${abs(sitePath(s))}): ${data.venues.filter((v) => v.site.slug === s.slug).map((v) => v.name).join(', ')}`)
      .join('\n')
  return [
    `# ${SITE_NAME}`,
    `> ${SITE_DESCRIPTION} Menus are re-checked several times a day from each venue's own published source.`,
    NOTES.map((n) => `- ${n}`).join('\n'),
    `## Colleges\n\n${list('college')}`,
    `## University\n\n${list('university')}`,
    `## Optional\n\n- [Everything as text](${abs('/llms-full.txt')}): every venue's hours and published menus for the coming week`,
  ].join('\n\n') + '\n'
}

/** "£3.75", or "£3.75 (non-members £5.65)", the second named as the venue names it; "students £21.00" for a second price alone */
const priceText = (gbp: number | null | undefined, second?: number | null, tiers?: string[], secondText?: string | null) => {
  const value = second != null ? formatGbp(second) : secondText
  const other = value ? `${(tiers?.[1] ?? 'non-members').toLowerCase()} ${value}` : ''
  return gbp == null ? other : `${formatGbp(gbp)}${other ? ` (${other})` : ''}`
}

function menuLine(d: MenuDay, v: Venue): string {
  const m = mealPrices(v.prices, d.service)
  const dishes = d.items.map((i) => {
    const tags = dishTags(i.tags).map((t) => DIET_SHORT[t])
    const p = dishPrice(i, m)
    const price = p?.gbp != null ? ` ${priceText(p.gbp, p.second, v.price_terms?.tiers, p.secondText)}` : p?.text ? ` ${p.text}` : ''
    return `${i.name}${tags.length ? ` [${tags.join(' ')}]` : ''}${price}`
  })
  return `- ${day(d.date)}, ${MEAL_LABEL[d.service].toLowerCase()}: ${dishes.join('; ')}`
}

/** llms-full.txt: every venue with its hours and the menus loaded at build time, as plain text. */
export function llmsFullTxt(data: Data, date: string, builtAt: string): string {
  const out = [`# ${SITE_NAME}: every venue, its hours and menus`, `Built ${builtAt} (Europe/London) from ${abs('/')}. Diet codes: ${(Object.keys(DIET_SHORT) as DietTag[]).map((t) => `${DIET_SHORT[t]} ${t.replace('_', '-')}`).join(', ')}.`, NOTES.join(' ')]
  for (const s of data.sites) {
    out.push(`## ${siteSearchName(s)}\n\n${abs(sitePath(s))}`)
    if (alternateNames(s).length) out.push(`Also known as: ${alternateNames(s).join(', ')}`)
    for (const v of data.venues.filter((x) => x.site.slug === s.slug)) {
      const hours = hoursText(periodSlots(v.slots, date))
      const lines = [`### ${v.name} (${venueTypes(v).map((t) => TYPE_LABEL[t].toLowerCase()).join(', ')})`, abs(venuePath(v)), `Hours: ${hours || 'not published'}`]
      if (alternateNames(v).length) lines.push(`Also listed as: ${alternateNames(v).join(', ')}`)
      const menus = menusOf(v)
      if (menus.length) lines.push(`Menus:\n${menus.map((d) => menuLine(d, v)).join('\n')}`)
      if (v.prices?.length) {
        const when = v.prices.map((p) => p.observed_on).sort().at(-1)!
        const list = v.prices.map((p) => `- ${p.section ? `${p.section}: ` : ''}${p.name}${p.description ? ` — ${p.description}` : ''}${p.tags.length ? ` [${dishTags(p.tags).map((t) => DIET_SHORT[t]).join(' ')}]` : ''} ${priceText(p.price_gbp, p.non_member_gbp, v.price_terms?.tiers, p.non_member_text)}${p.services ? ` [${p.services.map((m) => MEAL_LABEL[m].toLowerCase()).join(', ')}]` : ''}`)
        lines.push(`Prices as posted ${day(when)}:\n${list.join('\n')}`)
      }
      out.push(lines.join('\n'))
    }
  }
  return out.join('\n\n') + '\n'
}
