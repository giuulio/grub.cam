// Usage: npm run ingest:hours -- hours.txt [...] [--dry] [--keep]
// Saves a venue's opening hours → service_slots, replacing the venue's slots (--keep adds to them instead).
// Keep the .txt files outside the repo. Also what a submission's hours transcription is parsed with.
//
// Format:
//   site: clare
//   venue: buttery
//   source: photo of the board by the servery      <- a URL, or where it was seen
//   observed: 2026-10-09                           <- the day it was seen
//   period: term                                   <- optional default for the lines (term|vacation|all; default all)
//   confidence: medium                             <- optional (low|medium|high; default medium)
//   ---
//   lunch | Mon–Fri | 12:30–13:30                  <- meal | days | times [| period [| note]]
//   dinner | Mon-Sat, Sun | 6.15pm-7.15pm | term | Sunday from the College page
//   formal | Tue, Thu, Sun | 19:30 | term          <- a start alone: ends two hours later, noted as unpublished
//   bar | daily | 19:00-00:00                      <- "daily"/"every day" = all seven; ends past midnight are fine
//   # comment
// Meals: breakfast, brunch, lunch, dinner, formal, snacks (a café's hours), bar.
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { Meal } from '../schema.ts'
import { connect } from './lib/db.ts'

export type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type Period = 'term' | 'vacation' | 'all'
export type Slot = { meal: Meal; days: Day[]; start: string; end: string; period: Period; note?: string }
export type Hours = { venue: string; source: string; observed_on: string; confidence: 'low' | 'medium' | 'high'; slots: Slot[] }

const DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const PERIODS = ['term', 'vacation', 'all'] as const
const FORMAL_LENGTH = 120 // minutes, when only a start is published

/** "Mon–Fri", "Mon-Sat, Sun", "Tue, Thu, Sun", "daily", "weekends", "weekdays" → days in week order. */
export function parseDays(text: string): Day[] {
  const t = text.trim().toLowerCase()
  if (/^(daily|every ?day|all week|mon[–-]sun)$/.test(t)) return [...DAYS]
  const out = new Set<Day>()
  for (const part of t.split(/[,&+]|\band\b/).map((p) => p.trim()).filter(Boolean)) {
    if (part === 'weekdays') for (const d of DAYS.slice(0, 5)) out.add(d)
    else if (part === 'weekends') for (const d of DAYS.slice(5)) out.add(d)
    else {
      const range = part.match(/^([a-z]+)\s*(?:[–-]|to)\s*([a-z]+)$/)
      if (range) {
        const a = dayIndex(range[1]), b = dayIndex(range[2])
        for (let i = a; ; i = (i + 1) % 7) {
          out.add(DAYS[i])
          if (i === b) break
        }
      } else out.add(DAYS[dayIndex(part)])
    }
  }
  if (!out.size) throw new Error(`no days in "${text}"`)
  return DAYS.filter((d) => out.has(d))
}

function dayIndex(word: string): number {
  const i = DAYS.findIndex((d) => word.startsWith(d))
  if (i < 0) throw new Error(`not a day: "${word}"`)
  return i
}

/** "12:30", "6.15pm", "8am", "noon", "midnight" → "HH:MM". */
export function parseTime(text: string): string {
  const t = text.trim().toLowerCase()
  if (t === 'noon' || t === 'midday') return '12:00'
  if (t === 'midnight') return '00:00'
  const m = t.match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/)
  if (!m) throw new Error(`not a time: "${text}"`)
  let h = Number(m[1])
  const min = m[2] ?? '00'
  if (m[3] === 'pm' && h < 12) h += 12
  if (m[3] === 'am' && h === 12) h = 0
  if (h > 24 || Number(min) > 59) throw new Error(`not a time: "${text}"`)
  return `${String(h % 24).padStart(2, '0')}:${min}`
}

/** "12:30–13:30", "6.15pm-7.15pm", "19:30" (a start alone) → start and end; `startOnly` when no end was given. */
export function parseTimes(text: string): { start: string; end?: string } {
  const parts = text.split(/\s*(?:[–-]|to|until)\s*/).map((p) => p.trim()).filter(Boolean)
  if (parts.length === 1) return { start: parseTime(parts[0]) }
  if (parts.length !== 2) throw new Error(`not a time range: "${text}"`)
  // "6.15-7.15pm": the first time takes the second's am/pm when it has none of its own
  const suffix = parts[1].match(/(am|pm)$/i)?.[1]
  const start = /am|pm/i.test(parts[0]) || !suffix ? parts[0] : parts[0] + suffix
  return { start: parseTime(start), end: parseTime(parts[1]) }
}

const addMinutes = (hhmm: string, n: number) => {
  const [h, m] = hhmm.split(':').map(Number)
  const total = (h * 60 + m + n) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function parseHours(text: string): Hours {
  const [head, body] = text.split(/\n---\n/)
  if (!body) throw new Error('missing --- separator')
  const meta: Record<string, string> = {}
  for (const l of head.split('\n')) {
    const m = l.match(/^(\w+):\s*(.*)$/)
    if (m) meta[m[1]] = m[2].trim()
  }
  if (!meta.site || !meta.venue || !meta.source || !/^\d{4}-\d{2}-\d{2}$/.test(meta.observed ?? '')) throw new Error('header needs site, venue, source and observed (YYYY-MM-DD)')
  const defaultPeriod = (meta.period ?? 'all') as Period
  if (!PERIODS.includes(defaultPeriod)) throw new Error(`period must be term, vacation or all: "${meta.period}"`)
  const confidence = (meta.confidence ?? 'medium') as Hours['confidence']
  if (!['low', 'medium', 'high'].includes(confidence)) throw new Error(`confidence must be low, medium or high: "${meta.confidence}"`)
  const slots: Slot[] = []
  for (const raw of body.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const [meal, days, times, period, ...rest] = line.split('|').map((p) => p.trim())
    if (!meal || !days || !times) throw new Error(`expected "meal | days | times [| period [| note]]": "${line}"`)
    const parsed = parseTimes(times)
    const slot: Slot = {
      meal: Meal.parse(meal.toLowerCase()),
      days: parseDays(days),
      start: parsed.start,
      end: parsed.end ?? addMinutes(parsed.start, FORMAL_LENGTH),
      period: (period || defaultPeriod) as Period,
    }
    if (!PERIODS.includes(slot.period)) throw new Error(`period must be term, vacation or all: "${period}"`)
    const notes = [...rest.filter(Boolean)]
    if (!parsed.end) notes.push(slot.meal === 'formal' ? 'end not published (about two hours)' : 'end not published')
    if (notes.length) slot.note = notes.join('; ')
    slots.push(slot)
  }
  if (!slots.length) throw new Error('no hours')
  return { venue: `${meta.site}/${meta.venue}`, source: meta.source, observed_on: meta.observed, confidence, slots }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) {
  const { values, positionals } = parseArgs({ options: { dry: { type: 'boolean' }, keep: { type: 'boolean' } }, allowPositionals: true })
  if (!positionals.length) throw new Error('usage: npm run ingest:hours -- hours.txt [...] [--dry] [--keep]')
  const db = values.dry ? undefined : connect()
  for (const f of positionals) {
    try {
      const h = parseHours(readFileSync(f, 'utf8'))
      await db?.saveHours(h, { replace: !values.keep, source_kind: 'reported' })
      console.log(`✓ ${h.venue.padEnd(40)} ${String(h.slots.length).padStart(3)} slots`)
    } catch (e) {
      console.error(`✗ ${f}: ${(e as Error).message}`)
      process.exitCode = 1
    }
  }
}
