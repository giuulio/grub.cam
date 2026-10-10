// The front page is the one place to find somewhere: a tab per kind of venue, each with its own address, and its
// filters in the URL. What each tab is, how it reads its filters, and where links from before it existed now go.
import { DEFAULT_FILTERS, dishMatches, MEAL_LABEL, nextService, type Filters, type Ranked } from './filters.ts'
import { isISODate } from './time/clock.ts'
import type { DietTag, Meal, Site, Venue, VenueType } from './types.ts'
import { normalizeSearch } from './search.ts'

/** What the front page lists: every venue, one type, or formal hall (Dining's formal meal, booked ahead). */
export type Scope = 'all' | VenueType | 'formal'

export type ScopeInfo = { scope: Scope; path: string; label: string; heading: string; placeholder: string; noun: [one: string, many: string] }

/** The tabs, in order. Each heading says what the site is for that kind of venue, in as few words as it takes. */
export const SCOPES: ScopeInfo[] = [
  { scope: 'all', path: '/', label: 'All', heading: 'Cambridge University food and drink', placeholder: 'Colleges, cafés, bars, dishes…', noun: ['venue', 'venues'] },
  { scope: 'hall', path: '/dining', label: 'Dining', heading: 'Cambridge University dining', placeholder: 'A college, or a dish on the menu…', noun: ['dining venue', 'dining venues'] },
  { scope: 'cafe', path: '/cafes', label: 'Cafés', heading: 'Cambridge University cafés', placeholder: 'A café or a college…', noun: ['café', 'cafés'] },
  { scope: 'bar', path: '/bars', label: 'Bars', heading: 'Cambridge University bars', placeholder: 'A bar or a college…', noun: ['bar', 'bars'] },
  { scope: 'formal', path: '/formal', label: 'Formal hall', heading: 'Cambridge University formal halls', placeholder: 'A college…', noun: ['formal hall', 'formal halls'] },
]
export const scopeInfo = (scope: Scope) => SCOPES.find((s) => s.scope === scope)!

/** The meals of a menu (a sent-in menu says which); Dining's meal filter leaves out formal hall, which has its tab. */
export const DINING_MEALS: Meal[] = ['breakfast', 'brunch', 'lunch', 'dinner', 'formal']
export const FILTER_MEALS: Meal[] = ['breakfast', 'brunch', 'lunch', 'dinner']
export const FILTER_DIETS: DietTag[] = ['vegetarian', 'vegan', 'halal', 'gluten_free', 'dairy_free', 'kosher', 'pescatarian']

/**
 * A tab's filters from its URL, validated against the loaded menu window and the sites: `q`, `site` (one or more,
 * comma-separated) and `open` everywhere; Dining's `meal`, `diet` and `date` (menus are by date) only there. Formal hall is Dining at the formal meal.
 */
export function readFilters(p: URLSearchParams, scope: Scope, today: string, sites: Site[], menuFrom: string, menuTo: string): Filters {
  const dining = scope === 'hall'
  const requested = p.get('date') ?? ''
  const date = dining && isISODate(requested) && requested >= menuFrom && requested < menuTo ? requested : today
  return {
    ...DEFAULT_FILTERS,
    q: p.get('q') ?? '',
    date,
    exactDate: true,
    type: scope === 'all' ? undefined : scope === 'formal' ? 'hall' : scope,
    sites: [...new Set(p.get('site')?.split(',') ?? [])].filter((slug) => sites.some((s) => s.slug === slug)),
    meal: scope === 'formal' ? 'formal' : dining ? FILTER_MEALS.find((m) => m === p.get('meal')) : undefined,
    diets: dining ? [...new Set((p.get('diet')?.split(',') ?? []).filter((d): d is DietTag => FILTER_DIETS.includes(d as DietTag)))] : [],
    openNow: date === today && p.has('open'),
  }
}

/**
 * Where a link from before the tabs goes (Explore's `/explore?type=…`, the old front page's `/?venue=…`): a picked
 * venue to its page; otherwise the tab for its type and meal, keeping the filters that tab reads.
 */
export function legacyPath(p: URLSearchParams): string {
  const venue = p.get('venue') ?? p.get('place')
  if (venue && /^[a-z0-9-]+\/[a-z0-9-]+$/.test(venue)) return `/${venue}`
  const type = p.get('type')
  const scope: Scope = type === 'hall' ? (p.get('meal') === 'formal' ? 'formal' : 'hall') : type === 'cafe' || type === 'bar' ? type : 'all'
  const keep = new URLSearchParams()
  for (const k of scope === 'hall' ? ['q', 'site', 'open', 'meal', 'diet', 'date'] : ['q', 'site', 'open']) {
    const v = p.get(k)
    if (v != null) keep.set(k, v)
  }
  const search = keep.toString()
  return `${scopeInfo(scope).path}${search ? `?${search}` : ''}`
}

export function hasLocation(v: Venue): v is Venue & { latitude: number; longitude: number } {
  return typeof v.latitude === 'number' && Number.isFinite(v.latitude) && Math.abs(v.latitude) <= 90
    && typeof v.longitude === 'number' && Number.isFinite(v.longitude) && Math.abs(v.longitude) <= 180
}

export function resultDishes(r: Ranked, f: Filters): string[] {
  if (normalizeSearch(f.q) && r.searchMatches.length) return [...new Set(r.searchMatches.map((h) => `${h.service ? `${MEAL_LABEL[h.service]}: ` : ''}${h.dish!.name}`))]
  return (f.diets.length ? r.days.flatMap((d) => d.items).filter((i) => dishMatches(i, { ...f, q: '' })) : nextService(r)?.items ?? []).map((i) => i.name)
}
