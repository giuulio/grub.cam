import { DAYS, venueTypes, type AccessLevel, type DietTag, type Dish, type Meal, type MenuDay, type Slot, type Venue, type VenueType } from './types.ts'
import type { LocalNow } from './time/clock.ts'
import { openStatus, statusRank, type OpenStatus } from './time/openNow.ts'
import { isFullTerm } from './time/termDates.ts'
import { compareSearchHits, normalizeSearch, searchVenues, type SearchHit } from './search.ts'

export const MEALS: Meal[] = ['breakfast', 'brunch', 'lunch', 'dinner', 'formal', 'snacks', 'bar']
export const MEAL_LABEL: Record<Meal, string> = { breakfast: 'Breakfast', brunch: 'Brunch', lunch: 'Lunch', dinner: 'Dinner', formal: 'Formal', snacks: 'Café', bar: 'Bar' }

export const DIET_LABEL: Record<DietTag, string> = {
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  plant_based: 'Plant-based',
  halal: 'Halal',
  gluten_free: 'Gluten-free',
  kosher: 'Kosher',
  pescatarian: 'Pescatarian',
  dairy_free: 'Dairy-free',
}

/** Menu codes, explained in a key under each day's menu. */
export const DIET_SHORT: Record<DietTag, string> = { vegan: 'VG', plant_based: 'PB', vegetarian: 'V', pescatarian: 'P', gluten_free: 'GF', dairy_free: 'DF', halal: 'H', kosher: 'K' }
const DIET_ORDER = Object.keys(DIET_SHORT) as DietTag[]

/** A dish's tags to show, in a fixed order: only the strictest of vegan/plant-based/vegetarian/pescatarian. */
export function dishTags(tags: DietTag[]): DietTag[] {
  const has = (t: DietTag) => tags.includes(t)
  const hidden = new Set<DietTag>()
  if (has('vegan')) hidden.add('plant_based')
  if (has('vegan') || has('plant_based')) hidden.add('vegetarian')
  if (has('vegan') || has('plant_based') || has('vegetarian')) hidden.add('pescatarian')
  return DIET_ORDER.filter((t) => has(t) && !hidden.has(t))
}

export const ACCESS_LABEL: Record<AccessLevel, string> = { public: 'Open to all', university: 'University members', members_guests: 'Members + guests', members_only: 'Members only', unknown: 'Access unknown' }

export const TYPES: VenueType[] = ['hall', 'cafe', 'bar', 'other']

/** The hours that apply around `date` (term or vacation), meal by meal, then by first day. */
export function periodSlots(slots: Slot[], date: string): Slot[] {
  const period = isFullTerm(date) ? 'term' : 'vacation'
  return slots
    .filter((s) => s.period === 'all' || s.period === period)
    .sort((a, b) => MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal) || DAYS.indexOf(a.days[0]) - DAYS.indexOf(b.days[0]))
}
export const TYPE_LABEL: Record<VenueType, string> = { hall: 'Dining', cafe: 'Café', bar: 'Bar', other: 'Other' }

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** The venue's type, unless its name already says it ("College Bar", "Iris Café"). */
export const typeNote = (v: Pick<Venue, 'name' | 'type'>) => (fold(v.name).includes(fold(TYPE_LABEL[v.type])) ? undefined : TYPE_LABEL[v.type])

export type Filters = {
  meal?: Meal
  date: string // ISO date being viewed
  type?: VenueType
  site?: string // site slug
  diets: DietTag[]
  nonMemberOk: boolean
  bankCard: boolean
  openNow: boolean
  q: string
}

export const DEFAULT_FILTERS: Omit<Filters, 'date'> = { diets: [], nonMemberOk: false, bankCard: false, openNow: false, q: '' }

export function menuDaysFor(v: Venue, date: string, meal?: Meal): MenuDay[] {
  return v.menu.filter((d) => d.date === date && (!meal || d.service === meal))
}

export function matchesDiet(v: Venue, days: MenuDay[], diets: DietTag[]): boolean {
  if (!diets.length) return true
  const venueLevel = dishMatches({ name: '', tags: v.dietary.tags }, { q: '', diets })
  const dishLevel = days.some((d) => d.items.some((i) => dishMatches(i, { q: '', diets })))
  return days.length ? dishLevel || (venueLevel && v.type !== 'hall') : venueLevel
}

/** Dish matches the query (substring, lowercased) and every selected diet (vegan counts as vegetarian). */
export function dishMatches(i: Dish, f: Pick<Filters, 'q' | 'diets'>): boolean {
  const q = f.q.trim().toLowerCase()
  return (!q || i.name.toLowerCase().includes(q)) && f.diets.every((t) => i.tags.includes(t) || (t === 'vegetarian' && i.tags.includes('vegan')))
}

/** Date of the service the status points at: the one on now, opening next, or next after closing. */
export function serviceDate(s: OpenStatus): string | undefined {
  if (s.kind === 'open' || s.kind === 'opening') return s.date
  if (s.kind === 'closed') return s.next?.date
}

export type Ranked = { venue: Venue; status: OpenStatus; days: MenuDay[]; matchedDishes: number; search?: SearchHit; searchMatches: SearchHit[] }

/** How results are grouped, in ranking order. Unknown hours are their own group, never "closed". */
export type Section = 'open' | 'later' | 'other' | 'unknown'
export const SECTIONS: Section[] = ['open', 'later', 'other', 'unknown']
export const SECTION_LABEL: Record<Section, string> = { open: 'Open now', later: 'Later today', other: 'Other days', unknown: 'Hours not published' }
export const sectionOf = (s: OpenStatus): Section => (s.kind === 'open' ? 'open' : s.kind === 'opening' ? 'later' : s.kind === 'closed' ? 'other' : 'unknown')

/** The menu for the service the status points at, else the first menu that day. */
export function nextService({ status: s, days }: Pick<Ranked, 'status' | 'days'>): MenuDay | undefined {
  const slot = s.kind === 'open' || s.kind === 'opening' ? s.slot : s.kind === 'closed' ? s.next?.slot : undefined
  const withItems = days.filter((d) => d.items.length)
  return withItems.find((d) => d.service === slot?.meal) ?? withItems[0]
}

export function applyFilters(venues: Venue[], f: Filters, now: LocalNow): Ranked[] {
  const searching = !!normalizeSearch(f.q)
  const kept = new Map<string, Omit<Ranked, 'searchMatches'>>()
  for (const v of venues) {
    if (f.type && !venueTypes(v).includes(f.type)) continue
    if (f.site && v.site.slug !== f.site) continue
    if (f.nonMemberOk && !(v.access.level === 'public' || v.access.level === 'members_guests')) continue
    if (f.bankCard && v.payment.bank_card !== true) continue
    const meals = f.meal ? [f.meal] : undefined
    const status = openStatus(v.slots, now, meals)
    // Viewing today: menus follow the service the status points at, so after tonight's last service it's tomorrow's menu.
    const date = !searching && f.date === now.date ? (serviceDate(status) ?? f.date) : f.date
    const days = menuDaysFor(v, date, f.meal)
    if (!matchesDiet(v, days, f.diets)) continue
    days.sort((a, b) => MEALS.indexOf(a.service) - MEALS.indexOf(b.service))
    if (f.openNow && status.kind !== 'open') continue
    // If a meal is selected and the venue neither serves it (no slot) nor has a menu for it, drop it; formal hall
    // counts where it's held even when its days aren't published
    if (f.meal && !v.slots.some((s) => s.meal === f.meal) && !days.length && !(f.meal === 'formal' && v.formal)) continue
    const matchedDishes = days.reduce((n, d) => n + d.items.filter((i) => dishMatches(i, { diets: f.diets, q: '' })).length, 0)
    kept.set(v.id, { venue: v, status, days, matchedDishes })
  }
  // Searches see the places left, and only dishes on the date viewed, at the meal and with every diet picked.
  const hits = searching
    ? searchVenues(venues, f.q, (d) => kept.has(d.venue.id) && (!d.dish || (d.date === f.date && (!f.meal || d.service === f.meal) && dishMatches(d.dish, { q: '', diets: f.diets }))))
    : undefined
  const out: Ranked[] = []
  for (const r of kept.values()) {
    const matches = hits?.get(r.venue.id) ?? []
    if (hits && !matches.length) continue
    out.push({ ...r, search: matches[0], searchMatches: matches.filter((hit) => hit.dish) })
  }
  out.sort((a, b) => {
    if (a.search && b.search) {
      const relevance = compareSearchHits(a.search, b.search)
      if (relevance) return relevance
    }
    const r = statusRank(a.status) - statusRank(b.status)
    if (r) return r
    if (a.status.kind === 'open' && b.status.kind === 'open') return a.status.closesInMin - b.status.closesInMin
    const t = TYPES.indexOf(a.venue.type) - TYPES.indexOf(b.venue.type)
    if (t) return t
    if (b.matchedDishes !== a.matchedDishes) return b.matchedDishes - a.matchedDishes
    return a.venue.site.name.localeCompare(b.venue.site.name)
  })
  return out
}
