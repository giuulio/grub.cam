import type { AccessLevel, DietTag, Dish, Meal, MenuDay, Venue, VenueType } from './types.ts'
import type { LocalNow } from './time/clock.ts'
import { openStatus, statusRank, type OpenStatus } from './time/openNow.ts'

export const MEALS: Meal[] = ['breakfast', 'brunch', 'lunch', 'dinner', 'snacks', 'bar']
export const MEAL_LABEL: Record<Meal, string> = { breakfast: 'Breakfast', brunch: 'Brunch', lunch: 'Lunch', dinner: 'Dinner', snacks: 'Café', bar: 'Bar' }

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

export const ACCESS_LABEL: Record<AccessLevel, string> = { public: 'Open to all', members_guests: 'Members + guests', members_only: 'Members only', unknown: 'Access unknown' }

export const TYPES: VenueType[] = ['hall', 'cafe', 'bar', 'other']
export const TYPE_LABEL: Record<VenueType, string> = { hall: 'Hall', cafe: 'Café', bar: 'Bar', other: 'Other' }

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** The venue's type, unless its name already says it ("College Bar", "Iris Café"). */
export const typeNote = (v: Pick<Venue, 'name' | 'type'>) => (fold(v.name).includes(fold(TYPE_LABEL[v.type])) ? undefined : TYPE_LABEL[v.type])

export type Filters = {
  meal?: Meal
  date: string // ISO date being viewed
  type?: VenueType
  college?: string // college slug
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

/** Date of the service the status points at: the one on now, opening next, or next after closing. */
export function serviceDate(s: OpenStatus): string | undefined {
  if (s.kind === 'open' || s.kind === 'opening') return s.date
  if (s.kind === 'closed') return s.next?.date
}

export type Ranked = { venue: Venue; status: OpenStatus; days: MenuDay[]; matchedDishes: number }

/** The menu for the service the status points at, else the first menu that day. */
export function nextService({ status: s, days }: Pick<Ranked, 'status' | 'days'>): MenuDay | undefined {
  const slot = s.kind === 'open' || s.kind === 'opening' ? s.slot : s.kind === 'closed' ? s.next?.slot : undefined
  const withItems = days.filter((d) => d.items.length)
  return withItems.find((d) => d.service === slot?.meal) ?? withItems[0]
}

export function applyFilters(venues: Venue[], f: Filters, now: LocalNow): Ranked[] {
  const q = f.q.trim().toLowerCase()
  const out: Ranked[] = []
  for (const v of venues) {
    if (f.type && v.type !== f.type) continue
    if (f.college && v.college.slug !== f.college) continue
    if (f.nonMemberOk && !(v.access.level === 'public' || v.access.level === 'members_guests')) continue
    if (f.bankCard && v.payment.bank_card !== true) continue
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
    const t = TYPES.indexOf(a.venue.type) - TYPES.indexOf(b.venue.type)
    if (t) return t
    if (b.matchedDishes !== a.matchedDishes) return b.matchedDishes - a.matchedDishes
    return a.venue.college.name.localeCompare(b.venue.college.name)
  })
  return out
}
