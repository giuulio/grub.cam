import type { Meal, MenuDay, Slot } from '../types.ts'
import { addDaysISO, dayOfISO, hhmmToMinutes, type LocalNow } from './clock.ts'
import { isFullTerm } from './termDates.ts'

export type OpenStatus =
  | { kind: 'open'; slot: Slot; closesInMin: number; date: string }
  | { kind: 'opening'; slot: Slot; opensInMin: number; date: string }
  | { kind: 'closed'; next?: { slot: Slot; date: string; opensInMin: number } }
  | { kind: 'unknown' }

/** Meals that can stand in for each other on a day that only serves one: a brunch is the morning's breakfast and lunch. */
const STANDS_IN: Partial<Record<Meal, Meal[]>> = { breakfast: ['brunch'], lunch: ['brunch'], brunch: ['lunch', 'breakfast'] }

/**
 * Files each menu under the meal served that day, when the source names one that isn't but its brunch counterpart is
 * (Corpus posts Saturday's brunch as "Lunch"). A day with no hours, or whose meal is served, is left as posted.
 */
export function servedService<D extends Pick<MenuDay, 'date' | 'service'>>(days: D[], slots: Slot[]): D[] {
  const taken = new Set(days.map((d) => `${d.date}/${d.service}`))
  return days.map((d) => {
    const on = slots.filter((s) => slotApplies(s, d.date)).map((s) => s.meal)
    if (!on.length || on.includes(d.service)) return d
    const meal = STANDS_IN[d.service]?.find((m) => on.includes(m) && !taken.has(`${d.date}/${m}`))
    if (!meal) return d
    taken.add(`${d.date}/${meal}`)
    return { ...d, service: meal }
  })
}

/** Does this slot apply on the given date, considering term/vacation? */
export function slotApplies(slot: Slot, date: string): boolean {
  if (!slot.days.includes(dayOfISO(date))) return false
  if (slot.period === 'all') return true
  return slot.period === 'term' ? isFullTerm(date) : !isFullTerm(date)
}

function slotEndMinutes(slot: Slot): number {
  const s = hhmmToMinutes(slot.start)
  const e = hhmmToMinutes(slot.end)
  return e <= s ? e + 1440 : e // crosses midnight (e.g. bar 17:00–00:00)
}

/** Formal hall is booked ahead, so it only counts when asked for, or where it's all a venue holds (a Hall used only for formals). */
function walkIn(slots: Slot[]): Slot[] {
  const open = slots.filter((s) => s.meal !== 'formal')
  return open.length ? open : slots
}

/**
 * Compute status for a venue at `now`, optionally restricted to certain meals.
 * Looks ahead up to 7 days for the next service.
 */
export function openStatus(slots: Slot[], now: LocalNow, meals?: Meal[]): OpenStatus {
  const relevant = meals?.length ? slots.filter((s) => meals.includes(s.meal)) : walkIn(slots)
  if (!relevant.length) return { kind: 'unknown' }

  // Open now? Include slots from yesterday that cross midnight.
  let best: Extract<OpenStatus, { kind: 'open' }> | undefined
  for (const s of relevant) {
    if (slotApplies(s, now.date)) {
      const start = hhmmToMinutes(s.start)
      const end = slotEndMinutes(s)
      if (now.minutes >= start && now.minutes < end) {
        const closesInMin = end - now.minutes
        if (!best || closesInMin > best.closesInMin) best = { kind: 'open', slot: s, closesInMin, date: now.date }
      }
    }
    const yesterday = addDaysISO(now.date, -1)
    if (slotApplies(s, yesterday)) {
      const end = slotEndMinutes(s) - 1440
      if (end > 0 && now.minutes < end) {
        const closesInMin = end - now.minutes
        if (!best || closesInMin > best.closesInMin) best = { kind: 'open', slot: s, closesInMin, date: yesterday }
      }
    }
  }
  if (best) return best

  // Next opening within 7 days
  let next: { slot: Slot; date: string; opensInMin: number } | undefined
  let date = now.date
  for (let i = 0; i < 8; i++) {
    for (const s of relevant) {
      if (!slotApplies(s, date)) continue
      const start = hhmmToMinutes(s.start) + i * 1440
      if (start <= now.minutes) continue
      const opensInMin = start - now.minutes
      if (!next || opensInMin < next.opensInMin) next = { slot: s, date, opensInMin }
    }
    if (next) break
    date = addDaysISO(date, 1)
  }
  if (next && next.date === now.date) return { kind: 'opening', slot: next.slot, opensInMin: next.opensInMin, date: next.date }
  return { kind: 'closed', next }
}


/** Sort key: open (soonest to close first) < opening soon < closed (soonest to open) < unknown */
export function statusRank(s: OpenStatus): number {
  switch (s.kind) {
    case 'open':
      return 0
    case 'opening':
      return 1_000_000 + s.opensInMin
    case 'closed':
      return 2_000_000 + (s.next?.opensInMin ?? 500_000)
    case 'unknown':
      return 3_000_000
  }
}
