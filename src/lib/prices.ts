// A venue's posted price list (venue_prices) applied to its menus: the price beside each dish, one price for a whole
// meal, and what else is sold at a meal. A meal whose list has items but no course prices is a fixed menu (a brunch,
// a bar's list): shown on every day it's served, with or without dishes posted.
import { slotApplies } from './time/openNow.ts'
import type { Dish, Meal, MenuDay, Slot, VenuePrice } from './types.ts'

export type Price = { gbp?: number; nonMember?: number; text?: string }

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

/** A list of items with no course prices: the meal's menu whether or not dishes are posted. */
export const isFixedMenu = (m: MealPrices) => m.items.length > 0 && !m.meal && !Object.keys(m.course).length

export const fromList = (p: VenuePrice): Price => ({ gbp: p.price_gbp, nonMember: p.non_member_gbp ?? undefined })

/** The dish's own price as printed, else its course's price from the list. */
export function dishPrice(dish: Dish, m: MealPrices): Price | undefined {
  if (dish.price_gbp != null || dish.price_text) return { gbp: dish.price_gbp, text: dish.price_text }
  const p = m.course[dish.course ?? 'other']
  return p && fromList(p)
}

/** The meals to show on a date: those with dishes, plus fixed menus served that day (in that order, deduplicated). */
export function servedMeals(days: MenuDay[], slots: Slot[], prices: VenuePrice[] | undefined, date: string): Meal[] {
  const withDishes = days.filter((d) => d.items.length).map((d) => d.service)
  const fixed = slots.filter((s) => slotApplies(s, date) && isFixedMenu(mealPrices(prices, s.meal))).map((s) => s.meal)
  return [...new Set([...withDishes, ...fixed])]
}

export const formatGbp = (n: number) => `£${n.toFixed(2)}`
