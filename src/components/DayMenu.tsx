import { ChevronDown, Clock } from 'reicon-react'
import { dishTags, MEAL_LABEL, MEALS } from '../lib/filters.ts'
import { coursePrice, fromList, mealPrices, ownPrice, priceHeads, type MealPrices } from '../lib/prices.ts'
import { hhmmToMinutes, type LocalNow } from '../lib/time/clock.ts'
import { noteTimes, slotApplies, withDayTimes } from '../lib/time/openNow.ts'
import type { Dish, MenuDay, PriceTerms, Slot, VenuePrice } from '../lib/types.ts'
import { Icon } from './Icon.tsx'
import { mealCancelled } from '../lib/menuNotes.ts'
import { GroupHead, ListNote, PriceList, PriceText, Row } from './MenuRows.tsx'

type Course = NonNullable<Dish['course']>
const COURSES: Course[] = ['soup', 'main', 'side', 'dessert', 'other']
const COURSE_LABEL: Record<Course, string> = { soup: 'Soup', main: 'Mains', side: 'Sides', dessert: 'Dessert', other: 'Other' }

/**
 * One date's menus, meal by meal, one under another, each headed by its name and that day's hours (no tabs over them:
 * they only repeated the headings). A day whose menu posts other times for a meal ("Dinner 18:00–18:45 this Monday")
 * heads it with those, and says so in amber beside the usual ones. `now`, when the date is today: meals already over
 * fold to their heading, so the one being served, or next, is first in view; once every meal is over, none fold.
 * Prices from the venue's posted list (its Dining lines, `priceGroups`) sit next to the dishes they apply to, or in the
 * heading for one price per meal; anything else it sells at that meal is folded below. Price columns are headed, and
 * explained, the venue's way (`terms`).
 */
export function DayMenu({ days, slots, date, prices, terms, now }: { days: MenuDay[]; slots: Slot[]; date: string; prices?: VenuePrice[]; terms?: PriceTerms | null; now?: LocalNow }) {
  const posted = days.filter((d) => d.items.length || mealCancelled(d))
  const served = withDayTimes(slots, days)
  // A meal served that day with no dishes posted, but its own posted list (St Catharine's breakfast, a fixed brunch):
  // the list is its menu. Lines sold at every meal aren't one.
  const fixed = MEALS.filter(
    (m) => !posted.some((d) => d.service === m) && served.some((s) => s.meal === m && slotApplies(s, date)) && (prices ?? []).some((p) => p.services?.includes(m)),
  ).map((m): MenuDay => ({ date, service: m, items: [] }))
  const shown = [...posted, ...fixed]
    .sort((a, b) => MEALS.indexOf(a.service) - MEALS.indexOf(b.service))
    .map((day) => ({ day, prices: mealPrices(mealCancelled(day) ? undefined : prices, day.service) }))
  const times = (from: Slot[], meal: Slot['meal']) => from.filter((s) => s.meal === meal && slotApplies(s, date)).sort((a, b) => a.start.localeCompare(b.start))
  // Over today: every sitting of it has ended (a meal past midnight never is)
  const over = (meal: Slot['meal']) => {
    const t = times(served, meal)
    return !!now && t.length > 0 && t.every((s) => s.end > s.start && hhmmToMinutes(s.end) <= now.minutes)
  }
  const folding = shown.some(({ day }) => !over(day.service))
  const used = shown.flatMap(({ day }) => day.items.flatMap((i) => dishTags(i.tags)))
  const listed = shown.flatMap(({ prices: mp }) => [mp.meal, ...Object.values(mp.course), ...mp.items]).filter((p) => !!p)

  return (
    <div>
      <div>
        {shown.map(({ day, prices: mp }) => {
          const span = (from: Slot[]) => times(from, day.service).map((s) => `${s.start}–${s.end}`).join(', ')
          const cancelled = mealCancelled(day)
          const hours = cancelled ? '' : span(served)
          const usual = span(slots)
          // The day's own times, when its note gives some other than the usual
          const changed = !!noteTimes(day.note) && hours !== usual
          return (
            <details
              key={day.service}
              id={`meal-${day.service}`}
              data-meal={day.service}
              open={!(folding && over(day.service))}
              className="group mb-12 scroll-mt-[calc(var(--header-h,0px)+1.5rem)] [&:not([open])]:mb-6"
            >
              <summary className="flex cursor-pointer list-none items-baseline gap-4 border-b border-ink/10 pb-3 text-lg [&::-webkit-details-marker]:hidden">
                <h3 className="title flex-1 text-2xl group-[:not([open])]:text-muted">
                  {MEAL_LABEL[day.service]}
                  {/* Why it's folded, while it is */}
                  {over(day.service) && <span className="ml-3 font-sans text-base font-normal text-muted group-open:hidden">Served earlier</span>}
                </h3>
                {mp.meal && <PriceText price={fromList(mp.meal)} className="group-[:not([open])]:hidden" />}
                {cancelled ? <span className="font-semibold text-notice">Not served</span> : hours && <span className={`tabular-nums ${changed ? 'font-semibold text-notice' : 'text-muted'}`}>{hours}</span>}
                <Icon of={ChevronDown} className="size-5 -translate-y-px self-center text-muted transition-transform group-open:rotate-180" />
              </summary>
              {changed ? (
                <p className="mt-3 inline-flex items-start gap-2 rounded-lg bg-notice-bg px-3 py-2 text-[0.9375rem] font-medium text-notice">
                  <Icon of={Clock} className="mt-0.5 size-4" />
                  <span>
                    {day.note}
                    {usual && <span className="font-normal"> · usually {usual}</span>}
                  </span>
                </p>
              ) : (
                day.note && <p className={`mt-2 text-sm ${cancelled ? 'text-notice' : 'text-muted'}`}>{day.note}</p>
              )}
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
            </details>
          )
        })}
      </div>
      <ListNote tags={used} prices={listed} note={terms?.note} />
    </div>
  )
}

/**
 * Dishes in course order, with course headings when there's more than one course. Each price said once, where it's
 * true: a course whose dishes all cost the same ("Sides £0.99"), or the list's price for the course ("Soup £1.59"),
 * in the course's heading; else each dish's own on its row (the course's, in its heading, for any without one).
 */
function Dishes({ items, prices, terms }: { items: Dish[]; prices: MealPrices; terms?: PriceTerms | null }) {
  const groups = COURSES.map((c) => {
    const these = items.filter((i) => (i.course ?? 'other') === c)
    return { course: c, items: these, ...coursePrice(these, prices.course[c]) }
  }).filter((g) => g.items.length)
  // A dish's price on its row, unless its course's heading says it for all of them
  const priced = items.map((i) => (groups.find((g) => g.items.includes(i))?.shared ? undefined : ownPrice(i)))
  const all = [...priced, ...groups.map((g) => g.price)]
  const columns = all.some((p) => p?.second != null) ? 2 : all.some((p) => p) ? 1 : 0
  const heads = priceHeads(columns, terms)
  return (
    <div className="mt-5 space-y-7">
      {groups.map((g, n) => (
        <div key={g.course}>
          <GroupHead label={groups.length > 1 || g.price ? COURSE_LABEL[g.course] : undefined} heads={n === 0 ? heads : []} price={g.price} columns={columns} />
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
