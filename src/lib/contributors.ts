// Who has filled in the most, for /contribute: members' approved submissions under their names (`contributions`),
// each worth what it adds (gapWeight(): a dining hall's menu most), and only the first of its kind for a venue on a
// day, so the same board sent twice, or a second photo of a venue, adds nothing. Rejected ones never count: they leave
// the view.
import { gapWeight } from './coverage.ts'
import { addDaysISO, formatISODate, toLocalNow } from './time/clock.ts'
import type { Contribution, Credit, Venue } from './types.ts'

export type Scored = Contribution & { points: number }

/** A contribution's London date. */
const dayOf = (iso: string) => toLocalNow(new Date(iso)).date

/** Each contribution with its points, oldest first: what it adds at its venue, or nothing when one like it was there first that day. */
export function scored(rows: Contribution[], venues: Pick<Venue, 'id' | 'type'>[]): Scored[] {
  const type = new Map(venues.map((v) => [v.id, v.type]))
  const seen = new Set<string>()
  return [...rows]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((r) => {
      // A menu is for its day and meal; anything else, for the day it was sent. A site's photo, for the site.
      const key = [r.venue_id ?? `site:${r.site}`, r.kind, r.kind === 'menu' ? `${r.date ?? dayOf(r.created_at)} ${r.service ?? ''}` : dayOf(r.created_at)].join(' ')
      const first = !seen.has(key)
      seen.add(key)
      return { ...r, points: first ? gapWeight(r.kind, (r.venue_id && type.get(r.venue_id)) || 'cafe') : 0 }
    })
}

/** A member's place: the name they last went up under, their points, and how many of each kind of thing scored. */
export type Standing = { member: string; author: string; points: number; counts: Partial<Record<Contribution['kind'], number>> }

/** Members by points (since `from`, a London date, or ever), most first; a tie goes to whoever got there first. Only those who scored. */
export function standings(rows: Scored[], from = ''): Standing[] {
  const by = new Map<string, Standing & { last: string }>()
  for (const r of rows) {
    if (!r.points || dayOf(r.created_at) < from) continue
    const s = by.get(r.member) ?? { member: r.member, author: r.author, points: 0, counts: {}, last: r.created_at }
    s.author = r.author
    s.points += r.points
    s.counts[r.kind] = (s.counts[r.kind] ?? 0) + 1
    s.last = r.created_at
    by.set(r.member, s)
  }
  return [...by.values()].sort((a, b) => b.points - a.points || a.last.localeCompare(b.last)).map(({ member, author, points, counts }) => ({ member, author, points, counts }))
}

const NOUN: Record<Contribution['kind'], [string, string]> = {
  menu: ['menu', 'menus'],
  prices: ['price list', 'price lists'],
  hours: ['set of hours', 'sets of hours'],
  photo: ['photo', 'photos'],
  other: ['correction', 'corrections'],
}

/** "3 menus · 1 price list": what a member's points are for, most first. */
export const tally = (counts: Standing['counts']) =>
  (Object.entries(counts) as [Contribution['kind'], number][])
    .sort((a, b) => b[1] - a[1])
    .map(([kind, n]) => `${n} ${NOUN[kind][n === 1 ? 0 : 1]}`)
    .join(' · ')

/** Who sent something a venue's page shows ("Ada Lovelace", "Ada Lovelace and Bob"), or undefined when no member did. */
export function sentBy(credits: Pick<Credit, 'author'>[] = []): string | undefined {
  const names = [...new Set(credits.map((c) => c.author))]
  return names.length ? names.join(', ').replace(/, ([^,]*)$/, ' and $1') : undefined
}

/** What was sent, as "Giulio Orlandi sent …" goes on: "the menu", "the price list". */
export const SENT: Record<Contribution['kind'], string> = { menu: 'the menu', prices: 'the price list', hours: 'the opening times', photo: 'a photo', other: 'a correction' }

/** When, as a person would say it: "just now", "25 min ago", "3 h ago", "yesterday", "13 Oct". */
export function ago(iso: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const today = toLocalNow(now).date
  const day = dayOf(iso)
  if (minutes < 12 * 60 || day === today) return `${Math.floor(minutes / 60)} h ago`
  if (day === addDaysISO(today, -1)) return 'yesterday'
  return formatISODate(day, { day: 'numeric', month: 'short', ...(day.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' }) })
}
