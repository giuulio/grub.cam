// Shapes the app reads from Supabase (supabase/migrations). Menu shapes come from the ingest schema.
import type { Channel, DietTag, Meal, MenuDay } from '../../scripts/schema.ts'

export type { Channel, DietTag, Dish, Meal, MenuDay } from '../../scripts/schema.ts'

export type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export const DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export type AccessLevel = 'public' | 'university' | 'members_guests' | 'members_only' | 'unknown'
export type VenueType = 'hall' | 'cafe' | 'bar' | 'other'

export type Slot = { meal: Meal; days: Day[]; start: string; end: string; period: 'term' | 'vacation' | 'all' }

/** What a venue is: its type (its icon), plus café or bar when it has those hours, as a café that's a bar by night does. */
export function venueTypes(v: { type: VenueType; slots: Slot[] }): VenueType[] {
  const also = (['cafe', 'bar'] as const).filter((t) => t !== v.type && v.slots.some((s) => s.meal === (t === 'cafe' ? 'snacks' : 'bar')))
  return [v.type, ...also]
}

/** Where venues belong: a college, or a University site (West Cambridge, Sidgwick, a museum, ...). */
export type Site = { slug: string; name: string; short_name: string | null; kind: 'college' | 'university'; official_dining_url: string | null; aliases?: string[] }

export type Venue = {
  id: string
  slug: string
  name: string
  aliases?: string[]
  type: VenueType
  /** The venue's own page, when it has one */
  url: string | null
  where: string | null
  serves: string | null
  access: { level: AccessLevel }
  payment: { bank_card?: boolean }
  dietary: { tags: DietTag[] }
  site: Site
  slots: Slot[]
  /** How the venue publishes its menu (scripts/ingest/sources.ts); unset for most cafés and bars. */
  menu_channel?: Channel | null
  menu_url?: string | null
  /** Fetched by `npm run ingest`, rather than transcribed by hand */
  menu_scripted?: boolean
  /** Holds formal hall (`formals`), whether or not its days and times are published as 'formal' slots */
  formal?: boolean
  /** Menu days from today for the next week (`useMenuOn` reaches beyond it). */
  menu: MenuDay[]
}
