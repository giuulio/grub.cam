// Usage: npm run ingest:manual -- path/to/menu.txt [...] [--dry]
// Saves hand-transcribed menus to Supabase. Keep the .txt files outside the repo.
//
// Format:
//   site: churchill          <- the college or University site ("college:" also works)
//   venue: dining-hall
//   source: https://...
//   fetched: 2026-10-07T20:40:00Z  <- optional, when it was read (defaults to now)
//   ---
//   2026-10-05 lunch            <- starts a service block (date + breakfast|brunch|lunch|dinner)
//   ## Sides                    <- optional course heading for following lines (soup/main/side/dessert/other)
//   Carrot & coconut soup (VG)  <- dish; (V)/(VG)/(H)/(GF)/(PB) markers become tags; trailing £x.xx becomes price
//   Roast pork £3.60 | note     <- anything after " | " is appended to the dish name in brackets
//   # comment
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { Meal, MenuDay, type Dish } from '../schema.ts'
import { connect } from './lib/db.ts'
import { cleanName, courseFromHeading, parsePrice, tagsFromName } from './lib/tags.ts'

export type ManualMenu = { venue: string; source_url: string; fetched_at: string; days: MenuDay[] }

export function parseManual(text: string): ManualMenu {
  const [head, body] = text.split(/\n---\n/)
  if (!body) throw new Error('missing --- separator')
  const meta: Record<string, string> = {}
  for (const l of head.split('\n')) {
    const m = l.match(/^(\w+):\s*(.*)$/)
    if (m) meta[m[1]] = m[2].trim()
  }
  const days: MenuDay[] = []
  let cur: MenuDay | undefined
  let course: Dish['course'] = 'main'
  for (const raw of body.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#') && !line.startsWith('## ')) continue
    const svc = line.match(/^(\d{4}-\d{2}-\d{2})\s+(\w+)(?:\s*\|\s*(.*))?$/)
    if (svc) {
      cur = { date: svc[1], service: Meal.parse(svc[2].toLowerCase()), items: [], ...(svc[3] ? { note: svc[3] } : {}) }
      days.push(cur)
      course = 'main'
      continue
    }
    if (line.startsWith('## ')) {
      course = courseFromHeading(line.slice(3))
      if (course === 'other' && /main/i.test(line)) course = 'main'
      continue
    }
    if (!cur) throw new Error(`dish before any service line: "${line}"`)
    const [namePart, ...noteParts] = line.split(' | ')
    const price = parsePrice(namePart)
    const { name, tags } = tagsFromName(cleanName(namePart.replace(/£\s*\d+(?:\.\d{1,2})?(\s*\/\s*£\s*\d+(?:\.\d{1,2})?)?/g, '')))
    const priceText = namePart.match(/£\s*\d+(?:\.\d{1,2})?\s*\/\s*£\s*\d+(?:\.\d{1,2})?/)?.[0]
    const full = noteParts.length ? `${name} (${noteParts.join(' | ')})` : name
    cur.items.push({ name: full, tags, course, ...(price !== undefined ? { price_gbp: price } : {}), ...(priceText ? { price_text: priceText } : {}) })
  }
  const site = meta.site ?? meta.college
  if (!site || !meta.venue || !meta.source) throw new Error('header needs site, venue and source')
  return {
    venue: `${site}/${meta.venue}`,
    source_url: meta.source,
    fetched_at: meta.fetched ?? new Date().toISOString(),
    days: days.filter((d) => d.items.length).map((d) => MenuDay.parse(d)),
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) {
  const { values, positionals } = parseArgs({ options: { dry: { type: 'boolean' } }, allowPositionals: true })
  if (!positionals.length) throw new Error('usage: npm run ingest:manual -- menu.txt [...] [--dry]')
  const db = values.dry ? undefined : connect()
  for (const f of positionals) {
    const started = new Date().toISOString()
    try {
      const m = parseManual(readFileSync(f, 'utf8'))
      await db?.saveMenu(m.venue, m.source_url, m.fetched_at, 'manual', m.days)
      const dishes = m.days.reduce((n, d) => n + d.items.length, 0)
      await db?.logRun({ venue_id: m.venue, method: 'manual', started_at: started, status: m.days.length ? 'ok' : 'empty', days: m.days.length, dishes })
      console.log(`✓ ${m.venue.padEnd(40)} ${String(m.days.length).padStart(3)} services ${String(dishes).padStart(5)} dishes`)
    } catch (e) {
      console.error(`✗ ${f}: ${(e as Error).message}`)
      process.exitCode = 1
    }
  }
}
