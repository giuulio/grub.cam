import { useState } from 'react'
import type { DietTag, Dish, MenuDay } from '../lib/data/types.ts'
import { MEAL_LABEL } from '../lib/filters.ts'
import { DietTags } from './Badges.tsx'

const COURSE_ORDER: Record<NonNullable<Dish['course']>, number> = { soup: 0, main: 1, side: 2, dessert: 3, other: 4 }

function matches(d: Dish, diets: DietTag[]) {
  return diets.every((t) => d.tags.includes(t) || (t === 'vegetarian' && d.tags.includes('vegan')))
}

export function DishList({ days, diets = [], collapsed = true, showService = false }: { days: MenuDay[]; diets?: DietTag[]; collapsed?: boolean; showService?: boolean }) {
  const [open, setOpen] = useState(!collapsed)
  if (!days.length) return null
  return (
    <div className="space-y-2">
      {days.map((day) => {
        const items = [...day.items].sort((a, b) => COURSE_ORDER[a.course ?? 'other'] - COURSE_ORDER[b.course ?? 'other'])
        const highlighted = diets.length ? items.filter((i) => matches(i, diets)) : items
        const mains = highlighted.filter((i) => !i.course || i.course === 'main' || i.course === 'soup')
        const preview = (mains.length ? mains : highlighted).slice(0, 4)
        const list = open ? items : preview
        const hiddenCount = items.length - list.length
        return (
          <div key={`${day.date}-${day.service}`}>
            {showService && <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">{MEAL_LABEL[day.service]}</div>}
            {day.note && <div className="mb-1 text-xs italic text-stone-500">{day.note}</div>}
            <ul className="space-y-0.5 text-sm">
              {list.map((d, i) => {
                const dim = diets.length > 0 && !matches(d, diets)
                return (
                  <li key={i} className={`flex items-baseline justify-between gap-2 ${dim ? 'text-stone-400 dark:text-stone-600' : ''} ${d.sold_out ? 'line-through' : ''}`}>
                    <span className="min-w-0">
                      {d.course === 'side' && <span className="mr-1 text-xs text-stone-400">side</span>}
                      {d.course === 'dessert' && <span className="mr-1 text-xs text-stone-400">pud</span>}
                      {d.name} <DietTags tags={d.tags} />
                    </span>
                    {d.price_gbp !== undefined && (
                      <span className="shrink-0 tabular-nums text-stone-500" title={d.price_text}>
                        £{d.price_gbp.toFixed(2)}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
            {hiddenCount > 0 && (
              <button type="button" onClick={() => setOpen(true)} className="mt-1 text-xs font-medium text-grub-600 hover:underline">
                Show all {items.length} items
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
