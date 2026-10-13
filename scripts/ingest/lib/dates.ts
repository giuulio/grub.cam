// All dates are calendar dates in Europe/London; we never need instants here.

export function toISODate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function addDays(iso: string, n: number): string {
  const d = fromISODate(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return toISODate(d)
}

export function todayLondon(): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** ISO 8601 week id, e.g. 2026-W41 */
export function isoWeek(iso: string): string {
  const d = fromISODate(iso)
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Monday of the given ISO week id. */
export function weekMonday(week: string): string {
  const [y, w] = week.split('-W').map(Number)
  const jan4 = new Date(Date.UTC(y, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const monday = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (w - 1) * 7)
  return toISODate(monday)
}

export function weekDates(week: string): string[] {
  const mon = weekMonday(week)
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i))
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

/** Parse "Thursday 8th October 2026", "Thu 8 Oct 2026", "Wednesday 7th Oct" (year defaulted). */
export function parseLongDate(text: string, defaultYear: number): string | undefined {
  const m = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\.?(?:\s+(\d{4}))?/)
  if (!m) return undefined
  const day = Number(m[1])
  const mon = MONTHS.findIndex((x) => x.startsWith(m[2].toLowerCase().slice(0, 3)))
  if (mon < 0) return undefined
  const year = m[3] ? Number(m[3]) : defaultYear
  return toISODate(new Date(Date.UTC(year, mon, day)))
}

export function weekdayIndex(text: string): number {
  const t = text.toLowerCase()
  return WEEKDAYS.findIndex((w) => t.includes(w) || t.includes(w.slice(0, 3)))
}

/** "12 October", "05th October", "12.10" (day.month): the date nearest `today` that it can be, since listings rarely give the year. */
export function dateNear(text: string, today: string): string | undefined {
  const named = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,})/)
  const dotted = named ? undefined : text.match(/\b(\d{1,2})[./](\d{1,2})\b/)
  const day = Number((named ?? dotted)?.[1])
  const month = named ? MONTHS.findIndex((x) => x.startsWith(named[2].toLowerCase().slice(0, 3))) : dotted ? Number(dotted[2]) - 1 : -1
  if (!day || month < 0 || month > 11) return undefined
  const year = Number(today.slice(0, 4))
  const near = [year - 1, year, year + 1].map((y) => toISODate(new Date(Date.UTC(y, month, day))))
  const gap = (iso: string) => Math.abs(fromISODate(iso).getTime() - fromISODate(today).getTime())
  return near.sort((a, b) => gap(a) - gap(b))[0]
}

/** "Monday 12 October 2026" */
export function longDate(iso: string): string {
  const d = fromISODate(iso)
  const weekday = WEEKDAYS[(d.getUTCDay() + 6) % 7]
  const month = MONTHS[d.getUTCMonth()]
  return `${weekday[0].toUpperCase()}${weekday.slice(1)} ${d.getUTCDate()} ${month[0].toUpperCase()}${month.slice(1)} ${d.getUTCFullYear()}`
}
