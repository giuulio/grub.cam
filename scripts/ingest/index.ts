// Usage: npm run ingest -- [--only jesus,homerton] [--from 2026-09-28] [--dry]
// Fetches every scripted source from this week's Monday (or `--from`'s week, to fill in the past) until a week ahead comes back
// empty, and saves it to Supabase. Earlier days of this week are kept when the source still lists them (a venue first fetched on
// Thursday gets Monday to Wednesday too). Days already saved are kept; a day the source still lists is replaced with the latest version.
// Fails (so GitHub emails) on any error, or when a source that had menus saved ahead suddenly returns nothing.
import { parseArgs } from 'node:util'
import { todayLondon } from './lib/dates.ts'
import { connect } from './lib/db.ts'
import { fetchRange } from './lib/range.ts'
import { SOURCES } from './sources.ts'

const { values } = parseArgs({ options: { only: { type: 'string' }, from: { type: 'string' }, dry: { type: 'boolean' } } })
const only = values.only?.split(',').map((s) => s.trim())
const db = values.dry ? undefined : connect()
const today = todayLondon()
if (values.from && !/^\d{4}-\d{2}-\d{2}$/.test(values.from)) throw new Error('--from takes a date, YYYY-MM-DD')

let failures = 0
const unknown = (await db?.syncSources(SOURCES)) ?? []
for (const id of unknown) {
  failures++
  console.error(`✗ ${id}: in sources.ts but not in venues`)
}
for (const src of SOURCES) {
  if (!src.adapter || (only && !only.includes(src.venue.split('/')[0]))) continue
  const started = new Date().toISOString()
  try {
    const days = await fetchRange(src, today, values.from)
    // Empty is normal out of term, but not when the source listed days still ahead last time: the page has probably changed.
    const ahead = days.length ? 0 : ((await db?.savedAfter(src.venue, today)) ?? 0)
    if (ahead) throw new Error(`returned nothing, but ${ahead} services after today were saved from it before; check the adapter`)
    const dishes = days.reduce((n, d) => n + d.items.length, 0)
    await db?.saveMenu(src.venue, src.url!, started, 'script', days)
    await db?.logRun({ venue_id: src.venue, method: 'script', started_at: started, status: days.length ? 'ok' : 'empty', days: days.length, dishes })
    console.log(`✓ ${src.venue.padEnd(40)} ${String(days.length).padStart(3)} services ${String(dishes).padStart(5)} dishes  ${days[0]?.date ?? '—'} to ${days.at(-1)?.date ?? '—'}`)
  } catch (e) {
    failures++
    await db?.logRun({ venue_id: src.venue, method: 'script', started_at: started, status: 'error', error: (e as Error).message })
    console.error(`✗ ${src.venue}: ${(e as Error).message}`)
  }
}
process.exit(failures ? 1 : 0)
