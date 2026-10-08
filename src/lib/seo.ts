// What search engines and AI agents read: each page's description and schema.org data, the sitemap, and
// llms.txt / llms-full.txt. Pure functions of the loaded data; scripts/prerender.ts writes them out at build time.
import type { Data } from './data.tsx'
import { ACCESS_LABEL, DIET_SHORT, dishTags, MEAL_LABEL, MEALS, periodSlots, TYPE_LABEL } from './filters.ts'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, siteName, sitePath, venuePath } from './site.ts'
import { formatDays, formatISODate } from './time/clock.ts'
import type { Day, DietTag, MenuDay, Site, Slot, Venue, VenueType } from './types.ts'

export type Page = { path: string; description: string; jsonLd?: object }

const TYPE_SCHEMA: Record<VenueType, string> = { hall: 'FoodEstablishment', cafe: 'CafeOrCoffeeShop', bar: 'BarOrPub', other: 'Place' }
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
  const menu = v.menu.some((d) => d.items.length) ? ' Menu dish by dish.' : ''
  return clip(`${v.name}, ${siteName(v.site)}, Cambridge: ${TYPE_LABEL[v.type].toLowerCase()}. ${hours ? `Open ${hours}.` : 'Hours not published.'}${menu}`)
}

function venueJsonLd(v: Venue, date: string): object {
  const level = v.access.level
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
    publicAccess: level === 'public' ? true : level === 'members_only' || level === 'university' ? false : undefined,
    paymentAccepted: v.payment.bank_card ? 'Credit card, Debit card' : undefined,
    hasMenu: sections.length
      ? {
          '@type': 'Menu',
          hasMenuSection: sections.map((d) => ({
            '@type': 'MenuSection',
            name: `${MEAL_LABEL[d.service]}, ${formatISODate(d.date, { weekday: 'long', day: 'numeric', month: 'long' })}`,
            hasMenuItem: d.items.map((i) => ({
              '@type': 'MenuItem',
              name: i.name,
              suitableForDiet: dietUrls(i.tags),
              offers: i.price_gbp != null ? { '@type': 'Offer', price: i.price_gbp.toFixed(2), priceCurrency: 'GBP' } : undefined,
            })),
          })),
        }
      : undefined,
  }
}

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
      potentialAction: { '@type': 'SearchAction', target: `${abs('/')}?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
    },
  }
  const about: Page = { path: '/about', description: "What grub.cam is, and where its opening hours and menus come from." }
  const coverage: Page = { path: '/coverage', description: "What grub.cam has for each Cambridge college (menus, prices, hours, access, card payments) and what's still missing." }
  const sites = data.sites.map((s): Page => {
    const mine = data.venues.filter((v) => v.site.slug === s.slug)
    return {
      path: sitePath(s),
      description: clip(`${siteName(s)}, Cambridge: ${mine.map((v) => v.name).join(', ')}. Opening hours, who can get in, and menus.`),
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': siteType(s),
        name: siteName(s),
        url: abs(sitePath(s)),
        containsPlace: mine.map((v) => ({ '@type': TYPE_SCHEMA[v.type], name: v.name, url: abs(venuePath(v)) })),
      },
    }
  })
  const venues = data.venues.map((v): Page => ({ path: venuePath(v), description: venueDescription(v, date), jsonLd: venueJsonLd(v, date) }))
  return [home, about, coverage, ...sites, ...venues]
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
    `## Optional\n\n- [Everything as text](${abs('/llms-full.txt')}): every venue's hours, access and published menus for the coming week`,
  ].join('\n\n') + '\n'
}

function menuLine(d: MenuDay): string {
  const dishes = d.items.map((i) => {
    const tags = dishTags(i.tags).map((t) => DIET_SHORT[t])
    return tags.length ? `${i.name} [${tags.join(' ')}]` : i.name
  })
  return `- ${day(d.date)}, ${MEAL_LABEL[d.service].toLowerCase()}: ${dishes.join('; ')}`
}

/** llms-full.txt: every venue with its hours, access and the menus loaded at build time, as plain text. */
export function llmsFullTxt(data: Data, date: string, builtAt: string): string {
  const out = [`# ${SITE_NAME}: every venue, its hours and menus`, `Built ${builtAt} (Europe/London) from ${abs('/')}. Diet codes: ${(Object.keys(DIET_SHORT) as DietTag[]).map((t) => `${DIET_SHORT[t]} ${t.replace('_', '-')}`).join(', ')}.`, NOTES.join(' ')]
  for (const s of data.sites) {
    out.push(`## ${siteName(s)}\n\n${abs(sitePath(s))}`)
    for (const v of data.venues.filter((x) => x.site.slug === s.slug)) {
      const hours = hoursText(periodSlots(v.slots, date))
      const lines = [`### ${v.name} (${TYPE_LABEL[v.type].toLowerCase()})`, abs(venuePath(v)), `Hours: ${hours || 'not published'}`]
      if (v.access.level !== 'unknown') lines.push(`Access: ${ACCESS_LABEL[v.access.level].toLowerCase()}`)
      if (v.payment.bank_card) lines.push('Bank card accepted')
      const menus = menusOf(v)
      if (menus.length) lines.push(`Menus:\n${menus.map(menuLine).join('\n')}`)
      out.push(lines.join('\n'))
    }
  }
  return out.join('\n\n') + '\n'
}
