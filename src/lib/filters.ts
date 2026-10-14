import { DAYS, venueTypes, type Day, type DietTag, type Dish, type Meal, type MenuDay, type Site, type Slot, type Venue, type VenueType } from './types.ts'
import type { LocalNow } from './time/clock.ts'
import { openStatus, statusRank, withDayTimes, type OpenStatus } from './time/openNow.ts'
import { isFullTerm } from './time/termDates.ts'
import { mealElsewhere } from './menuNotes.ts'
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

export const TYPES: VenueType[] = ['hall', 'cafe', 'bar']

/** Meal by meal, then by first day. */
export const slotOrder = (a: Slot, b: Slot) => MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal) || DAYS.indexOf(a.days[0]) - DAYS.indexOf(b.days[0])

/** The hours that apply around `date` (term or vacation), meal by meal, then by first day. */
export function periodSlots(slots: Slot[], date: string): Slot[] {
  const period = isFullTerm(date) ? 'term' : 'vacation'
  return slots.filter((s) => s.period === 'all' || s.period === period).sort(slotOrder)
}
/**
 * The week's hours as a short table: each day's times in order, days with the same times run together ("Mon–Fri
 * 07:30–09:00, 12:00–14:00, 17:30–19:00; Sat …; Sun …"), rows by first day. A day with no slot isn't a row.
 */
export function weekHours(slots: Slot[]): { days: Day[]; times: Slot[] }[] {
  const rows = new Map<string, { days: Day[]; times: Slot[] }>()
  for (const day of DAYS) {
    const times = slots.filter((s) => s.days.includes(day)).sort((a, b) => a.start.localeCompare(b.start) || MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal))
    if (!times.length) continue
    const key = times.map((s) => `${s.meal} ${s.start}–${s.end}`).join('|')
    const row = rows.get(key)
    if (row) row.days.push(day)
    else rows.set(key, { days: [day], times })
  }
  return [...rows.values()]
}

/**
 * The week's hours meal by meal, for a venue that serves more than one: each meal's times, days with the same times
 * run together ("Lunch 12:30–13:30 Daily except Sat; 11:00–12:30 Sat"), the times by first day. Asked "when's lunch",
 * this answers in a row where `weekHours` takes the whole table.
 */
export function mealHours(slots: Slot[]): { meal: Meal; times: { start: string; end: string; days: Day[] }[] }[] {
  return MEALS.flatMap((meal) => {
    const times = new Map<string, { start: string; end: string; days: Day[] }>()
    for (const s of slots.filter((x) => x.meal === meal)) {
      const key = `${s.start}–${s.end}`
      const t = times.get(key) ?? times.set(key, { start: s.start, end: s.end, days: [] }).get(key)!
      t.days.push(...s.days.filter((d) => !t.days.includes(d)))
    }
    const sorted = [...times.values()].map((t) => ({ ...t, days: DAYS.filter((d) => t.days.includes(d)) })).sort((a, b) => DAYS.indexOf(a.days[0]) - DAYS.indexOf(b.days[0]))
    return sorted.length ? [{ meal, times: sorted }] : []
  })
}

export const TYPE_LABEL: Record<VenueType, string> = { hall: 'Dining', cafe: 'Café', bar: 'Bar' }

export type Filters = {
  meal?: Meal
  date: string // ISO date being viewed
  type?: VenueType
  /** Site slugs: any of them */
  sites?: string[]
  /** Colleges only, or University sites only */
  kind?: Site['kind']
  /** Explore pins menus to the selected date; venue/site browsing can preview the next service. */
  exactDate?: boolean
  diets: DietTag[]
  openNow: boolean
  q: string
}

export const DEFAULT_FILTERS: Omit<Filters, 'date'> = { diets: [], openNow: false, q: '' }

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

/** The menu for the service the status points at (its note alone, when it's posted elsewhere), else the first menu that day. */
export function nextService({ status: s, days }: Pick<Ranked, 'status' | 'days'>): MenuDay | undefined {
  const slot = s.kind === 'open' || s.kind === 'opening' ? s.slot : s.kind === 'closed' ? s.next?.slot : undefined
  const withItems = days.filter((d) => d.items.length)
  return days.find((d) => d.service === slot?.meal && (d.items.length || mealElsewhere(d))) ?? withItems[0]
}

/** A menu's main dishes, what a card leads with; every dish where the source marks no courses (Homerton, Downing). */
export function mainDishes(items: Dish[]): Dish[] {
  const mains = items.filter((i) => i.course === 'main')
  return mains.length ? mains : items
}

export function applyFilters(venues: Venue[], f: Filters, now: LocalNow): Ranked[] {
  const searching = !!normalizeSearch(f.q)
  const kept = new Map<string, Omit<Ranked, 'searchMatches'>>()
  for (const v of venues) {
    if (f.type && !venueTypes(v).includes(f.type)) continue
    if (f.sites?.length && !f.sites.includes(v.site.slug)) continue
    if (f.kind && v.site.kind !== f.kind) continue
    const meals = f.meal ? [f.meal] : undefined
    // Today's hours as its menus post them, where they've changed
    const status = openStatus(withDayTimes(v.slots, v.menu), now, meals)
    // Site browsing can preview the next service; Explore and searches keep the explicit menu date.
    const date = !f.exactDate && !searching && f.date === now.date ? (serviceDate(status) ?? f.date) : f.date
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
  // Searches see the venues left, and only dishes on the date viewed, at the meal and with every diet picked.
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
