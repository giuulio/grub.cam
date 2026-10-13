// What the Send page shows of a model's reading while it arrives, and the meal a menu is taken as when its board
// doesn't say.
import { DINING_MEALS } from './finder.ts'
import { hhmmToMinutes, type LocalNow } from './time/clock.ts'
import { slotApplies } from './time/openNow.ts'
import type { Meal, Venue } from './types.ts'

export type Readable = 'menu' | 'prices' | 'hours'

/** One line of a reading as it arrives, for the sender to watch: a day and meal, a section, or an item with its prices. */
export type Line = { kind: 'day' | 'section' | 'item' | 'meta'; text: string; detail?: string; price?: string }

export function readableLines(body: string, kind: Readable): Line[] {
  return body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !(l.startsWith('#') && !l.startsWith('## ')))
    .map((l): Line => {
      if (l.startsWith('## ')) return { kind: 'section', text: l.slice(3).split('|')[0].trim() }
      const columns = l.match(/^columns:\s*(.*)$/i)
      if (columns) return { kind: 'meta', text: columns[1].split('|').map((c) => c.trim()).join(' · ') }
      const day = kind === 'menu' && l.match(/^(\d{4}-\d{2}-\d{2})\s+(\w+)(?:\s*\|\s*(.*))?$/)
      if (day) return { kind: 'day', text: `${day[1]} ${day[2]}`, detail: day[3]?.replace(/^!\s*/, '') }
      const f = l.split('|').map((p) => p.trim())
      if (kind === 'hours') return { kind: 'item', text: f[0], detail: f.slice(1).filter(Boolean).join(' · ') }
      if (kind === 'prices') return { kind: 'item', text: f[0], price: [f[1], f[2]].filter(Boolean).join(' · '), detail: f[4] }
      return { kind: 'item', text: f[0], detail: f.slice(1).join(' · ') || undefined }
    })
}

/** The meals of a dining venue's hours (all of them when it has none on record). */
export function servedMeals(venue: Pick<Venue, 'slots'>): Meal[] {
  const served = DINING_MEALS.filter((m) => venue.slots.some((s) => s.meal === m))
  return served.length ? served : DINING_MEALS
}

/** The meal being served now, or next today, by the venue's hours; its first meal once today's are over; lunch when it has no meal hours (a café). */
export function mealNow(venue: Pick<Venue, 'slots'>, now: LocalNow): Meal {
  const today = venue.slots
    .filter((s) => DINING_MEALS.includes(s.meal) && slotApplies(s, now.date))
    .sort((a, b) => a.start.localeCompare(b.start))
  return today.find((s) => hhmmToMinutes(s.end) > now.minutes)?.meal ?? DINING_MEALS.find((m) => venue.slots.some((s) => s.meal === m)) ?? 'lunch'
}
