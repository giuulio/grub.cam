// Usage: npm run ingest:prices -- prices.txt [...] [--dry]
// Saves a venue's posted price list to Supabase, replacing the one before. Keep the .txt files outside the repo.
//
// Format:
//   site: murray-edwards
//   venue: dome-dining-hall
//   source: Noticeboard outside the Dome   <- a URL, or where it was seen
//   observed: 2026-10-08                   <- the day it was seen
//   ---
//   ## Brunch | brunch                     <- section heading for the lines after it, and the meals they're sold at (default: all)
//   Bacon rashers x 2 | 95p | £1.30        <- name | price | non-member price (optional); £3.75, 3.75 or 95p
//   Main course dish | £3.75 | £5.65 | main   <- a 4th field prices every dish of that course on the day's menu
//                                             (soup/main/side/dessert/other), or the whole meal (meal); shown on the menu
//   Soup | £1.75 | | soup                  <- an empty field skips the non-member price
//   # comment
// Lines without a course are sold at those meals as listed: the menu itself when the meal has no dishes posted (a fixed brunch).
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { Meal, PriceCourse, PriceItem } from '../schema.ts'
import { connect } from './lib/db.ts'

export type PriceList = { venue: string; source: string; observed_on: string; items: PriceItem[] }

/** "£3.75", "3.75" or "95p" in pounds. */
export function parseGbp(s: string): number {
  const t = s.trim()
  const pence = t.match(/^(\d+)p$/)
  if (pence) return Number(pence[1]) / 100
  const pounds = t.match(/^£?\s*(\d+(?:\.\d{1,2})?)$/)
  if (pounds) return Number(pounds[1])
  throw new Error(`not a price: "${s}"`)
}

export function parsePrices(text: string): PriceList {
  const [head, body] = text.split(/\n---\n/)
  if (!body) throw new Error('missing --- separator')
  const meta: Record<string, string> = {}
  for (const l of head.split('\n')) {
    const m = l.match(/^(\w+):\s*(.*)$/)
    if (m) meta[m[1]] = m[2].trim()
  }
  if (!meta.site || !meta.venue || !meta.source || !/^\d{4}-\d{2}-\d{2}$/.test(meta.observed ?? '')) throw new Error('header needs site, venue, source and observed (YYYY-MM-DD)')
  const items: PriceItem[] = []
  let section: string | undefined
  let services: Meal[] | undefined
  for (const raw of body.split('\n')) {
    const line = raw.trim()
    if (!line || (line.startsWith('#') && !line.startsWith('## '))) continue
    if (line.startsWith('## ')) {
      const [heading, meals] = line.slice(3).split('|').map((p) => p.trim())
      section = heading
      services = meals ? meals.split(',').map((m) => Meal.parse(m.trim().toLowerCase())) : undefined
      continue
    }
    const [name, price, nonMember, course, ...rest] = line.split('|').map((p) => p.trim())
    if (!price || rest.length) throw new Error(`expected "name | price | non-member price | course": "${line}"`)
    items.push(
      PriceItem.parse({
        section,
        name,
        price_gbp: parseGbp(price),
        ...(nonMember ? { non_member_gbp: parseGbp(nonMember) } : {}),
        ...(services ? { services } : {}),
        ...(course ? { course: PriceCourse.parse(course) } : {}),
      }),
    )
  }
  return { venue: `${meta.site}/${meta.venue}`, source: meta.source, observed_on: meta.observed, items }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) {
  const { values, positionals } = parseArgs({ options: { dry: { type: 'boolean' } }, allowPositionals: true })
  if (!positionals.length) throw new Error('usage: npm run ingest:prices -- prices.txt [...] [--dry]')
  const db = values.dry ? undefined : connect()
  for (const f of positionals) {
    try {
      const p = parsePrices(readFileSync(f, 'utf8'))
      await db?.savePrices(p.venue, p.observed_on, p.source, p.items)
      console.log(`✓ ${p.venue.padEnd(40)} ${String(p.items.length).padStart(3)} prices`)
    } catch (e) {
      console.error(`✗ ${f}: ${(e as Error).message}`)
      process.exitCode = 1
    }
  }
}
