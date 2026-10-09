import { MEAL_LABEL } from './filters.ts'
import { addDaysISO, dayLabel, dayOfISO } from './time/clock.ts'
import type { OpenStatus } from './time/openNow.ts'

export type StatusWords = {
  kind: OpenStatus['kind']
  /** Formal hall is booked, not walked into: it's "Formal hall 19:30", never "Opens" */
  formal: boolean
  /** "Open", "Opens 17:45", "Opens tomorrow 08:00", "Formal hall Mon 19:30", "Closed", "Hours not published" */
  text: string
  /** "until 16:00" while open; with `meal`, which meal ("Lunch until 13:30", "for dinner", "as a bar") */
  detail?: string
}

/**
 * A venue's open status in words, the same in a list, on the map and on its page. `meal` names the meal too, for a
 * venue that serves more than one.
 */
export function statusWords(s: OpenStatus, today: string, { meal = false } = {}): StatusWords {
  if (s.kind === 'unknown') return { kind: s.kind, formal: false, text: 'Hours not published' }
  if (s.kind === 'closed' && !s.next) return { kind: s.kind, formal: false, text: 'Closed' }
  const { slot, date } = s.kind === 'closed' ? s.next! : s
  const formal = slot.meal === 'formal'
  const name = MEAL_LABEL[slot.meal]
  if (s.kind === 'open') return { kind: s.kind, formal, text: formal ? 'Formal hall now' : 'Open', detail: `${meal && !formal ? `${name} until` : 'until'} ${slot.end}` }
  const day = date === today ? '' : date === addDaysISO(today, 1) ? 'tomorrow ' : `${dayLabel(dayOfISO(date))} `
  return { kind: s.kind, formal, text: `${formal ? 'Formal hall' : 'Opens'} ${day}${slot.start}`, detail: meal && !formal ? `${slot.meal === 'snacks' || slot.meal === 'bar' ? 'as a' : 'for'} ${name.toLowerCase()}` : undefined }
}
