import { DEFAULT_FILTERS, dishMatches, MEAL_LABEL, nextService, type Filters, type Ranked } from './filters.ts'
import { isISODate } from './time/clock.ts'
import type { AccessLevel, DietTag, Meal, Site, Venue, VenueType } from './types.ts'
import { normalizeSearch } from './search.ts'

export const EXPLORE_TYPES: [VenueType, string][] = [['hall', 'Dining'], ['cafe', 'Cafés'], ['bar', 'Bars']]
export const DINING_MEALS: Meal[] = ['breakfast', 'brunch', 'lunch', 'dinner', 'formal']
export const EXPLORE_DIETS: DietTag[] = ['vegetarian', 'vegan', 'halal', 'gluten_free', 'dairy_free', 'kosher', 'pescatarian']
export const EXPLORE_ACCESS: AccessLevel[] = ['public', 'university', 'members_guests', 'members_only', 'unknown']

/** URL state is validated against the loaded menu window and live site list. */
export function readExploreFilters(p: URLSearchParams, today: string, sites: Site[], menuFrom: string, menuTo: string): Filters {
  const type = EXPLORE_TYPES.find(([t]) => t === p.get('type'))?.[0]
  const requestedDate = p.get('date') ?? ''
  const date = isISODate(requestedDate) && requestedDate >= menuFrom && requestedDate < menuTo ? requestedDate : today
  return {
    ...DEFAULT_FILTERS,
    q: p.get('q') ?? '',
    date,
    exactDate: true,
    type,
    site: sites.find((s) => s.slug === p.get('site'))?.slug,
    meal: type === 'hall' ? DINING_MEALS.find((m) => m === p.get('meal')) : undefined,
    diets: [...new Set((p.get('diet')?.split(',') ?? []).filter((d): d is DietTag => EXPLORE_DIETS.includes(d as DietTag)))],
    access: EXPLORE_ACCESS.find((a) => a === p.get('access')),
    openNow: date === today && p.has('open'),
  }
}

export function hasLocation(v: Venue): v is Venue & { latitude: number; longitude: number } {
  return typeof v.latitude === 'number' && Number.isFinite(v.latitude) && Math.abs(v.latitude) <= 90
    && typeof v.longitude === 'number' && Number.isFinite(v.longitude) && Math.abs(v.longitude) <= 180
}

export function resultDishes(r: Ranked, f: Filters): string[] {
  if (normalizeSearch(f.q) && r.searchMatches.length) return [...new Set(r.searchMatches.map((h) => `${h.service ? `${MEAL_LABEL[h.service]}: ` : ''}${h.dish!.name}`))]
  return (f.diets.length ? r.days.flatMap((d) => d.items).filter((i) => dishMatches(i, { ...f, q: '' })) : nextService(r)?.items ?? []).map((i) => i.name)
}
