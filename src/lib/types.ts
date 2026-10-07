// Shapes the app reads from Supabase (supabase/migrations). Menu shapes come from the ingest schema.
import type { DietTag, Meal, MenuDay } from '../../scripts/schema.ts'

export type { DietTag, Dish, Meal, MenuDay } from '../../scripts/schema.ts'

export type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export const DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export type AccessLevel = 'public' | 'members_guests' | 'members_only' | 'unknown'
export type VenueType = 'hall' | 'cafe' | 'bar' | 'other'

export type Slot = { meal: Meal; days: Day[]; start: string; end: string; period: 'term' | 'vacation' | 'all' }

export type College = { slug: string; name: string; short_name: string | null; official_dining_url: string | null }

export type Venue = {
  id: string
  slug: string
  name: string
  type: VenueType
  where: string | null
  serves: string | null
  access: { level: AccessLevel }
  payment: { bank_card?: boolean }
  dietary: { tags: DietTag[] }
  college: College
  slots: Slot[]
  /** Menu days from today for the next week, by date. */
  menu: MenuDay[]
}
