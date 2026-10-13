// Usage: npm run ingest:prices -- prices.txt [...] [--dry]
// Saves a venue's posted price list to Supabase, replacing the one before. Keep the .txt files outside the repo.
//
// Format:
//   site: murray-edwards
//   venue: dome-dining-hall
//   source: Noticeboard outside the Dome   <- a URL, or where it was seen
//   observed: 2026-10-08                   <- the day it was seen
//   ---
//   columns: Members | Non-members         <- whose each price column is, as the board heads them (a column headed only
//                                             "£" is "Full price"); saved as the venue's price_terms.tiers. A list with two
//                                             prices a line needs it unless the venue's columns are already named.
//   ## Brunch | brunch                     <- section heading for the lines after it, and the meals they're sold at (default: all)
//   Bacon rashers x 2 | 95p | £1.30        <- name | price | second price (optional); £3.75, 3.75 or 95p
//   Sandwiches | £3.24-£3.96               <- a range, as posted
//   Main course dish | £3.75 | £5.65 | main   <- a 4th field prices every dish of that course on the day's menu
//                                             (soup/main/side/dessert/other), or the whole meal (meal); shown on the menu
//   Soup | £1.75 | | soup                  <- an empty field skips the non-member price
//   Student's guest | | £21.00             <- or the first, when only the second tier is priced
//   Hummus wrap (VE, GF) | £4               <- diet codes in brackets after the name become tags (V, VE/VG, GF, DF, H)
//   Shakshuka | £7.15 | | | Tomato sauce, poached eggs and feta  <- optional fifth field: description or choices, as posted
//   # comment
// Lines without a course are sold at those meals as listed: the menu itself when the meal has no dishes posted (a fixed brunch).
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { Meal, PriceCourse, PriceItem } from '../schema.ts'
import { connect } from './lib/db.ts'
import { tagsFromName } from './lib/tags.ts'

export type PriceList = { venue: string; source: string; observed_on: string; items: PriceItem[]; columns?: string[] }

/**
 * Why a list can't go up as it is, or null: it has two prices a line but nothing says whose each is, neither its own
 * `columns:` nor the venue's named columns (`tiers`). Guessing "Members, Others" put Pembroke's full price over its
 * students' discounted one.
 */
export function unnamedColumns(p: PriceList, tiers?: string[] | null): string | null {
  if (!p.items.some((i) => i.non_member_gbp != null) || (p.columns?.length ?? 0) >= 2 || (tiers?.length ?? 0) >= 2) return null
  return 'two prices a line, but nothing says whose each is: add "columns: first | second", as the board heads them'
}

/** "Members | Non-members" as its one or two names. */
function columnsOf(text: string): string[] {
  const names = text.split('|').map((c) => c.trim())
  if (!names.length || names.length > 2 || names.some((c) => !c)) throw new Error(`expected "columns: first | second": "${text}"`)
  return names
}

/** "£3.24-£3.96" (or with an en dash) as its two ends; a single price as itself. */
export function parseRange(s: string): { price_gbp: number; price_max_gbp?: number } {
  const ends = s.split(/[-–]/)
  if (ends.length === 2) return { price_gbp: parseGbp(ends[0]), price_max_gbp: parseGbp(ends[1]) }
  return { price_gbp: parseGbp(s) }
}

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
  let columns = meta.columns ? columnsOf(meta.columns) : undefined
  let section: string | undefined
  let services: Meal[] | undefined
  for (const raw of body.split('\n')) {
    const line = raw.trim()
    if (!line || (line.startsWith('#') && !line.startsWith('## '))) continue
    const named = line.match(/^columns:\s*(.*)$/i)
    if (named) {
      columns = columnsOf(named[1])
      continue
    }
    if (line.startsWith('## ')) {
      const [heading, meals] = line.slice(3).split('|').map((p) => p.trim())
      section = heading
      services = meals ? meals.split(',').map((m) => Meal.parse(m.trim().toLowerCase())) : undefined
      continue
    }
    const [posted, price, nonMember, course, description, ...rest] = line.split('|').map((p) => p.trim())
    if ((!price && !nonMember) || rest.length) throw new Error(`expected "name | price | non-member price | course | description": "${line}"`)
    const { name, tags } = tagsFromName(posted)
    items.push(
      PriceItem.parse({
        section,
        name,
        ...(description ? { description } : {}),
        ...(tags.length ? { tags } : {}),
        ...(price ? parseRange(price) : {}),
        ...(nonMember ? { non_member_gbp: parseGbp(nonMember) } : {}),
        ...(services ? { services } : {}),
        ...(course ? { course: PriceCourse.parse(course) } : {}),
      }),
    )
  }
  return { venue: `${meta.site}/${meta.venue}`, source: meta.source, observed_on: meta.observed, items, ...(columns ? { columns } : {}) }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) {
  const { values, positionals } = parseArgs({ options: { dry: { type: 'boolean' } }, allowPositionals: true })
  if (!positionals.length) throw new Error('usage: npm run ingest:prices -- prices.txt [...] [--dry]')
  const db = values.dry ? undefined : connect()
  for (const f of positionals) {
    try {
      const p = parsePrices(readFileSync(f, 'utf8'))
      if (db) {
        const unnamed = unnamedColumns(p, (await db.priceTerms(p.venue))?.tiers)
        if (unnamed) throw new Error(unnamed)
        await db.savePrices(p.venue, p.observed_on, p.source, p.items)
        if (p.columns) await db.nameColumns(p.venue, p.columns)
      }
      console.log(`✓ ${p.venue.padEnd(40)} ${String(p.items.length).padStart(3)} prices${p.columns ? ` (${p.columns.join(' | ')})` : ''}`)
    } catch (e) {
      console.error(`✗ ${f}: ${(e as Error).message}`)
      process.exitCode = 1
    }
  }
}
