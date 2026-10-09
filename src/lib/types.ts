// Shapes the app reads from Supabase (supabase/migrations). Menu shapes come from the ingest schema.
import type { Channel, DietTag, Meal, MenuDay, PriceCourse } from '../../scripts/schema.ts'

export type { Channel, DietTag, Dish, Meal, MenuDay, PriceCourse } from '../../scripts/schema.ts'

export type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export const DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export type AccessLevel = 'public' | 'university' | 'members_guests' | 'members_only' | 'unknown'
export type VenueType = 'hall' | 'cafe' | 'bar'

export type Slot = { meal: Meal; days: Day[]; start: string; end: string; period: 'term' | 'vacation' | 'all' }

/** What a venue is: its type (its icon), plus café or bar when it has those hours, as a café that's a bar by night does. */
export function venueTypes(v: { type: VenueType; slots: Slot[] }): VenueType[] {
  const also = (['cafe', 'bar'] as const).filter((t) => t !== v.type && v.slots.some((s) => s.meal === (t === 'cafe' ? 'snacks' : 'bar')))
  return [v.type, ...also]
}

/**
 * A Hall used only for formal hall (St John's Hall, Christ's Hall, ...): its only hours are formal; or it has no hours,
 * holds formal and isn't in the menu source registry, which lists every venue serving daily meals (sources.ts).
 * A cafeteria whose hours aren't published (Girton's) isn't one.
 */
export function isFormalOnly(v: { formal?: object; slots: Slot[]; menu_channel?: string | null }): boolean {
  return v.slots.length ? v.slots.every((s) => s.meal === 'formal') : !!v.formal && !v.menu_channel
}

/** Where venues belong: a college, or a University site (West Cambridge, Sidgwick, a museum, ...). */
export type Site = { slug: string; name: string; short_name: string | null; kind: 'college' | 'university'; official_dining_url: string | null; aliases?: string[] }

/**
 * One line of the price list posted at a venue (venue_prices). With a `course`, the price of the day's dishes of that course
 * (or of the whole meal); without, something sold at those meals. `services`: the meals it applies to, null for all.
 */
export type VenuePrice = {
  section: string | null
  name: string
  /** The first price posted; none when only the second tier's is (a student's guest, priced for students only) */
  price_gbp: number | null
  /** The top of a range ("£3.24–£3.96") */
  price_max_gbp?: number | null
  /** The second price posted: the venue's second tier (`PriceTerms.tiers`), non-members' by default */
  non_member_gbp: number | null
  services: Meal[] | null
  course: PriceCourse | null
  tags: DietTag[]
  observed_on: string
  /** A URL, or where it was seen */
  source: string
}

/** What a member needs to know to go to formal hall (`formals`); every field may be unknown. Days with a published start are 'formal' slots. */
export type Formal = {
  /** Days when there's no slot because the start isn't published */
  days?: Day[] | null
  /** Members' gowns */
  gowns?: 'required' | 'optional' | null
  dress_code?: 'black_tie' | 'formal' | 'smart' | 'relaxed' | null
  guests_allowed?: boolean | null
  /** Per member */
  guests_max?: number | null
  /** The booking system, by name ("UPay") */
  book_via?: string | null
  /** With `book_by` (HH:MM): book by then, this many days before */
  book_days_before?: number | null
  book_by?: string | null
  /** The formal hall's own page */
  url?: string | null
  price_gbp?: number | null
  guest_gbp?: number | null
  prices_seen?: string | null
}

/** A photo of the venue (`venue_photos`): files at `<VITE_PHOTOS_URL>/<path>-<width>.webp`, one per width. */
export type Photo = {
  path: string
  widths: number[]
  width: number
  height: number
  color: string | null
  alt: string
  /** Who took it, shown with it */
  credit: string | null
  /** "CC BY-SA 2.0", "CC0", "Public domain"; none for our own */
  licence: string | null
  /** Where it came from: its Wikimedia Commons page, or "own photo" */
  source: string | null
}

/** How a venue posts its prices (`venues.price_terms`), in its own words. */
export type PriceTerms = {
  /** Who the first and second posted prices are for, as the venue heads them: ["Members", "Non-members"], ["Senior", "Student"] */
  tiers?: string[]
  /** The rule for anyone else, or how its prices work: "Students get 25% off with their University Card." */
  note?: string
  source?: string
}

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
  /** Verified venue or containing-building point, never a college/site centroid. */
  latitude?: number | null
  longitude?: number | null
  location_source?: string | null
  access: { level: AccessLevel }
  /** true or false where known: a bank card, the University (or college) card, cash */
  payment: { bank_card?: boolean; university_card?: boolean; cash?: boolean }
  dietary: { tags: DietTag[] }
  site: Site
  slots: Slot[]
  /** How the venue publishes its menu (scripts/ingest/sources.ts); unset for most cafés and bars. */
  menu_channel?: Channel | null
  price_terms?: PriceTerms | null
  menu_url?: string | null
  /** Fetched by `npm run ingest`, rather than transcribed by hand */
  menu_scripted?: boolean
  /** Holds formal hall (`formals`), whether or not its days and times are published as 'formal' slots */
  formal?: Formal
  /** Approved photos of the venue, in order */
  photos?: Photo[]
  /** As posted, in order; empty when no one has reported it */
  prices?: VenuePrice[]
  /** Menu days from today for the next week (`useMenuOn` reaches beyond it). */
  menu: MenuDay[]
}
