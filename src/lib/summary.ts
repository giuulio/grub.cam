// A venue or site in words: what it is, which meals it serves and when, and its formal hall. The lead paragraph on its
// page and the words in its title, so a page says what people search for ("Jesus College lunch menu", "Wolfson formal
// hall", "Kettle's Yard café opening times"). Built from the data only, never the clock, so it prerenders.
import { MEAL_LABEL, periodSlots, TYPE_LABEL } from './filters.ts'
import { formalWhen } from './formal.ts'
import { alternateNames, siteName, siteSearchName } from './site.ts'
import { formatDays } from './time/clock.ts'
import { isFormalOnly, venueTypes, type Meal, type Site, type Slot, type Venue, type VenueType } from './types.ts'

/** The meals a dining hall serves, in the day's order. */
const DAILY: Meal[] = ['breakfast', 'brunch', 'lunch', 'dinner']

/** "a, b and c"; an item may have commas of its own ("Mon, Wed 18:00–19:30") */
export const list = (parts: string[]) => (parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : (parts[0] ?? ''))
const NUMBER = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const count = (n: number) => NUMBER[n] ?? String(n)
const lower = (meals: Meal[]) => meals.map((m) => MEAL_LABEL[m].toLowerCase())

export const holdsFormal = (v: Venue) => !!v.formal || v.slots.some((s) => s.meal === 'formal')
export const hasMenu = (v: Venue) => v.menu.some((d) => d.items.length)
export const hasPrices = (v: Venue) => !!v.prices?.length || v.menu.some((d) => d.items.some((i) => i.price_gbp != null))
const hasAllergens = (v: Venue) => v.menu.some((d) => d.items.some((i) => i.allergens?.length))
export const hasFormalMenu = (v: Venue) => v.menu.some((d) => d.service === 'formal' && d.items.length)
const formalOnly = (v: Venue) => v.type === 'hall' && isFormalOnly(v)

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

/** Whether another venue at the site is of one of its kinds, so it's "a café at …" rather than "… ’s café". */
const shared = (v: Venue, siblings: Venue[]) =>
  siblings.some((o) => o.id !== v.id && !formalOnly(o) && venueTypes(o).some((t: VenueType) => venueTypes(v).includes(t)))

/** "the Sidgwick Site", "the University Library", but "West Cambridge", "Kettle's Yard", "The Fitzwilliam Museum" */
const the = (s: Site) => (s.kind === 'university' && /^(Department|Centre|Cambridge University)\b|(Site|Library|Campus)$/.test(s.name) ? 'the ' : '')
const theSite = (s: Site) => `${the(s)}${siteSearchName(s)}`

/** "St Edmund's College (Eddies), Cambridge", "the Sidgwick Site, University of Cambridge" */
export const placed = (s: Site) => `${theSite(s)}, ${s.kind === 'college' ? 'Cambridge' : 'University of Cambridge'}`

/** "Mon–Fri 12:00–13:45", "daily 17:40–18:40": in a sentence, so "Daily" isn't capitalised */
const daysTimes = (s: Slot) => `${formatDays(s.days).replace(/^Daily/, 'daily')} ${s.start}–${s.end}`

/** "lunch Mon–Fri 12:15–13:30 and Sat 12:15–13:15, and dinner daily 17:45–19:00": each meal once, its times together */
function mealTimes(slots: Slot[], meals: Meal[]): string {
  const each = meals.flatMap((m) => {
    const times = slots.filter((s) => s.meal === m).map(daysTimes)
    return times.length ? [`${MEAL_LABEL[m].toLowerCase()} ${list(times)}`] : []
  })
  // A meal with two sets of times already has an "and"; set the meals apart with a comma before the last
  return each.length > 1 && each.some((e) => e.includes(' and ')) ? `${each.slice(0, -1).join(', ')}, and ${each.at(-1)}` : list(each)
}

/** "Mon–Fri 08:30–16:00; Sat 10:00–14:00" */
const openTimes = (slots: Slot[]) => slots.map((s) => `${formatDays(s.days)} ${s.start}–${s.end}`).join('; ')

/**
 * The lead under a venue's name, for the term or vacation `date` falls in:
 * "Caff is the dining hall of Jesus College, Cambridge, serving lunch Mon–Fri 12:00–13:45 and dinner daily
 * 17:40–18:40. Its lunch and dinner menus are here day by day, with prices and allergens."
 */
export function venueSummary(v: Venue, date: string, siblings: Venue[] = []): string {
  const slots = periodSlots(v.slots, date)
  const when = formalWhen(v, v.formal).map((w) => w.replace(/^Daily/, 'daily'))
  const formal = when.length ? `: ${when.join('; ')}` : ''
  if (formalOnly(v)) return [`${v.name} is where ${placed(v.site)}, holds formal hall${formal}.`, hasFormalMenu(v) && 'Its formal hall menus are here as the college publishes them.'].filter(Boolean).join(' ')

  const what = shared(v, siblings) ? `a ${kindWords(v)} at ${placed(v.site)}` : `the ${kindWords(v)} of ${placed(v.site)}`
  const meals = dailyMeals(v)
  const out: string[] = []
  if (v.type === 'hall') {
    const times = mealTimes(slots, meals)
    out.push(times ? `${v.name} is ${what}, serving ${times}.` : `${v.name} is ${what}${meals.length ? `, for ${list(lower(meals))}` : ''}. Its hours aren’t published yet.`)
  } else {
    const times = openTimes(slots.filter((s) => s.meal !== 'formal'))
    out.push(`${v.name} is ${what}. ${times ? `Opening times: ${times}.` : 'Its opening times aren’t published yet.'}`)
  }
  if (holdsFormal(v)) out.push(`It also holds formal hall${formal}.`)
  if (hasMenu(v)) {
    const extras = [hasPrices(v) && 'prices', hasAllergens(v) && 'allergens'].filter((x): x is string => !!x)
    out.push(`Its ${meals.length ? `${list(lower(meals))} ` : ''}menus are here day by day${extras.length ? `, with ${list(extras)}` : ''}.`)
  } else if (v.prices?.length) out.push('Its price list is below.')
  return out.join(' ')
}

/** "Caff, the dining hall, for lunch and dinner", "Hall, for formal hall", "The Roost, the bar and café". */
function role(v: Venue, siblings: Venue[]): string {
  if (formalOnly(v)) return `${v.name}, for formal hall`
  const serves = [...lower(dailyMeals(v)), ...(holdsFormal(v) ? ['formal hall'] : [])]
  return `${v.name}, ${shared(v, siblings) ? 'a' : 'the'} ${kindWords(v)}${serves.length ? `, for ${list(serves)}` : ''}`
}

/**
 * The lead under a site's name: "Jesus College has three places to eat and drink: Caff, the dining hall, for lunch and
 * dinner; Hall, for formal hall; and The Roost, the bar and café. Also known as Jesus."
 */
export function siteSummary(s: Site, venues: Venue[]): string {
  // Two or more plain cafés (or bars) as one group: "nine cafés: West Hub Coffee Bar, Scholars Brew, …"
  const plain = (v: Venue) => !formalOnly(v) && !dailyMeals(v).length && !holdsFormal(v)
  const groups = new Map<string, Venue[]>()
  for (const v of venues.filter(plain)) groups.set(kindWords(v), [...(groups.get(kindWords(v)) ?? []), v])
  const grouped = [...groups.values()].filter((g) => g.length >= 2)
  const roles = [
    ...venues.filter((v) => !grouped.some((g) => g.includes(v))).map((v) => role(v, venues)),
    ...grouped.map((g) => `${count(g.length)} ${kindWords(g[0]).replace(/(café|bar|canteen|dining hall)(?=$|,| and )/g, '$1s')}: ${list(g.map((v) => v.name))}`),
  ]
  const name = `${the(s)}${siteName(s)}`.replace(/^t/, 'T')
  const places = `${count(venues.length)} ${venues.length === 1 ? 'place' : 'places'} to eat and drink`
  const joined = roles.length > 1 ? `${roles.slice(0, -1).join('; ')}; and ${roles.at(-1)}` : roles[0]
  // All of one kind: "The Sidgwick Site has two cafés: The Buttery and ARC Café."
  const only = grouped.length === 1 && grouped[0].length === venues.length
  const aliases = alternateNames(s)
  return [venues.length && `${name} has ${only ? roles[0] : `${places}: ${joined}`}.`, aliases.length && `Also known as ${list(aliases)}.`].filter(Boolean).join(' ')
}

/** "brunch, lunch and dinner" for a title, or "" */
export const mealWords = (v: Venue) => list(lower(dailyMeals(v)))
