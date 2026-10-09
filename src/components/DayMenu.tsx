import { dishTags, MEAL_LABEL, MEALS } from '../lib/filters.ts'
import { dishPrice, fromList, mealPrices, type MealPrices } from '../lib/prices.ts'
import { slotApplies } from '../lib/time/openNow.ts'
import type { Dish, MenuDay, Slot, VenuePrice } from '../lib/types.ts'
import { GroupHead, ListNote, PriceList, PriceText, Row } from './MenuRows.tsx'

type Course = NonNullable<Dish['course']>
const COURSES: Course[] = ['soup', 'main', 'side', 'dessert', 'other']
const COURSE_LABEL: Record<Course, string> = { soup: 'Soup', main: 'Mains', side: 'Sides', dessert: 'Dessert', other: 'Other' }

/**
 * One date's menus, meal by meal, with that day's hours; meals sit side by side on wide screens. Prices from the venue's
 * posted list (its Dining lines, `priceGroups`) sit next to the dishes they apply to, or in the heading for one price per
 * meal; anything else it sells at that meal is folded below.
 */
export function DayMenu({ days, slots, date, prices }: { days: MenuDay[]; slots: Slot[]; date: string; prices?: VenuePrice[] }) {
  const shown = days
    .filter((d) => d.items.length)
    .sort((a, b) => MEALS.indexOf(a.service) - MEALS.indexOf(b.service))
    .map((day) => ({ day, prices: mealPrices(prices, day.service) }))
  const used = shown.flatMap(({ day }) => day.items.flatMap((i) => dishTags(i.tags)))
  const listed = shown.flatMap(({ prices: mp }) => [mp.meal, ...Object.values(mp.course), ...mp.items]).filter((p) => !!p)

  return (
    <div className="space-y-2">
      <div className="gap-x-12 lg:columns-2">
        {shown.map(({ day, prices: mp }) => {
          const hours = slots
            .filter((s) => s.meal === day.service && slotApplies(s, date))
            .map((s) => `${s.start}–${s.end}`)
            .join(', ')
          return (
            <div key={day.service} className="mb-10 break-inside-avoid">
              <div className="flex items-baseline gap-4 border-b border-ink/10 pb-2">
                <h3 className="flex-1 text-lg font-semibold">{MEAL_LABEL[day.service]}</h3>
                {mp.meal && <PriceText price={fromList(mp.meal)} />}
                {hours && <span className="text-muted tabular-nums">{hours}</span>}
              </div>
              {day.note && <p className="mt-2 text-sm text-muted">{day.note}</p>}
              <Dishes items={day.items} prices={mp} />
              {mp.items.length > 0 && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-semibold text-muted hover:text-ink">Deals and extras · {mp.items.length}</summary>
                  <div className="mt-3">
                    <PriceList lines={mp.items} narrow />
                  </div>
                </details>
              )}
            </div>
          )
        })}
      </div>
      <ListNote tags={used} prices={listed} />
    </div>
  )
}

/** Dishes in course order, with course headings when there's more than one course. */
function Dishes({ items, prices }: { items: Dish[]; prices: MealPrices }) {
  const groups = COURSES.map((c) => ({ course: c, items: items.filter((i) => (i.course ?? 'other') === c) })).filter((g) => g.items.length)
  const priced = items.map((i) => dishPrice(i, prices))
  const columns = priced.some((p) => p?.nonMember != null) ? 2 : priced.some((p) => p) ? 1 : 0
  return (
    <div className="mt-3 space-y-4">
      {groups.map((g, n) => (
        <div key={g.course}>
          <GroupHead label={groups.length > 1 ? COURSE_LABEL[g.course] : undefined} columns={n === 0 && columns === 2} />
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
