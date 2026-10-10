// Formal hall in words, the same on a venue's page and on its card under the Formal hall tab.
import { slotOrder } from './filters.ts'
import { formatGbp } from './prices.ts'
import { formatDays } from './time/clock.ts'
import type { Formal, Venue } from './types.ts'

const DRESS: Record<NonNullable<Formal['dress_code']>, string> = { black_tie: 'black tie', formal: 'jacket and tie, or equivalent', smart: 'smart', relaxed: 'relaxed' }

const sentence = (parts: (string | false | null | undefined)[]) => {
  const s = parts.filter(Boolean).join(', ')
  return s ? s[0].toUpperCase() + s.slice(1) : undefined
}

/** "Fri, Sat · 19:30, in term" for each formal slot; the days alone when its time isn't published. */
export function formalWhen(venue: Venue, f?: Formal): string[] {
  const slots = venue.slots.filter((s) => s.meal === 'formal').sort(slotOrder)
  if (slots.length) return slots.map((s) => `${formatDays(s.days)} · ${s.start}${s.period === 'term' ? ', in term' : s.period === 'vacation' ? ', out of term' : ''}`)
  return f?.days?.length ? [`${formatDays(f.days)} · time not published`] : []
}

/** "£25.00 · guests £30.00" */
export const formalPrice = (f: Formal) => (f.price_gbp != null ? `${formatGbp(f.price_gbp)}${f.guest_gbp != null ? ` · guests ${formatGbp(f.guest_gbp)}` : ''}` : undefined)

export const formalGuests = (f: Formal) => (f.guests_allowed === false ? 'No guests' : f.guests_allowed ? (f.guests_max != null ? `Up to ${f.guests_max} per member` : 'Allowed') : undefined)

/** "Black tie, gowns for members" */
export const formalDress = (f: Formal) => sentence([f.dress_code && DRESS[f.dress_code], f.gowns === 'required' ? 'gowns for members' : f.gowns === 'optional' && 'gowns optional'])

/** "UPay, by 12:00, 2 days before" */
export function formalBooking(f: Formal): string | undefined {
  const n = f.book_days_before
  const deadline = n != null && f.book_by && `by ${f.book_by}${n === 0 ? ' on the day' : n === 1 ? ' the day before' : `, ${n} days before`}`
  return sentence([f.book_via, deadline])
}
