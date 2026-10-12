import { MenuDay } from '../../schema.ts'
import { mealCancelled } from '../../../src/lib/menuNotes.ts'
import { addDays, isoWeek, weekDates, weekMonday } from './dates.ts'
import { mergeDays, type MenuSource } from './source.ts'

/** Discover weeks until the source stops publishing, keeping every dated menu it returns, however far ahead. */
export async function fetchRange(src: MenuSource, today: string, from?: string): Promise<MenuDay[]> {
  const days = new Map<string, MenuDay>()
  const current = weekMonday(isoWeek(today))
  const start = from ? weekMonday(isoWeek(from)) : current
  for (let monday = start; ; monday = addDays(monday, 7)) {
    const week = isoWeek(monday)
    const dates = weekDates(week)
    const res = await src.adapter!.fetch({ week, dates, today })
    const got = res.days.filter((d) => d.date >= start && (d.items.length || mealCancelled(d)))
    // Whole-source responses can repeat the same menus each week: replace them, don't duplicate their dishes.
    for (const day of mergeDays(got.map((d) => MenuDay.parse(d)))) days.set(`${day.date}/${day.service}`, day)
    // Past gaps do not stop backfilling. Menus already returned beyond this gap are still kept.
    if (monday > current && !got.some((d) => dates.includes(d.date))) break
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date) || a.service.localeCompare(b.service))
}
