// A venue's posted price list (venue_prices): split between the venue's sections (its Dining menu, café, bar), and
// applied to a day's dishes: the price beside each dish, one price for a whole meal, and what else is sold at a meal.
import type { Dish, Meal, PriceTerms, VenuePrice, VenueType } from './types.ts'

/** A price as posted: the first price (`max` when it's a range), the second (the venue's second tier), or words. */
export type Price = { gbp?: number; max?: number; second?: number; text?: string }

export type MealPrices = {
  /** One price for the whole meal */
  meal?: VenuePrice
  /** The price of a dish of that course that has none of its own */
  course: Partial<Record<NonNullable<Dish['course']>, VenuePrice>>
  /** Everything else sold at the meal, as posted */
  items: VenuePrice[]
}

export function mealPrices(prices: VenuePrice[] | undefined, meal: Meal): MealPrices {
  const here = (prices ?? []).filter((p) => !p.services || p.services.includes(meal))
  const out: MealPrices = { course: {}, items: [] }
  for (const p of here) {
    if (p.course === 'meal') out.meal ??= p
    else if (p.course) out.course[p.course] ??= p
    else out.items.push(p)
  }
  return out
}

export const fromList = (p: VenuePrice): Price => ({ gbp: p.price_gbp ?? undefined, max: p.price_max_gbp ?? undefined, second: p.non_member_gbp ?? undefined })

/** The dish's own price as printed, else its course's price from the list. */
export function dishPrice(dish: Dish, m: MealPrices): Price | undefined {
  if (dish.price_gbp != null || dish.price_text) return { gbp: dish.price_gbp, second: dish.price2_gbp, text: dish.price_text }
  const p = m.course[dish.course ?? 'other']
  return p && fromList(p)
}

const DINING: Meal[] = ['breakfast', 'brunch', 'lunch', 'dinner', 'formal']

/**
 * The lines each of a venue's sections shows (`types`: venueTypes(), its own type first), in posted order. A line sold
 * only at the bar goes to the bar, only at the café to the café, only at meals to the Dining menu; a line for every
 * meal goes to the venue's own type, except that a Dining venue that's also a café lists it under the café.
 */
export function priceGroups(prices: VenuePrice[] | undefined, types: VenueType[]): Partial<Record<VenueType, VenuePrice[]>> {
  const [own] = types
  const out: Partial<Record<VenueType, VenuePrice[]>> = {}
  for (const p of prices ?? []) {
    let t: VenueType = own
    if (p.services?.every((m) => m === 'bar')) t = 'bar'
    else if (p.services?.every((m) => m === 'snacks')) t = 'cafe'
    else if (p.services?.every((m) => DINING.includes(m))) t = 'hall'
    else if (!p.services && own === 'hall' && types.includes('cafe')) t = 'cafe'
    ;(out[types.includes(t) ? t : own] ??= []).push(p)
  }
  return out
}

/** The latest date any of these lines was seen. */
export const postedOn = (lines: VenuePrice[]) => lines.reduce<string | undefined>((max, p) => (!max || p.observed_on > max ? p.observed_on : max), undefined)

export const formatGbp = (n: number) => `£${n.toFixed(2)}`

/** "£3.24–£3.96", or one price. */
export const formatPrice = (p: Price) => (p.gbp == null ? (p.text ?? '') : p.max != null ? `${formatGbp(p.gbp)}–${formatGbp(p.max)}` : formatGbp(p.gbp))

/**
 * The headings over a list's price columns, as the venue heads them (`price_terms.tiers`): two columns are members'
 * and others' unless it says otherwise; one column is headed only when the venue says whose it is.
 */
export function priceHeads(columns: number, terms?: PriceTerms | null): string[] {
  const tiers = terms?.tiers ?? []
  if (columns === 2) return [tiers[0] ?? 'Members', tiers[1] ?? 'Others']
  return columns === 1 && tiers[0] ? [tiers[0]] : []
}
