import { DIET_LABEL, DIET_SHORT, dishTags, MEAL_LABEL, MEALS } from '../lib/filters.ts'
import { dishPrice, formatGbp, fromList, mealPrices, servedMeals, type MealPrices, type Price } from '../lib/prices.ts'
import { formatISODate } from '../lib/time/clock.ts'
import { slotApplies } from '../lib/time/openNow.ts'
import type { DietTag, Dish, MenuDay, Slot, VenuePrice } from '../lib/types.ts'

type Course = NonNullable<Dish['course']>
const COURSES: Course[] = ['soup', 'main', 'side', 'dessert', 'other']
const COURSE_LABEL: Record<Course, string> = { soup: 'Soup', main: 'Mains', side: 'Sides', dessert: 'Dessert', other: 'Other' }

/**
 * One date's menus, meal by meal, with that day's hours. Prices from the venue's posted list sit next to the dishes they
 * apply to (or in the heading, for one price per meal); anything else it sells at that meal is folded below, or is the
 * menu itself for a fixed menu with no dishes posted.
 */
export function DayMenu({ days, slots, date, prices }: { days: MenuDay[]; slots: Slot[]; date: string; prices?: VenuePrice[] }) {
  const meals = servedMeals(days, slots, prices, date).sort((a, b) => MEALS.indexOf(a) - MEALS.indexOf(b))
  const used = new Set(days.flatMap((d) => d.items.flatMap((i) => dishTags(i.tags))))
  const key = (Object.keys(DIET_SHORT) as DietTag[]).filter((t) => used.has(t))
  const shown = meals.map((meal) => ({ meal, day: days.find((d) => d.service === meal && d.items.length), prices: mealPrices(prices, meal) }))
  const listed = shown.flatMap((s) => [s.prices.meal, ...Object.values(s.prices.course), ...s.prices.items]).filter((p) => !!p)
  const observed = listed.reduce<string | undefined>((max, p) => (!max || p.observed_on > max ? p.observed_on : max), undefined)

  return (
    <div className="space-y-10">
      {shown.map(({ meal, day, prices: mp }) => {
        const hours = slots
          .filter((s) => s.meal === meal && slotApplies(s, date))
          .map((s) => `${s.start}–${s.end}`)
          .join(', ')
        return (
          <div key={meal}>
            <div className="flex items-baseline gap-4 border-b border-ink/10 pb-2">
              <h4 className="flex-1 font-medium">{MEAL_LABEL[meal]}</h4>
              {mp.meal && <PriceText price={fromList(mp.meal)} className="text-sm" />}
              {hours && <span className="text-sm text-muted tabular-nums">{hours}</span>}
            </div>
            {day?.note && <p className="mt-2 text-sm text-muted">{day.note}</p>}
            {day ? (
              <>
                <Dishes items={day.items} prices={mp} />
                {mp.items.length > 0 && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-xs tracking-wide text-muted uppercase hover:text-ink">Deals and extras · {mp.items.length}</summary>
                    <PriceList items={mp.items} />
                  </details>
                )}
              </>
            ) : (
              <PriceList items={mp.items} />
            )}
          </div>
        )
      })}
      {(key.length > 0 || observed) && (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {key.map((t) => (
            <span key={t}>
              <Code tag={t} /> {DIET_LABEL[t]}
            </span>
          ))}
          {observed && <span>Prices as posted {formatISODate(observed, { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
        </p>
      )}
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

/** A posted list, section by section. */
function PriceList({ items }: { items: VenuePrice[] }) {
  const sections = [...new Set(items.map((p) => p.section))].map((section) => ({ section, rows: items.filter((p) => p.section === section) }))
  const columns = items.some((p) => p.non_member_gbp != null) ? 2 : 1
  const headed = sections.length > 1
  return (
    <div className="mt-3 space-y-4">
      {sections.map(({ section, rows }, n) => (
        <div key={section ?? ''}>
          <GroupHead label={headed ? (section ?? undefined) : undefined} columns={n === 0 && columns === 2} />
          <ul>
            {rows.map((p, n) => (
              <Row key={n} name={p.name} price={fromList(p)} columns={columns} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

const PRICE_COL = 'w-14 shrink-0 text-right tabular-nums'

/** A course or section heading, with the price columns' headings beside it on the first group (alone when there's no heading). */
function GroupHead({ label, columns }: { label?: string; columns: boolean }) {
  if (!label && !columns) return null
  return (
    <div className="mb-1 flex items-baseline gap-3 text-xs tracking-wide text-muted uppercase">
      <h5 className="flex-1">{label}</h5>
      {columns && (
        <>
          <span className={`${PRICE_COL} text-[10px]`}>Members</span>
          <span className={`${PRICE_COL} text-[10px]`}>Others</span>
        </>
      )}
    </div>
  )
}

function Row({ name, tags = [], soldOut, price, columns }: { name: string; tags?: DietTag[]; soldOut?: boolean; price?: Price; columns: number }) {
  return (
    <li className="flex items-baseline gap-3 py-1 text-sm">
      <span className="min-w-0 flex-1">
        <span className={soldOut ? 'text-muted line-through' : 'text-ink'}>{name}</span>
        {tags.map((t) => (
          <Code key={t} tag={t} className="ml-1.5 align-[1px]" />
        ))}
      </span>
      {soldOut ? (
        <span className={`${PRICE_COL} text-muted`}>Sold out</span>
      ) : (
        columns > 0 && (
          <>
            <span title={price?.text} className={`${PRICE_COL} text-muted`}>
              {price?.gbp != null ? formatGbp(price.gbp) : price?.text}
            </span>
            {columns > 1 && <span className={`${PRICE_COL} text-muted/70`}>{price?.nonMember != null && formatGbp(price.nonMember)}</span>}
          </>
        )
      )}
    </li>
  )
}

function PriceText({ price, className = '' }: { price: Price; className?: string }) {
  return (
    <span className={`text-muted tabular-nums ${className}`}>
      {price.gbp != null && formatGbp(price.gbp)}
      {price.nonMember != null && <span className="text-muted/70"> · {formatGbp(price.nonMember)}</span>}
    </span>
  )
}

function Code({ tag, className = '' }: { tag: DietTag; className?: string }) {
  return (
    <abbr title={DIET_LABEL[tag]} className={`inline-block min-w-6 rounded border border-ink/15 px-1 text-center text-[10px] leading-4 font-medium text-muted no-underline ${className}`}>
      {DIET_SHORT[tag]}
    </abbr>
  )
}
