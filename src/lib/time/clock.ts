import type { Day } from '../data/types.ts'
import { DAYS } from '../data/types.ts'

export const TZ = 'Europe/London'

/** A calendar instant in Europe/London, independent of the browser's zone. */
export type LocalNow = {
  date: string // YYYY-MM-DD
  day: Day
  minutes: number // minutes since local midnight
}

export function toLocalNow(d: Date = new Date()): LocalNow {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const date = `${get('year')}-${get('month')}-${get('day')}`
  const day = get('weekday').toLowerCase().slice(0, 3) as Day
  return { date, day, minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function minutesToHHMM(min: number): string {
  const m = ((min % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}

export function dayOfISO(iso: string): Day {
  const [y, m, d] = iso.split('-').map(Number)
  const idx = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
  return DAYS[idx]
}

export function nextDay(day: Day): Day {
  return DAYS[(DAYS.indexOf(day) + 1) % 7]
}

const DAY_LABEL: Record<Day, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }
export const dayLabel = (d: Day) => DAY_LABEL[d]

export function formatISODate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts }).format(new Date(Date.UTC(y, m - 1, d)))
}

/** Compress a day list to "Mon–Fri", "Sat, Sun", "Daily". */
export function formatDays(days: Day[]): string {
  const idx = [...new Set(days)].map((d) => DAYS.indexOf(d)).sort((a, b) => a - b)
  if (idx.length === 7) return 'Daily'
  const runs: number[][] = []
  for (const i of idx) {
    const last = runs.at(-1)
    if (last && last.at(-1) === i - 1) last.push(i)
    else runs.push([i])
  }
  return runs.map((r) => (r.length >= 3 ? `${DAY_LABEL[DAYS[r[0]]]}–${DAY_LABEL[DAYS[r.at(-1)!]]}` : r.map((i) => DAY_LABEL[DAYS[i]]).join(', '))).join(', ')
}
