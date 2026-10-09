// What grub.cam knows about each college (or University site), and what's missing: the /coverage page, the footer
// count, and the note on a venue page that has never had a menu.
import type { Data } from './data.tsx'
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

/** A college missing something; `venues` names which of its places, for what's known place by place. */
export type Missing = { site: Site; venues: Venue[] }

export type Category = {
  title: string
  /** Counted on the loaded dates (`Data.menuFrom`–`menuTo`) */
  dated: boolean
  /** Counted by site (one that has any of its places with it counts) or place by place */
  unit: 'sites' | 'places'
  have: number
  of: number
  missing: Missing[]
}

/** One site and one category: whether all, some or none of the site's places of that kind have it ('na': it has none). */
export type Cell = { state: 'all' | 'some' | 'none' | 'na'; have: number; of: number; missing: Venue[] }
export type CoverageRow = { site: Site; cells: Cell[] }

const hasMenu = (v: Venue) => v.menu.some((d) => d.items.length)
/** A posted price list, or prices on the loaded menus */
const hasPrices = (v: Venue) => !!v.prices?.length || v.menu.some((d) => d.items.some((i) => i.price_gbp != null || i.price_text))
const ofType = (t: VenueType) => (v: Venue) => venueTypes(v).includes(t)
/** Where a daily menu is expected: Dining, but not a Hall used only for formal hall */
const servesMeals = (v: Venue) => v.type === 'hall' && !isFormalOnly(v)

/** What's tracked: which places it applies to, and what having it means. */
const CATEGORIES: { title: string; dated?: boolean; unit: Category['unit']; places: (v: Venue) => boolean; has: (v: Venue) => boolean }[] = [
  { title: 'Menus', dated: true, unit: 'sites', places: servesMeals, has: hasMenu },
  { title: 'Dining prices', unit: 'sites', places: ofType('hall'), has: hasPrices },
  { title: 'Café prices', unit: 'sites', places: ofType('cafe'), has: hasPrices },
  { title: 'Bar prices', unit: 'sites', places: ofType('bar'), has: hasPrices },
  { title: 'Hours', unit: 'places', places: () => true, has: (v) => v.slots.length > 0 },
  { title: 'Who can eat there', unit: 'places', places: () => true, has: (v) => v.access.level !== 'unknown' },
  { title: 'Card payments', unit: 'places', places: () => true, has: (v) => v.payment.bank_card != null },
]
export const CATEGORY_TITLES = CATEGORIES.map((c) => c.title)

const sitesOf = ({ sites, venues }: Pick<Data, 'sites' | 'venues'>, kind: Site['kind']) =>
  sites.filter((s) => s.kind === kind).map((site) => ({ site, venues: venues.filter((v) => v.site.slug === site.slug) }))

/** Each category's count across the colleges (or University sites): what has it, out of what could. */
export function coverage(data: Pick<Data, 'sites' | 'venues'>, kind: Site['kind'] = 'college'): Category[] {
  const sites = sitesOf(data, kind)
  return CATEGORIES.map(({ title, dated = false, unit, places, has }) => {
    const rows = sites.map((c) => ({ site: c.site, venues: c.venues.filter(places) })).filter((c) => c.venues.length)
    if (unit === 'sites') {
      const missing = rows.filter((c) => !c.venues.some(has))
      return { title, dated, unit, have: rows.length - missing.length, of: rows.length, missing }
    }
    const all = rows.flatMap((c) => c.venues)
    const missing = rows.map((c) => ({ site: c.site, venues: c.venues.filter((v) => !has(v)) })).filter((c) => c.venues.length)
    return { title, dated, unit, have: all.filter(has).length, of: all.length, missing }
  })
}

/** Site by site, each category (in CATEGORY_TITLES order) as a cell: all, some or none of its places, or none that apply. */
export function coverageMatrix(data: Pick<Data, 'sites' | 'venues'>, kind: Site['kind'] = 'college'): CoverageRow[] {
  return sitesOf(data, kind).map(({ site, venues }) => ({
    site,
    cells: CATEGORIES.map(({ places, has }) => {
      const mine = venues.filter(places)
      const missing = mine.filter((v) => !has(v))
      const have = mine.length - missing.length
      return { state: !mine.length ? 'na' : !missing.length ? 'all' : have ? 'some' : 'none', have, of: mine.length, missing }
    }),
  }))
}

/** The loaded menu dates, `menuTo` exclusive: "Thu 8 – Wed 14 Oct", or "8–14 Oct" when `short`. */
export function menuWindow({ menuFrom, menuTo }: Pick<Data, 'menuFrom' | 'menuTo'>, short = false): string {
  const last = addDaysISO(menuTo, -1)
  const sameMonth = menuFrom.slice(0, 7) === last.slice(0, 7)
  const weekday: Intl.DateTimeFormatOptions = short ? {} : { weekday: 'short' }
  const from = formatISODate(menuFrom, { ...weekday, day: 'numeric', ...(sameMonth ? {} : { month: 'short' }) })
  return `${from}${short && sameMonth ? '–' : ' – '}${formatISODate(last, { ...weekday, day: 'numeric', month: 'short' })}`
}
