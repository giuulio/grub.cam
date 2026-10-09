import { dishTags, MEAL_LABEL, MEALS } from '../lib/filters.ts'
import { dishPrice, fromList, mealPrices, priceHeads, type MealPrices } from '../lib/prices.ts'
import { slotApplies } from '../lib/time/openNow.ts'
import type { Dish, MenuDay, PriceTerms, Slot, VenuePrice } from '../lib/types.ts'
import { GroupHead, ListNote, PriceList, PriceText, Row } from './MenuRows.tsx'

type Course = NonNullable<Dish['course']>
const COURSES: Course[] = ['soup', 'main', 'side', 'dessert', 'other']
const COURSE_LABEL: Record<Course, string> = { soup: 'Soup', main: 'Mains', side: 'Sides', dessert: 'Dessert', other: 'Other' }

/**
 * One date's menus, meal by meal, one under another, with that day's hours. Prices from the venue's
 * posted list (its Dining lines, `priceGroups`) sit next to the dishes they apply to, or in the heading for one price per
 * meal; anything else it sells at that meal is folded below. Price columns are headed, and explained, the venue's way
 * (`terms`).
 */
export function DayMenu({ days, slots, date, prices, terms }: { days: MenuDay[]; slots: Slot[]; date: string; prices?: VenuePrice[]; terms?: PriceTerms | null }) {
  const posted = days.filter((d) => d.items.length)
  // A meal served that day with no dishes posted, but its own posted list (St Catharine's breakfast, a fixed brunch):
  // the list is its menu. Lines sold at every meal aren't one.
  const fixed = MEALS.filter(
    (m) => !posted.some((d) => d.service === m) && slots.some((s) => s.meal === m && slotApplies(s, date)) && (prices ?? []).some((p) => p.services?.includes(m)),
  ).map((m): MenuDay => ({ date, service: m, items: [] }))
  const shown = [...posted, ...fixed]
    .sort((a, b) => MEALS.indexOf(a.service) - MEALS.indexOf(b.service))
    .map((day) => ({ day, prices: mealPrices(prices, day.service) }))
  const used = shown.flatMap(({ day }) => day.items.flatMap((i) => dishTags(i.tags)))
  const listed = shown.flatMap(({ prices: mp }) => [mp.meal, ...Object.values(mp.course), ...mp.items]).filter((p) => !!p)

  return (
    <div className="space-y-2">
      <div>
        {shown.map(({ day, prices: mp }) => {
          const hours = slots
            .filter((s) => s.meal === day.service && slotApplies(s, date))
            .map((s) => `${s.start}–${s.end}`)
            .join(', ')
          return (
            <div key={day.service} className="mb-12">
              <div className="flex items-baseline gap-4 border-b border-ink/10 pb-2">
                <h3 className="flex-1 text-lg font-semibold">{MEAL_LABEL[day.service]}</h3>
                {mp.meal && <PriceText price={fromList(mp.meal)} />}
                {hours && <span className="text-muted tabular-nums">{hours}</span>}
              </div>
              {day.note && <p className="mt-2 text-sm text-muted">{day.note}</p>}
              {day.items.length ? (
                <Dishes items={day.items} prices={mp} terms={terms} />
              ) : (
                <div className="mt-3">
                  <PriceList lines={mp.items} terms={terms} narrow />
                </div>
              )}
              {day.items.length > 0 && mp.items.length > 0 && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-semibold text-muted hover:text-ink">Deals and extras · {mp.items.length}</summary>
                  <div className="mt-3">
                    <PriceList lines={mp.items} terms={terms} narrow />
                  </div>
                </details>
              )}
            </div>
          )
        })}
      </div>
      <ListNote tags={used} prices={listed} note={terms?.note} />
    </div>
  )
}

/** Dishes in course order, with course headings when there's more than one course. */
function Dishes({ items, prices, terms }: { items: Dish[]; prices: MealPrices; terms?: PriceTerms | null }) {
  const groups = COURSES.map((c) => ({ course: c, items: items.filter((i) => (i.course ?? 'other') === c) })).filter((g) => g.items.length)
  const priced = items.map((i) => dishPrice(i, prices))
  const columns = priced.some((p) => p?.second != null) ? 2 : priced.some((p) => p) ? 1 : 0
  const heads = priceHeads(columns, terms)
  return (
    <div className="mt-3 space-y-4">
      {groups.map((g, n) => (
        <div key={g.course}>
          <GroupHead label={groups.length > 1 ? COURSE_LABEL[g.course] : undefined} heads={n === 0 ? heads : []} />
          <ul>
            {g.items.map((i, n) => (
              <Row key={n} name={i.name} tags={dishTags(i.tags)} soldOut={i.sold_out} price={priced[items.indexOf(i)]} columns={columns} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
