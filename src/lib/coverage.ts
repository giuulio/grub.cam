// What grub.cam knows about each college, and what's missing: the /coverage page, the footer count, and the
// note on a venue page that has never had a menu.
import type { Data } from './data.tsx'
import { addDaysISO, formatISODate } from './time/clock.ts'
import type { Channel, Site, Venue, VenueType } from './types.ts'

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
  /** Menus and prices are only known for the loaded dates (`Data.menuFrom`–`menuTo`) */
  dated: boolean
  unit: 'colleges' | 'places'
  have: number
  of: number
  missing: Missing[]
}

const hasMenu = (v: Venue) => v.menu.some((d) => d.items.length)
const hasPrices = (v: Venue) => v.menu.some((d) => d.items.some((i) => i.price_gbp != null || i.price_text))

export function coverage({ sites, venues }: Pick<Data, 'sites' | 'venues'>): Category[] {
  const colleges = sites.filter((s) => s.kind === 'college').map((site) => ({ site, venues: venues.filter((v) => v.site.slug === site.slug) }))

  /** Counted by college: one that has any of `places` with `has` counts; colleges without such places don't. */
  const byCollege = (title: string, places: (v: Venue) => boolean, has: (v: Venue) => boolean): Category => {
    const rows = colleges.map((c) => ({ site: c.site, venues: c.venues.filter(places) })).filter((c) => c.venues.length)
    const missing = rows.filter((c) => !c.venues.some(has))
    return { title, dated: true, unit: 'colleges', have: rows.length - missing.length, of: rows.length, missing }
  }
  /** Counted place by place, listed by college. */
  const byPlace = (title: string, has: (v: Venue) => boolean): Category => {
    const all = colleges.flatMap((c) => c.venues)
    const missing = colleges.map((c) => ({ site: c.site, venues: c.venues.filter((v) => !has(v)) })).filter((c) => c.venues.length)
    return { title, dated: false, unit: 'places', have: all.filter(has).length, of: all.length, missing }
  }
  const ofType = (t: VenueType) => (v: Venue) => v.type === t

  return [
    byCollege('Menus', () => true, hasMenu),
    byCollege('Dining prices', ofType('hall'), hasPrices),
    byCollege('Café prices', ofType('cafe'), hasPrices),
    byCollege('Bar prices', ofType('bar'), hasPrices),
    byPlace('Hours', (v) => v.slots.length > 0),
    byPlace('Who can eat there', (v) => v.access.level !== 'unknown'),
    byPlace('Card payments', (v) => v.payment.bank_card != null),
  ]
}

/** The loaded menu dates, `menuTo` exclusive: "Thu 8 – Wed 14 Oct", or "8–14 Oct" when `short`. */
export function menuWindow({ menuFrom, menuTo }: Pick<Data, 'menuFrom' | 'menuTo'>, short = false): string {
  const last = addDaysISO(menuTo, -1)
  const sameMonth = menuFrom.slice(0, 7) === last.slice(0, 7)
  const weekday: Intl.DateTimeFormatOptions = short ? {} : { weekday: 'short' }
  const from = formatISODate(menuFrom, { ...weekday, day: 'numeric', ...(sameMonth ? {} : { month: 'short' }) })
  return `${from}${short && sameMonth ? '–' : ' – '}${formatISODate(last, { ...weekday, day: 'numeric', month: 'short' })}`
}
