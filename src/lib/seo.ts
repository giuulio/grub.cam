// What search engines and AI agents read: each page's description and schema.org data, the sitemap, and
// llms.txt / llms-full.txt. Pure functions of the loaded data; scripts/prerender.ts writes them out at build time.
import type { Data } from './data.tsx'
import { DIET_SHORT, dishTags, MEAL_LABEL, MEALS, periodSlots, TYPE_LABEL } from './filters.ts'
import { photoSrc, sitePhoto, venuePhoto } from './photos.ts'
import { dishPrice, formatGbp, mealPrices } from './prices.ts'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, siteName, sitePath, venuePath } from './site.ts'
import { formatDays, formatISODate } from './time/clock.ts'
import { venueTypes, type Day, type DietTag, type MenuDay, type Photo, type Site, type Slot, type Venue, type VenueType } from './types.ts'

/** `image`: a photo for link previews (og:image) */
export type Page = { path: string; description: string; jsonLd?: object; image?: string }

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
  const menu = v.menu.some((d) => d.items.length) ? ' Menu dish by dish.' : v.prices?.length ? ' Menu with prices.' : ''
  const types = venueTypes(v).map((t) => TYPE_LABEL[t].toLowerCase()).join(' and ')
  return clip(`${v.name}, ${siteName(v.site)}, Cambridge: ${types}. ${hours ? `Open ${hours}.` : 'Hours not published.'}${menu}`)
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
  const home: Page = {
    path: '/',
    description: SITE_DESCRIPTION,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: abs('/'),
      description: SITE_DESCRIPTION,
      potentialAction: { '@type': 'SearchAction', target: `${abs('/explore')}?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
    },
  }
  const explore: Page = { path: '/explore', description: "Every Cambridge college and University dining hall, café and bar on a map: what's open now, and menus by date, meal and diet." }
  const about: Page = { path: '/about', description: "What grub.cam is, and where its opening hours and menus come from." }
  const coverage: Page = { path: '/coverage', description: "What grub.cam has for each Cambridge college (menus, prices, hours) and what's still missing." }
  const directory: Page = { path: '/directory', description: 'Every Cambridge college and University site, museum and garden, with its dining halls, cafés and bars, opening hours and published menus.' }
  const terms: Page = { path: '/terms', description: "grub.cam's terms of use and privacy: information as published by each venue, no cookies, no tracking." }
  const credits: Page = { path: '/credits', description: 'Who took the photos of venues on grub.cam, and the open licences they share them under.' }
  const sendPage: Page = { path: '/send', description: 'Send a photo of a menu board, price list or opening times from a Cambridge college café, hall or bar, to add it to grub.cam.' }
  const sites = data.sites.map((s): Page => {
    const mine = data.venues.filter((v) => v.site.slug === s.slug)
    return {
      path: sitePath(s),
      description: clip(`${siteName(s)}, Cambridge: ${mine.map((v) => v.name).join(', ')}. Opening hours and menus.`),
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': siteType(s),
        name: siteName(s),
        url: abs(sitePath(s)),
        containsPlace: mine.map((v) => ({ '@type': TYPE_SCHEMA[v.type], name: v.name, url: abs(venuePath(v)) })),
        ...(imageOf(sitePhoto(s)) ? { image: imageOf(sitePhoto(s)) } : {}),
      },
      image: imageOf(sitePhoto(s)),
    }
  })
  const venues = data.venues.map((v): Page => ({ path: venuePath(v), description: venueDescription(v, date), jsonLd: venueJsonLd(v, date), image: venueImage(v) }))
  return [home, explore, directory, about, coverage, terms, credits, sendPage, ...sites, ...venues]
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/** The <head> tags for one prerendered page (besides <title>). */
export function headTags(page: Page, title: string): string {
  const url = abs(page.path)
  const tags = [
    `<meta name="description" content="${escapeAttr(page.description)}" />`,
    `<link rel="canonical" href="${escapeAttr(url)}" />`,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    `<meta property="og:description" content="${escapeAttr(page.description)}" />`,
    `<meta property="og:url" content="${escapeAttr(url)}" />`,
  ]
  if (page.image) tags.push(`<meta property="og:image" content="${escapeAttr(page.image)}" />`, '<meta name="twitter:card" content="summary_large_image" />')
  // "<" escaped so a dish name can't close the script tag
  if (page.jsonLd) tags.push(`<script type="application/ld+json">${JSON.stringify(page.jsonLd).replace(/</g, '\\u003c')}</script>`)
  return tags.join('\n    ')
}

export function sitemap(list: Page[], lastmod: string): string {
  const urls = list.map((p) => `  <url><loc>${abs(p.path)}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')
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
        const list = v.prices.map((p) => `- ${p.section ? `${p.section}: ` : ''}${p.name}${p.tags.length ? ` [${dishTags(p.tags).map((t) => DIET_SHORT[t]).join(' ')}]` : ''} ${priceText(p.price_gbp, p.non_member_gbp, v.price_terms?.tiers)}${p.services ? ` [${p.services.map((m) => MEAL_LABEL[m].toLowerCase()).join(', ')}]` : ''}`)
        lines.push(`Prices as posted ${day(when)}:\n${list.join('\n')}`)
      }
      out.push(lines.join('\n'))
    }
  }
  return out.join('\n\n') + '\n'
}
