import { MenuDay } from '../../schema.ts'
import { mealCancelled } from '../../../src/lib/menuNotes.ts'
import type { Scope } from './checks.ts'
import { addDays, isoWeek, weekDates, weekMonday } from './dates.ts'
import { mergeDays, type MenuSource } from './source.ts'

/** The last date a scope asks for; undefined for `all`, which runs until the source stops publishing. */
export function scopeEnd(scope: Scope, today: string): string | undefined {
  if (scope === 'soon') return addDays(today, 1)
  if (scope === 'fortnight') return addDays(weekMonday(isoWeek(today)), 13)
  return undefined
}

/**
 * `all`: discover weeks until the source stops publishing, keeping every dated menu it returns, however far ahead.
 * `soon` and `fortnight`: ask only for today to the scope's end. A source that returns more (a whole page of weeks)
 * still has all of it kept from today on.
 */
export async function fetchRange(src: MenuSource, today: string, from?: string, scope: Scope = 'all'): Promise<MenuDay[]> {
  const days = new Map<string, MenuDay>()
  // Whole-source responses can repeat the same menus each week: replace them, don't duplicate their dishes.
  const keep = (got: MenuDay[]) => {
    for (const day of mergeDays(got.map((d) => MenuDay.parse(d)))) days.set(`${day.date}/${day.service}`, day)
  }
  const current = weekMonday(isoWeek(today))
  const end = scopeEnd(scope, today)
  if (end) {
    for (let monday = current; monday <= end; monday = addDays(monday, 7)) {
      const week = isoWeek(monday)
      const dates = weekDates(week).filter((d) => d >= today && d <= end)
      const res = await src.adapter!.fetch({ week, dates, today })
      keep(res.days.filter((d) => d.date >= today && (d.items.length || mealCancelled(d))))
    }
  } else {
    const start = from ? weekMonday(isoWeek(from)) : current
    for (let monday = start; ; monday = addDays(monday, 7)) {
      const week = isoWeek(monday)
      const dates = weekDates(week)
      const res = await src.adapter!.fetch({ week, dates, today })
      const got = res.days.filter((d) => d.date >= start && (d.items.length || mealCancelled(d)))
      keep(got)
      // Past gaps do not stop backfilling. Menus already returned beyond this gap are still kept.
      if (monday > current && !got.some((d) => dates.includes(d.date))) break
    }
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date) || a.service.localeCompare(b.service))
}
