import { parse } from 'node-html-parser'
import type { MenuDay } from '../../schema.ts'
import { WEEKDAYS, addDays } from '../lib/dates.ts'
import { fetchText } from '../lib/http.ts'
import type { Adapter } from '../lib/source.ts'
import { cleanName, tagsFromName } from '../lib/tags.ts'

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

/** "Week commencing 5th October 2026" -> 2026-10-05 */
export function weekCommencing(text: string): string | undefined {
  const m = text.match(/week commencing\s+(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\s+(\d{4})/i)
  const month = m ? MONTHS.indexOf(m[2].toLowerCase()) : -1
  if (!m || month < 0) return
  return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

/** Sides come as one line; commas and "&" also appear inside dishes, so only split before a capital. */
export function splitSides(text: string): string[] {
  return text
    .split(/,\s+(?=[A-Z])|\s+&\s+(?=[A-Z])/)
    .map(cleanName)
    .filter(Boolean)
}

/** A University Catering page's weekly menu: "Week commencing …", then each weekday in bold and its dishes as a list. */
export function parseUcsMenu(html: string): MenuDay[] {
  const root = parse(html)
  const days: MenuDay[] = []
  let start: string | undefined
  let day: MenuDay | undefined
  for (const el of (root.querySelector('main') ?? root).querySelectorAll('h4, strong, li')) {
    const text = el.text.replace(/\s+/g, ' ').trim()
    if (el.tagName === 'H4') {
      start = weekCommencing(text) ?? start
      continue
    }
    if (el.tagName === 'STRONG') {
      // A weekday starts its list; any other bold text ("Opening hours:") ends it.
      const idx = WEEKDAYS.indexOf(text.toLowerCase())
      day = undefined
      if (start && idx >= 0) {
        // The heading should be a Monday, but count from whatever day it names.
        const startIdx = (new Date(`${start}T12:00:00Z`).getUTCDay() + 6) % 7
        day = { date: addDays(start, (idx - startIdx + 7) % 7), service: 'lunch', items: [] }
        days.push(day)
      }
      continue
    }
    if (!day) continue
    const sides = text.match(/^sides?\s*:\s*(.+)$/i)
    if (sides) for (const s of splitSides(sides[1])) day.items.push({ ...tagsFromName(s), course: 'side' })
    else if (cleanName(text)) day.items.push({ ...tagsFromName(cleanName(text)), course: 'main' })
  }
  return days.filter((d) => d.items.length)
}

/** University Catering venues that post this week's lunch on their page (West Hub Canteen, Greenwich House Café, Scholars Brew). */
export const ucsWeekly = (url: string): Adapter => ({
  async fetch() {
    return { days: parseUcsMenu(await fetchText(url)), note: 'Lunch mains and sides as listed; no diet labels.' }
  },
})
