// Compile hand-transcribed menus/<week>/<college>.txt into <college>.json (same schema as scripted sources).
//
// Format:
//   college: churchill
//   venue: dining-hall
//   source: https://...
//   note: optional free text
//   ---
//   2026-10-05 lunch            <- starts a service block (date + breakfast|brunch|lunch|dinner)
//   ## Sides                    <- optional course heading for following lines (soup/main/side/dessert/other)
//   Carrot & coconut soup (VG)  <- dish; (V)/(VG)/(H)/(GF)/(PB) markers become tags; trailing £x.xx becomes price
//   Roast pork £3.60 | note     <- anything after " | " is appended to the dish name in brackets
//   # comment
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Meal, MenuFile, type Dish, type MenuDay } from '../schema.ts'
import { cleanName, courseFromHeading, parsePrice, tagsFromName } from './lib/tags.ts'

export function compileManual(text: string, week: string): MenuFile {
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
  return MenuFile.parse({
    college: meta.college,
    venue: meta.venue,
    week,
    source_url: meta.source,
    fetched_at: meta.fetched ?? new Date().toISOString(),
    method: 'llm',
    note: meta.note || undefined,
    days: days.filter((d) => d.items.length),
  })
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) {
  const root = 'menus'
  let n = 0
  for (const week of readdirSync(root)) {
    const dir = join(root, week)
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.txt'))) {
      try {
        const file = compileManual(readFileSync(join(dir, f), 'utf8'), week)
        writeFileSync(join(dir, f.replace(/\.txt$/, '.json')), JSON.stringify(file, null, 2) + '\n')
        const dishes = file.days.reduce((k, d) => k + d.items.length, 0)
        console.log(`✓ ${week}/${f.padEnd(22)} ${String(file.days.length).padStart(2)} services ${String(dishes).padStart(4)} dishes`)
        n++
      } catch (e) {
        console.error(`✗ ${week}/${f}: ${(e as Error).message}`)
        process.exitCode = 1
      }
    }
  }
  if (!n) console.log('no .txt menus found')
}
