// What search engines and AI agents read: each page's description and schema.org data, the sitemap, and
// llms.txt / llms-full.txt. Pure functions of the loaded data; scripts/prerender.ts writes them out at build time.
import type { Data } from './data.tsx'
import { DIET_SHORT, dishTags, MEAL_LABEL, MEALS, periodSlots, TYPE_LABEL } from './filters.ts'
import { SCOPES } from './finder.ts'
import { photoSrc, sitePhoto, venuePhoto } from './photos.ts'
import { dishPrice, formatGbp, mealPrices } from './prices.ts'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, siteName, sitePath, venuePath } from './site.ts'
import { formatDays, formatISODate } from './time/clock.ts'
import { isFormalOnly, venueTypes, type Day, type DietTag, type MenuDay, type Photo, type Site, type Slot, type Venue, type VenueType } from './types.ts'

/**
 * `image`: a photo for link previews (og:image); `jsonLd`: one or more schema.org things; `daily`: what the page shows
 * changes from day to day (a menu), so the sitemap dates it to the build, while the rest go without a date they don't have
 */
export type Page = { path: string; description: string; jsonLd?: object | object[]; image?: string; daily?: boolean }

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
const holdsFormal = (v: Venue) => !!v.formal || v.slots.some((s) => s.meal === 'formal')
const hasMenu = (v: Venue) => v.menu.some((d) => d.items.length)
const hasPrices = (v: Venue) => !!v.prices?.length || v.menu.some((d) => d.items.some((i) => i.price_gbp != null))
/** "a, b and c" */
const list = (parts: string[]) => parts.join(', ').replace(/, ([^,]*)$/, ' and $1')
/** "Jesus College, Cambridge"; a University site is already in Cambridge by name, so it's placed by the University */
const placed = (s: Site) => (s.kind === 'college' ? `${siteName(s)}, Cambridge` : `${siteName(s)}, University of Cambridge`)

// Page titles: what people search for first (the place, "menu today", "opening hours", "prices", "formal hall",
// "Cambridge"), the site's name last. The pages set them; the prerenderer lifts them into <head>.

/** The front page and its tabs. */
export const TAB_TITLES: Record<string, string> = {
  '/': `Cambridge college menus, cafés and bars today · ${SITE_NAME}`,
  '/dining': `Cambridge college hall and canteen menus today, and meal times · ${SITE_NAME}`,
  '/cafes': `Cambridge college and University cafés: opening hours and prices · ${SITE_NAME}`,
  '/bars': `Cambridge college bars: opening hours and drink prices · ${SITE_NAME}`,
  '/formal': `Cambridge college formal hall: nights, prices and dress code · ${SITE_NAME}`,
}

/** "Jesus College, Cambridge: dining hall menus, café and bar opening hours · grub.cam", from what the site has. */
export function siteTitle(s: Site, venues: Venue[]): string {
  const kinds = new Set(venues.flatMap(venueTypes))
  const parts = [kinds.has('hall') && 'dining hall menus', kinds.has('cafe') && 'café', kinds.has('bar') && 'bar'].filter((x): x is string => !!x)
  return `${placed(s)}: ${parts.length ? `${list(parts)} ` : ''}opening hours · ${SITE_NAME}`
}

/** "Caff, Jesus College, Cambridge: menu today and opening hours · grub.cam", from what the venue is and has. */
export function venueTitle(v: Venue): string {
  const what =
    v.type === 'hall' && isFormalOnly(v) ? 'formal hall nights, price and dress code'
    : hasMenu(v) ? `menu today, opening hours${hasPrices(v) ? ' and prices' : ''}`
    : `${TYPE_LABEL[v.type].toLowerCase()} opening hours${hasPrices(v) ? ' and prices' : ''}`
  return `${v.name}, ${placed(v.site)}: ${what} · ${SITE_NAME}`
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
  const menu = hasMenu(v) ? ` Today's menu dish by dish${hasPrices(v) ? ', with prices' : ''}.` : v.prices?.length ? ' Menu and prices as posted.' : ''
  const kinds = venueTypes(v).map((t) => (t === 'hall' ? 'dining hall' : TYPE_LABEL[t].toLowerCase()))
  const formal = v.type === 'hall' && isFormalOnly(v)
  return clip(`${v.name}, ${placed(v.site)}: ${formal ? 'formal hall' : list(kinds)}. ${hours ? `${formal ? 'Nights' : 'Open'} ${hours}.` : 'Opening hours not published yet.'}${menu}`)
}

function venueJsonLd(v: Venue, date: string): object {
  const dates = [...new Set(menusOf(v).map((d) => d.date))].slice(0, MENU_DAYS_IN_JSONLD)
  const sections = menusOf(v).filter((d) => dates.includes(d.date))
  return {
    '@context': 'https://schema.org',
    '@type': TYPE_SCHEMA[v.type],
    name: v.name,
    url: abs(venuePath(v)),
    sameAs: v.url ?? undefined,
    containedInPlace: { '@type': siteType(v.site), name: siteName(v.site), url: abs(sitePath(v.site)) },
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

/** Every page worth indexing, with its description and structured data. Titles come from the pages themselves. */
export function pages(data: Data, date: string): Page[] {
  const organization = { '@type': 'Organization', name: SITE_NAME, url: abs('/') }
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
  const sendPage: Page = { path: '/send', description: 'Send a menu board, price list or opening times from a Cambridge college café, hall or bar, as a photo or as text, to add it to grub.cam.' }
  const sites = data.sites.map((s): Page => {
    const mine = data.venues.filter((v) => v.site.slug === s.slug)
    // "Caff (dining hall), Hall (formal hall), The Roost (bar)"
    const named = mine.map((v) => `${v.name} (${v.type === 'hall' && isFormalOnly(v) ? 'formal hall' : list(venueTypes(v).map((t) => (t === 'hall' ? 'dining hall' : TYPE_LABEL[t].toLowerCase())))})`)
    return {
      path: sitePath(s),
      daily: mine.some(hasMenu),
      description: clip(`Where to eat and drink at ${placed(s)}: ${named.join(', ')}. Today's menus, opening hours and prices.`),
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': siteType(s),
          name: siteName(s),
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
  const tags = [
    `<meta name="description" content="${escapeAttr(page.description)}" />`,
    // Large image previews in results (a page's photo), otherwise Google's defaults
    '<meta name="robots" content="max-image-preview:large" />',
    `<link rel="canonical" href="${escapeAttr(url)}" />`,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    `<meta property="og:description" content="${escapeAttr(page.description)}" />`,
    `<meta property="og:url" content="${escapeAttr(url)}" />`,
    `<meta name="twitter:card" content="${page.image ? 'summary_large_image' : 'summary'}" />`,
  ]
  if (page.image) tags.push(`<meta property="og:image" content="${escapeAttr(page.image)}" />`)
  // "<" escaped so a dish name can't close the script tag
  if (page.jsonLd) tags.push(`<script type="application/ld+json">${JSON.stringify(page.jsonLd).replace(/</g, '\\u003c')}</script>`)
  return tags.join('\n    ')
}

/** Every page; only those with a menu carry the build's date, since a lastmod that's always today is one Google ignores. */
export function sitemap(list: Page[], lastmod: string): string {
  const urls = list.map((p) => `  <url><loc>${abs(p.path)}</loc>${p.daily ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`).join('\n')
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
      .map((s) => `- [${siteName(s)}](${abs(sitePath(s))}): ${data.venues.filter((v) => v.site.slug === s.slug).map((v) => v.name).join(', ')}`)
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
const priceText = (gbp: number | null | undefined, second?: number | null, tiers?: string[]) => {
  const other = second != null ? `${(tiers?.[1] ?? 'non-members').toLowerCase()} ${formatGbp(second)}` : ''
  return gbp == null ? other : `${formatGbp(gbp)}${other ? ` (${other})` : ''}`
}

function menuLine(d: MenuDay, v: Venue): string {
  const m = mealPrices(v.prices, d.service)
  const dishes = d.items.map((i) => {
    const tags = dishTags(i.tags).map((t) => DIET_SHORT[t])
    const p = dishPrice(i, m)
    const price = p?.gbp != null ? ` ${priceText(p.gbp, p.second, v.price_terms?.tiers)}` : p?.text ? ` ${p.text}` : ''
    return `${i.name}${tags.length ? ` [${tags.join(' ')}]` : ''}${price}`
  })
  return `- ${day(d.date)}, ${MEAL_LABEL[d.service].toLowerCase()}: ${dishes.join('; ')}`
}

/** llms-full.txt: every venue with its hours and the menus loaded at build time, as plain text. */
export function llmsFullTxt(data: Data, date: string, builtAt: string): string {
  const out = [`# ${SITE_NAME}: every venue, its hours and menus`, `Built ${builtAt} (Europe/London) from ${abs('/')}. Diet codes: ${(Object.keys(DIET_SHORT) as DietTag[]).map((t) => `${DIET_SHORT[t]} ${t.replace('_', '-')}`).join(', ')}.`, NOTES.join(' ')]
  for (const s of data.sites) {
    out.push(`## ${siteName(s)}\n\n${abs(sitePath(s))}`)
    for (const v of data.venues.filter((x) => x.site.slug === s.slug)) {
      const hours = hoursText(periodSlots(v.slots, date))
      const lines = [`### ${v.name} (${venueTypes(v).map((t) => TYPE_LABEL[t].toLowerCase()).join(', ')})`, abs(venuePath(v)), `Hours: ${hours || 'not published'}`]
      const menus = menusOf(v)
      if (menus.length) lines.push(`Menus:\n${menus.map((d) => menuLine(d, v)).join('\n')}`)
      if (v.prices?.length) {
        const when = v.prices.map((p) => p.observed_on).sort().at(-1)!
        const list = v.prices.map((p) => `- ${p.section ? `${p.section}: ` : ''}${p.name}${p.description ? ` — ${p.description}` : ''}${p.tags.length ? ` [${dishTags(p.tags).map((t) => DIET_SHORT[t]).join(' ')}]` : ''} ${priceText(p.price_gbp, p.non_member_gbp, v.price_terms?.tiers)}${p.services ? ` [${p.services.map((m) => MEAL_LABEL[m].toLowerCase()).join(', ')}]` : ''}`)
        lines.push(`Prices as posted ${day(when)}:\n${list.join('\n')}`)
      }
      out.push(lines.join('\n'))
    }
  }
  return out.join('\n\n') + '\n'
}
