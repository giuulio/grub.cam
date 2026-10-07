import type { AccessLevel, DietTag, Dish, Meal, MenuDay, VenueType, VenueView } from './data/types.ts'
import type { LocalNow } from './time/clock.ts'
import { openStatus, statusRank, type OpenStatus } from './time/openNow.ts'

export const MEALS: Meal[] = ['breakfast', 'brunch', 'lunch', 'dinner', 'snacks', 'bar']
export const MEAL_LABEL: Record<Meal, string> = { breakfast: 'Breakfast', brunch: 'Brunch', lunch: 'Lunch', dinner: 'Dinner', snacks: 'Café', bar: 'Bar' }

export const DIETS: DietTag[] = ['vegetarian', 'vegan', 'halal', 'gluten_free', 'kosher']
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
export const DIET_SHORT: Record<DietTag, string> = { vegetarian: 'V', vegan: 'VG', plant_based: 'PB', halal: 'H', gluten_free: 'GF', kosher: 'K', pescatarian: 'P', dairy_free: 'DF' }

export const TYPE_LABEL: Record<VenueType, string> = { hall: 'Hall', cafe: 'Café', bar: 'Bar', other: 'Other' }
export const ACCESS_LABEL: Record<AccessLevel, string> = { public: 'Open to all', members_guests: 'Members + guests', members_only: 'Members only', unknown: 'Access unknown' }

export type Filters = {
  meal?: Meal
  date: string // ISO date being viewed
  diets: DietTag[]
  types: VenueType[]
  nonMemberOk: boolean
  bankCard: boolean
  liveMenu: boolean
  openNow: boolean
  q: string
}

export const DEFAULT_FILTERS: Omit<Filters, 'date'> = { diets: [], types: [], nonMemberOk: false, bankCard: false, liveMenu: false, openNow: false, q: '' }

export function menuDaysFor(v: VenueView, date: string, meal?: Meal): MenuDay[] {
  if (!v.menu) return []
  return v.menu.days.filter((d) => d.date === date && (!meal || d.service === meal))
}

export function matchesDiet(v: VenueView, days: MenuDay[], diets: DietTag[]): boolean {
  if (!diets.length) return true
  return diets.every((tag) => {
    const venueLevel = v.dietary.tags.includes(tag) || (tag === 'vegetarian' && v.dietary.tags.includes('vegan'))
    const dishLevel = days.some((d) => d.items.some((i) => i.tags.includes(tag) || (tag === 'vegetarian' && i.tags.includes('vegan'))))
    return days.length ? dishLevel || (venueLevel && v.type !== 'hall') : venueLevel
  })
}

/** Dish matches the query (substring, lowercased) and every selected diet (vegan counts as vegetarian). */
export function dishMatches(i: Dish, f: Pick<Filters, 'q' | 'diets'>): boolean {
  const q = f.q.trim().toLowerCase()
  return (!q || i.name.toLowerCase().includes(q)) && f.diets.every((t) => i.tags.includes(t) || (t === 'vegetarian' && i.tags.includes('vegan')))
}

function serviceDate(s: OpenStatus): string | undefined {
  if (s.kind === 'open' || s.kind === 'opening') return s.date
  if (s.kind === 'closed') return s.next?.date
}

export type Ranked = { venue: VenueView; status: OpenStatus; days: MenuDay[]; matchedDishes: number }

export function applyFilters(venues: VenueView[], f: Filters, now: LocalNow): Ranked[] {
  const q = f.q.trim().toLowerCase()
  const out: Ranked[] = []
  for (const v of venues) {
    if (f.types.length && !f.types.includes(v.type)) continue
    if (f.nonMemberOk && !(v.access.level === 'public' || v.access.level === 'members_guests')) continue
    if (f.bankCard && v.payment.bank_card !== true) continue
    if (f.liveMenu && !v.menu) continue
    const meals = f.meal ? [f.meal] : undefined
    const status = openStatus(v.slots, now, meals)
    // Viewing today: menus follow the service the status points at, so after tonight's last service it's tomorrow's menu.
    const date = f.date === now.date ? (serviceDate(status) ?? f.date) : f.date
    const days = menuDaysFor(v, date, f.meal)
    if (!matchesDiet(v, days, f.diets)) continue
    if (q) {
      const nameHit = [v.college.name, v.college.short_name ?? '', v.name].join(' ').toLowerCase().includes(q)
      // With a menu, a single dish must match both the query and the diets; the free-text description only counts without one.
      const dishHit = days.some((d) => d.items.some((i) => dishMatches(i, { ...f, q })))
      const servesHit = !days.length && [v.where ?? '', v.serves ?? ''].join(' ').toLowerCase().includes(q)
      if (!nameHit && !dishHit && !servesHit) continue
    }
    days.sort((a, b) => MEALS.indexOf(a.service) - MEALS.indexOf(b.service))
    if (f.openNow && status.kind !== 'open') continue
    // If a meal is selected and the venue neither serves it (no slot) nor has a menu for it, drop it
    if (f.meal && !v.slots.some((s) => s.meal === f.meal) && !days.length) continue
    const matchedDishes = days.reduce((n, d) => n + d.items.filter((i) => dishMatches(i, { diets: f.diets, q: '' })).length, 0)
    out.push({ venue: v, status, days, matchedDishes })
  }
  out.sort((a, b) => {
    const r = statusRank(a.status) - statusRank(b.status)
    if (r) return r
    if (a.status.kind === 'open' && b.status.kind === 'open') return a.status.closesInMin - b.status.closesInMin
    const typeOrder = (t: VenueType) => ({ hall: 0, cafe: 1, bar: 2, other: 3 })[t]
    const t = typeOrder(a.venue.type) - typeOrder(b.venue.type)
    if (t) return t
    if (b.matchedDishes !== a.matchedDishes) return b.matchedDishes - a.matchedDishes
    return a.venue.college.name.localeCompare(b.venue.college.name)
  })
  return out
}
