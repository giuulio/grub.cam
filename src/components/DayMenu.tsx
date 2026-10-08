import { DIET_LABEL, DIET_SHORT, dishTags, MEAL_LABEL, MEALS } from '../lib/filters.ts'
import { slotApplies } from '../lib/time/openNow.ts'
import type { DietTag, Dish, MenuDay, Slot } from '../lib/types.ts'

type Course = NonNullable<Dish['course']>
const COURSES: Course[] = ['soup', 'main', 'side', 'dessert', 'other']
const COURSE_LABEL: Record<Course, string> = { soup: 'Soup', main: 'Mains', side: 'Sides', dessert: 'Dessert', other: 'Other' }

/** One date's menus, service by service, with that day's hours. */
export function DayMenu({ days, slots, date }: { days: MenuDay[]; slots: Slot[]; date: string }) {
  const services = days.filter((d) => d.items.length).sort((a, b) => MEALS.indexOf(a.service) - MEALS.indexOf(b.service))
  const used = new Set(services.flatMap((d) => d.items.flatMap((i) => dishTags(i.tags))))
  const key = (Object.keys(DIET_SHORT) as DietTag[]).filter((t) => used.has(t))

  return (
    <div className="space-y-10">
      {services.map((d) => {
        const hours = slots
          .filter((s) => s.meal === d.service && slotApplies(s, date))
          .map((s) => `${s.start}–${s.end}`)
          .join(', ')
        return (
          <div key={d.service}>
            <div className="flex items-baseline justify-between gap-4 border-b border-ink/10 pb-2">
              <h4 className="font-medium">{MEAL_LABEL[d.service]}</h4>
              {hours && <span className="text-sm text-muted tabular-nums">{hours}</span>}
            </div>
            <Dishes items={d.items} />
          </div>
        )
      })}
      {key.length > 0 && (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {key.map((t) => (
            <span key={t}>
              <Code tag={t} /> {DIET_LABEL[t]}
            </span>
          ))}
        </p>
      )}
    </div>
  )
}

/** Dishes in course order, with course headings when there's more than one course. */
function Dishes({ items }: { items: Dish[] }) {
  const groups = COURSES.map((c) => ({ course: c, items: items.filter((i) => (i.course ?? 'other') === c) })).filter((g) => g.items.length)
  const priced = items.some((i) => i.price_gbp != null || i.price_text)
  return (
    <div className="mt-3 space-y-4">
      {groups.map((g) => (
        <div key={g.course}>
          {groups.length > 1 && <h5 className="mb-1 text-xs tracking-wide text-muted uppercase">{COURSE_LABEL[g.course]}</h5>}
          <ul>
            {g.items.map((i, n) => (
              <DishRow key={n} dish={i} priced={priced} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function DishRow({ dish, priced }: { dish: Dish; priced: boolean }) {
  const tags = dishTags(dish.tags)
  const price = dish.price_gbp != null ? `£${dish.price_gbp.toFixed(2)}` : dish.price_text
  return (
    <li className="flex items-baseline gap-3 py-1 text-sm">
      <span className={`min-w-0 flex-1 ${dish.sold_out ? 'text-muted line-through' : 'text-ink'}`}>{dish.name}</span>
      {tags.length > 0 && (
        <span className="flex shrink-0 gap-1">
          {tags.map((t) => (
            <Code key={t} tag={t} />
          ))}
        </span>
      )}
      {(priced || dish.sold_out) && (
        <span title={dish.price_text ?? undefined} className="w-14 shrink-0 text-right text-muted tabular-nums">
          {dish.sold_out ? 'Sold out' : price}
        </span>
      )}
    </li>
  )
}

function Code({ tag }: { tag: DietTag }) {
  return (
    <abbr title={DIET_LABEL[tag]} className="inline-block min-w-6 rounded border border-ink/15 px-1 text-center text-[10px] leading-4 font-medium text-muted no-underline">
      {DIET_SHORT[tag]}
    </abbr>
  )
}
