// A venue or site in words: what it is and which meals it serves. The words in its title and description, so a page says
// what people search for ("Jesus College lunch menu", "Wolfson formal hall", "Kettle's Yard café opening times"). Built
// from the data only, never the clock, so it prerenders.
import { TYPE_LABEL } from './filters.ts'
import { siteSearchName } from './site.ts'
import { venueTypes, type Meal, type Site, type Venue } from './types.ts'

/** The meals a dining hall serves, in the day's order. */
const DAILY: Meal[] = ['breakfast', 'brunch', 'lunch', 'dinner']

/** "a, b and c"; an item may have commas of its own ("Mon, Wed 18:00–19:30") */
export const list = (parts: string[]) => (parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : (parts[0] ?? ''))

export const holdsFormal = (v: Venue) => !!v.formal || v.slots.some((s) => s.meal === 'formal')
export const hasMenu = (v: Venue) => v.menu.some((d) => d.items.length)
export const hasPrices = (v: Venue) => !!v.prices?.length || v.menu.some((d) => d.items.some((i) => i.price_gbp != null))
export const hasFormalMenu = (v: Venue) => v.menu.some((d) => d.service === 'formal' && d.items.length)

/** Breakfast, brunch, lunch, dinner: those it has hours or a menu for, whatever the term. */
export function dailyMeals(v: Venue): Meal[] {
  if (v.type !== 'hall') return []
  const served = new Set<Meal>([...v.slots.map((s) => s.meal), ...v.menu.filter((d) => d.items.length).map((d) => d.service)])
  return DAILY.filter((m) => served.has(m))
}

/** "dining hall" (a University site's is a "canteen"), "café", "bar and café": what it is, its own type first. */
export function kindWords(v: Venue): string {
  return list(venueTypes(v).map((t) => (t === 'hall' ? (v.site.kind === 'college' ? 'dining hall' : 'canteen') : TYPE_LABEL[t].toLowerCase())))
}

/** "the Sidgwick Site", "the University Library", but "West Cambridge", "Kettle's Yard", "The Fitzwilliam Museum" */
const the = (s: Site) => (s.kind === 'university' && /^(Department|Centre|Cambridge University)\b|(Site|Library|Campus)$/.test(s.name) ? 'the ' : '')
const theSite = (s: Site) => `${the(s)}${siteSearchName(s)}`

/** "St Edmund's College (Eddies), Cambridge", "the Sidgwick Site, University of Cambridge" */
export const placed = (s: Site) => `${theSite(s)}, ${s.kind === 'college' ? 'Cambridge' : 'University of Cambridge'}`

