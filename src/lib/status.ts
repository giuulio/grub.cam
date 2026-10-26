import { MEAL_LABEL } from './filters.ts'
import type { Meal } from './types.ts'
import { addDaysISO, dayLabel, dayOfISO } from './time/clock.ts'
import type { OpenStatus } from './time/openNow.ts'

export type StatusWords = {
  kind: OpenStatus['kind']
  /** Formal hall is booked, not walked into: it's "Formal hall 19:30", never "Opens" */
  formal: boolean
  /**
   * "Open", "Dinner", "Formal hall" while open; "Opens 17:45", "Opens tomorrow 08:00", "Dinner 18:00", "Breakfast
   * tomorrow 07:30", "Formal hall Mon 19:30" before; "Closed", "Hours not published"
   */
  text: string
  /** "until 16:00" while open */
  detail?: string
}

/** A meal a status leads with: a sitting, not a café's or a bar's hours, which are just "Open". */
export const leadsWithMeal = (m: Meal) => m !== 'snacks' && m !== 'bar'

/**
 * A venue's open status in words, the same in a list, on the map and on its page. `meal`, for a venue that serves
 * more than one, leads with the meal instead of "Open"/"Opens" ("Dinner until 19:30", "Breakfast tomorrow 07:30"), as
 * formal hall always does; its café and bar hours stay "Open until 20:00", which reads better than "Café until 20:00".
 */
export function statusWords(s: OpenStatus, today: string, { meal = false } = {}): StatusWords {
  if (s.kind === 'unknown') return { kind: s.kind, formal: false, text: 'Hours not published' }
  if (s.kind === 'closed' && !s.next) return { kind: s.kind, formal: false, text: 'Closed' }
  const { slot, date } = s.kind === 'closed' ? s.next! : s
  const formal = slot.meal === 'formal'
  const name = formal ? 'Formal hall' : meal && leadsWithMeal(slot.meal) ? MEAL_LABEL[slot.meal] : undefined
  if (s.kind === 'open') return { kind: s.kind, formal, text: name ?? 'Open', detail: `until ${slot.end}` }
  const day = date === today ? '' : date === addDaysISO(today, 1) ? 'tomorrow ' : `${dayLabel(dayOfISO(date))} `
  return { kind: s.kind, formal, text: `${name ?? 'Opens'} ${day}${slot.start}` }
}
