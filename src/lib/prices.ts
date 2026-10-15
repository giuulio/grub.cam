// A venue's posted price list (venue_prices): split between the venue's sections (its Dining menu, café, bar), and
// applied to a day's dishes: the price beside each dish, one price for a whole meal, and what else is sold at a meal.
import type { Dish, Meal, PriceCourse, PriceTerms, VenuePrice, VenueType } from './types.ts'

/** A price as posted: the first price (`max` when it's a range), the second (the venue's second tier), or words. */
export type Price = { gbp?: number; max?: number; second?: number; secondText?: string; text?: string }

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

export const fromList = (p: VenuePrice): Price => ({ gbp: p.price_gbp ?? undefined, max: p.price_max_gbp ?? undefined, second: p.non_member_gbp ?? undefined, ...(p.non_member_text ? { secondText: p.non_member_text } : {}) })

/** The dish's own price, as printed on the menu. */
export const ownPrice = (dish: Dish): Price | undefined =>
  dish.price_gbp != null || dish.price_text ? { gbp: dish.price_gbp, second: dish.price2_gbp, text: dish.price_text } : undefined

/** The dish's own price as printed, else its course's price from the list. */
export function dishPrice(dish: Dish, m: MealPrices): Price | undefined {
  const own = ownPrice(dish)
  if (own) return own
  const p = m.course[dish.course ?? 'other']
  return p && fromList(p)
}

const samePrice = (a?: Price, b?: Price) => !!a && !!b && a.gbp === b.gbp && a.second === b.second && a.secondText === b.secondText && a.text === b.text

/**
 * A course's price for its heading, said once for the dishes under it: theirs when they all cost the same (`shared`:
 * their rows then go without), else the list's for the course (`list`) when any of them has no price of its own.
 */
export function coursePrice(dishes: Dish[], list?: VenuePrice): { price?: Price; shared?: Price } {
  const own = dishes.map(ownPrice)
  if (dishes.length > 1 && own.every((p) => samePrice(p, own[0]))) return { price: own[0], shared: own[0] }
  return { price: list && own.some((p) => !p) ? fromList(list) : undefined }
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

/** One thing people order, as it might be written on a list: by its course, or its name, or failing that its section; `avoid` rules out lookalikes. */
type Order = { course?: PriceCourse; name?: RegExp; section?: RegExp; avoid?: RegExp }

const COFFEES: Order[] = [{ name: /\bflat white\b/i }, { name: /\blatte\b/i, avoid: /chai|matcha|caramel|mocha|primo|iced|dirty|turmeric/i }, { name: /\bcappuccino\b/i }, { name: /\bamericano\b/i }]

/**
 * What people most often ask a venue of each kind the price of, in the order a card shows them: at a café an espresso
 * (else another coffee), a second coffee, a tea and something to eat; at a bar a pint, a glass of wine, a spirit and a
 * soft drink; at a Dining venue a main course, a set meal, soup and a dessert. Each order is its alternatives: the
 * first with a line on the list stands for it.
 */
const ORDERS: Record<VenueType, Order[][]> = {
  cafe: [
    [{ name: /\bespresso\b/i, avoid: /martini|extra|shot|syrup|decaf|tonic/i }, ...COFFEES, { name: /\bcoffee\b/i, avoid: /iced|cake|liqueur/i }, { name: /\bhot drinks?\b/i }],
    COFFEES,
    [{ name: /\b(breakfast|english|black) tea\b|^tea\b/i }, { section: /\btea\b/i }, { name: /\btea\b/i, avoid: /iced|chai|matcha|bubble/i }],
    [{ name: /\bsoup\b/i }, { name: /\b(sandwich|toastie|panini|wrap|ciabatta|baguette|bagel|focaccia)/i }, { section: /sandwich|toastie|panini/i }, { name: /\b(croissant|cake|pastr|scone|brownie)/i }, { section: /cake|pastr/i }],
  ],
  bar: [
    [{ name: /\bpint\b/i, avoid: /half|soft/i }, { name: /\b(lagers?|ales?|beers?|ipa|stout)\b/i, avoid: /ginger|root|zero|alcohol[- ]free|low alcohol/i }, { section: /draught|\bbeers?\b|lager|on tap/i }],
    [{ name: /\bwine\b/i, avoid: /bottle|jug|ginger|mulled|gums?\b/i }, { section: /\bwine\b/i, avoid: /bottle|jug|port|prosecco|champagne|sparkling/i }, { name: /\bprosecco\b/i, avoid: /bottle|jug/i }],
    [{ name: /\b(gin|vodka|rum|whisky|whiskey)\b/i }, { section: /spirit/i }, { name: /\bcider\b/i }, { section: /cocktail/i }],
    [{ name: /\b(soft drinks?|cola|coke|lemonade)\b/i, avoid: /mixer|vodka|rum|gin\b/i }, { section: /\bsoft\b/i }],
  ],
  hall: [
    [{ course: 'main' }, { name: /\bmain\b/i, avoid: /deal/i }],
    [{ name: /meal deal|\bcourses?\b/i }, { course: 'meal' }],
    [{ course: 'soup' }, { name: /\bsoup\b/i }],
    [{ course: 'dessert' }, { name: /\bdesserts?\b/i }],
  ],
}

/**
 * Up to `n` of a list's lines for a card to lead with: one for each of `ORDERS[type]` that the list has, as posted (an
 * "Espresso, single" before an "Espresso, double"), then the first lines left, so an unusual list still shows something.
 * Only lines with a first price: one priced for the second tier alone says nothing to most people.
 */
export function headlinePrices(lines: VenuePrice[], type: VenueType, n = 3): VenuePrice[] {
  const priced = lines.filter((p) => p.price_gbp != null)
  const out: VenuePrice[] = []
  const find = (o: Order, by: (p: VenuePrice) => boolean) => priced.find((p) => !out.includes(p) && by(p) && !o.avoid?.test(p.name))
  for (const order of ORDERS[type]) {
    if (out.length >= n) break
    for (const o of order) {
      const hit = (o.course && find(o, (p) => p.course === o.course)) || (o.name && find(o, (p) => o.name!.test(p.name))) || (o.section && find(o, (p) => !!p.section && o.section!.test(p.section)))
      if (hit) {
        out.push(hit)
        break
      }
    }
  }
  for (const p of priced) {
    if (out.length >= n) break
    if (!out.includes(p)) out.push(p)
  }
  return out
}

/** The latest date any of these lines was seen. */
export const postedOn = (lines: VenuePrice[]) => lines.reduce<string | undefined>((max, p) => (!max || p.observed_on > max ? p.observed_on : max), undefined)

export const formatGbp = (n: number) => `£${n.toFixed(2)}`

/** The second column's posted price or label, with no substitute for an empty cell. */
export const formatSecondPrice = (p?: Price) => p?.second != null ? formatGbp(p.second) : p?.secondText ?? ''

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
