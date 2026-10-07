import type { Meal, ServiceSlot } from '../data/types.ts'
import { addDaysISO, dayOfISO, hhmmToMinutes, nextDay, type LocalNow } from './clock.ts'
import { isFullTerm } from './termDates.ts'

export type OpenStatus =
  | { kind: 'open'; slot: ServiceSlot; closesInMin: number; date: string }
  | { kind: 'opening'; slot: ServiceSlot; opensInMin: number; date: string }
  | { kind: 'closed'; next?: { slot: ServiceSlot; date: string; opensInMin: number } }
  | { kind: 'unknown' }

/** Does this slot apply on the given date, considering term/vacation? */
export function slotApplies(slot: ServiceSlot, date: string): boolean {
  if (!slot.days.includes(dayOfISO(date))) return false
  if (slot.period === 'all') return true
  return slot.period === 'term' ? isFullTerm(date) : !isFullTerm(date)
}

function slotEndMinutes(slot: ServiceSlot): number {
  const s = hhmmToMinutes(slot.start)
  const e = hhmmToMinutes(slot.end)
  return e <= s ? e + 1440 : e // crosses midnight (e.g. bar 17:00–00:00)
}

/**
 * Compute status for a venue at `now`, optionally restricted to certain meals.
 * Looks ahead up to 7 days for the next service.
 */
export function openStatus(slots: ServiceSlot[], now: LocalNow, meals?: Meal[]): OpenStatus {
  const relevant = meals?.length ? slots.filter((s) => meals.includes(s.meal)) : slots
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
  let next: { slot: ServiceSlot; date: string; opensInMin: number } | undefined
  let date = now.date
  let day = now.day
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
    day = nextDay(day)
  }
  void day
  if (next && next.date === now.date) return { kind: 'opening', slot: next.slot, opensInMin: next.opensInMin, date: next.date }
  return { kind: 'closed', next }
}

/** Which meal is "current" for a default filter, by time of day; undefined = any (late evening / early morning). */
export function defaultMealFor(now: LocalNow): Meal | undefined {
  const h = now.minutes / 60
  const weekend = now.day === 'sat' || now.day === 'sun'
  if (h < 6) return undefined
  if (h < 10.5) return 'breakfast'
  if (h < 15) return weekend ? 'brunch' : 'lunch'
  if (h < 20.5) return 'dinner'
  return undefined
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
