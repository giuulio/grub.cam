// What grub.cam knows about each college (or University site), and what's missing: the /coverage page, the footer
// count, the "Help fill this in" card on a venue's page, and the note on one that has never had a menu.
import type { Data } from './data.tsx'
import { venuePhoto } from './photos.ts'
import type { sendPath } from './site.ts'
import { addDaysISO, formatISODate } from './time/clock.ts'
import { isFormalOnly, venueTypes, type Channel, type Site, type Venue, type VenueType } from './types.ts'

/** Why a venue has no menu here: published online but not here; posted for members only; not published anywhere known. */
export type MenuGap = 'online' | 'members' | 'unpublished'

const MEMBERS: Channel[] = ['intranet', 'app', 'email']

/** Undefined when the venue has no known menu source (most cafés and bars). */
export function menuGap(v: Venue): MenuGap | undefined {
  if (!v.menu_channel) return undefined
  if (MEMBERS.includes(v.menu_channel)) return 'members'
  if (v.menu_channel === 'none' || v.menu_channel === 'unknown') return 'unpublished'
  return 'online'
}

/** A college missing something; `venues` names which of its venues, for what's known venue by venue. */
export type Missing = { site: Site; venues: Venue[] }

export type Category = {
  title: string
  /** Counted on the loaded dates (`Data.menuFrom`–`menuTo`) */
  dated: boolean
  /** Counted by site (one that has any of its venues with it counts) or venue by venue */
  unit: 'sites' | 'venues'
  have: number
  of: number
  missing: Missing[]
}

const hasMenu = (v: Venue) => v.menu.some((d) => d.items.length)
/** A posted price list, or prices on the loaded menus */
const hasPrices = (v: Venue) => !!v.prices?.length || v.menu.some((d) => d.items.some((i) => i.price_gbp != null || i.price_text))
const ofType = (t: VenueType) => (v: Venue) => venueTypes(v).includes(t)
/** Where a daily menu is expected: Dining, but not a Hall used only for formal hall */
const servesMeals = (v: Venue) => v.type === 'hall' && !isFormalOnly(v)
const holdsFormal = (v: Venue) => !!v.formal || v.slots.some((s) => s.meal === 'formal')

/** What's tracked: which venues it applies to, and what having it means. */
const CATEGORIES: { title: string; dated?: boolean; unit: Category['unit']; applies: (v: Venue) => boolean; has: (v: Venue) => boolean }[] = [
  { title: 'Menus', dated: true, unit: 'sites', applies: servesMeals, has: hasMenu },
  { title: 'Dining prices', unit: 'sites', applies: ofType('hall'), has: hasPrices },
  { title: 'Café prices', unit: 'sites', applies: ofType('cafe'), has: hasPrices },
  { title: 'Bar prices', unit: 'sites', applies: ofType('bar'), has: hasPrices },
  { title: 'Hours', unit: 'venues', applies: () => true, has: (v) => v.slots.length > 0 },
]

const sitesOf = ({ sites, venues }: Pick<Data, 'sites' | 'venues'>, kind: Site['kind']) =>
  sites.filter((s) => s.kind === kind).map((site) => ({ site, venues: venues.filter((v) => v.site.slug === site.slug) }))

/** Each category's count across the colleges (or University sites): what has it, out of what could. */
export function coverage(data: Pick<Data, 'sites' | 'venues'>, kind: Site['kind'] = 'college'): Category[] {
  const sites = sitesOf(data, kind)
  return CATEGORIES.map(({ title, dated = false, unit, applies, has }) => {
    const rows = sites.map((c) => ({ site: c.site, venues: c.venues.filter(applies) })).filter((c) => c.venues.length)
    if (unit === 'sites') {
      const missing = rows.filter((c) => !c.venues.some(has))
      return { title, dated, unit, have: rows.length - missing.length, of: rows.length, missing }
    }
    const all = rows.flatMap((c) => c.venues)
    const missing = rows.map((c) => ({ site: c.site, venues: c.venues.filter((v) => !has(v)) })).filter((c) => c.venues.length)
    return { title, dated, unit, have: all.filter(has).length, of: all.length, missing }
  })
}

/** The loaded menu dates, `menuTo` exclusive: "Thu 8 – Wed 14 Oct", or "8–14 Oct" when `short`. */
export function menuWindow({ menuFrom, menuTo }: Pick<Data, 'menuFrom' | 'menuTo'>, short = false): string {
  const last = addDaysISO(menuTo, -1)
  const sameMonth = menuFrom.slice(0, 7) === last.slice(0, 7)
  const weekday: Intl.DateTimeFormatOptions = short ? {} : { weekday: 'short' }
  const from = formatISODate(menuFrom, { ...weekday, day: 'numeric', ...(sameMonth ? {} : { month: 'short' }) })
  return `${from}${short && sameMonth ? '–' : ' – '}${formatISODate(last, { ...weekday, day: 'numeric', month: 'short' })}`
}

/** How many venues have something, out of those it applies to: a line on the front page, a count on /coverage. */
export type Counter = { what: string; have: number; of: number; noun: string }

const counter = (venues: Venue[], what: string, noun: string, applies: (v: Venue) => boolean, has: (v: Venue) => boolean): Counter => {
  const mine = venues.filter(applies)
  return { what, noun, have: mine.filter(has).length, of: mine.length }
}

/** What the front page says is still missing under a tab: how many of its venues have what matters most there. */
export type TabCoverage = Counter

/** Menus this week for Dining (and everything, where they're what people come for); price lists for cafés and bars; formal hall's price. */
export function tabCoverage(venues: Venue[], scope: 'all' | VenueType | 'formal'): TabCoverage {
  if (scope === 'cafe') return counter(venues, 'Price lists', 'cafés', ofType('cafe'), hasPrices)
  if (scope === 'bar') return counter(venues, 'Price lists', 'bars', ofType('bar'), hasPrices)
  if (scope === 'formal') return counter(venues, 'Prices', 'formal halls', holdsFormal, (v) => v.formal?.price_gbp != null)
  return counter(venues, 'Menus this week', 'dining venues', servesMeals, hasMenu)
}

/** The four counts /coverage leads with, each `dated` when it's about the loaded week. */
export function overallCoverage(venues: Venue[]): (Counter & { dated: boolean })[] {
  return [
    { ...counter(venues, 'Menus this week', 'dining halls', servesMeals, hasMenu), dated: true },
    { ...counter(venues, 'Price lists', 'cafés and bars', (v) => ofType('cafe')(v) || ofType('bar')(v), hasPrices), dated: false },
    { ...counter(venues, 'Opening hours', 'venues', () => true, (v) => v.slots.length > 0), dated: false },
    { ...counter(venues, 'Photos', 'venues', () => true, (v) => !!venuePhoto(v)), dated: false },
  ]
}

/** Something a venue's page is missing, and the way to send it in: /send's `kind`, and how much the site gains by it. */
export type Gap = { kind: 'menu' | 'prices' | 'hours' | 'formal' | 'photo'; label: string; send: Parameters<typeof sendPath>[1]; weight: number }

/**
 * What a venue is still missing, most worth having first: a dining hall's menu (the thing people come for; not asked
 * where a script fetches it), a café's or bar's price list and any venue's hours (what "open now" rests on), then a
 * hall's price list, formal hall's price or time, and a photo. Empty when it's all here.
 */
export function venueGaps(v: Venue): Gap[] {
  const gaps: Gap[] = []
  if (servesMeals(v) && !v.menu_scripted && !hasMenu(v)) gaps.push({ kind: 'menu', label: 'The menu board', send: 'menu', weight: 4 })
  if (!v.prices?.length) gaps.push({ kind: 'prices', label: v.type === 'bar' ? 'The drinks list' : 'The price list', send: 'prices', weight: v.type === 'hall' ? 1 : 3 })
  if (!v.slots.length) gaps.push({ kind: 'hours', label: 'The opening times', send: 'hours', weight: 3 })
  if (holdsFormal(v) && (v.formal?.price_gbp == null || !v.slots.some((s) => s.meal === 'formal'))) gaps.push({ kind: 'formal', label: 'Formal hall: the price or the time', send: 'other', weight: 1 })
  if (!venuePhoto(v)) gaps.push({ kind: 'photo', label: 'A photo of the venue', send: 'photo', weight: 1 })
  return gaps.sort((a, b) => b.weight - a.weight)
}

/**
 * Why a dining venue's menu isn't here, for whoever could change that: for members only (a photo of the board is the
 * only way in), online but copied by hand (a script would keep it current), or not published anywhere known.
 */
export function menuNote(v: Venue): { text: string; script?: boolean } | undefined {
  const gap = menuGap(v)
  if (!gap || v.menu_scripted) return undefined
  if (gap === 'members') return { text: 'Its menu is for members only, so a photo of the board is the only way it gets here.' }
  if (gap === 'unpublished') return { text: 'Its menu isn’t published anywhere we know of: a photo of the board is the only way.' }
  return { text: 'Its menu is online, but copied here by hand each week; a script would keep it current.', script: true }
}
