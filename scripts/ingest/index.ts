// Usage: npm run ingest -- [--only jesus,homerton] [--dry]
// Fetches every scripted source from today until a week comes back empty, and saves it to Supabase.
// Days already saved are kept; a day the source still lists is replaced with the latest version.
// Fails (so GitHub emails) on any error, or when a source that had menus saved ahead suddenly returns nothing.
import { parseArgs } from 'node:util'
import { MenuDay } from '../schema.ts'
import { addDays, isoWeek, todayLondon, weekDates } from './lib/dates.ts'
import { connect } from './lib/db.ts'
import { mergeDays, type Adapter } from './lib/source.ts'
import { SOURCES } from './sources.ts'

const WEEKS_AHEAD = 9 // a whole Full Term

const { values } = parseArgs({ options: { only: { type: 'string' }, dry: { type: 'boolean' } } })
const only = values.only?.split(',').map((s) => s.trim())
const db = values.dry ? undefined : connect()
const today = todayLondon()

async function fetchAhead(adapter: Adapter): Promise<MenuDay[]> {
  const days: MenuDay[] = []
  for (let i = 0; i < WEEKS_AHEAD; i++) {
    const week = isoWeek(addDays(today, 7 * i))
    const dates = weekDates(week)
    const res = await adapter.fetch({ week, dates, today })
    const got = res.days.filter((d) => dates.includes(d.date) && d.date >= today && d.items.length)
    if (!got.length && i > 0) break // the current week may be over already; later gaps mean nothing is published yet
    days.push(...got.map((d) => MenuDay.parse(d)))
  }
  return mergeDays(days)
}

let failures = 0
for (const src of SOURCES) {
  if (!src.adapter || (only && !only.includes(src.venue.split('/')[0]))) continue
  const started = new Date().toISOString()
  try {
    const days = await fetchAhead(src.adapter)
    // Empty is normal out of term, but not when the source listed days still ahead last time: the page has probably changed.
    const ahead = days.length ? 0 : ((await db?.savedAfter(src.venue, today)) ?? 0)
    if (ahead) throw new Error(`returned nothing, but ${ahead} services after today were saved from it before; check the adapter`)
    const dishes = days.reduce((n, d) => n + d.items.length, 0)
    await db?.saveMenu(src.venue, src.url!, started, 'script', days)
    await db?.logRun({ venue_id: src.venue, method: 'script', started_at: started, status: days.length ? 'ok' : 'empty', days: days.length, dishes })
    console.log(`✓ ${src.venue.padEnd(40)} ${String(days.length).padStart(3)} services ${String(dishes).padStart(5)} dishes  to ${days.at(-1)?.date ?? '—'}`)
  } catch (e) {
    failures++
    await db?.logRun({ venue_id: src.venue, method: 'script', started_at: started, status: 'error', error: (e as Error).message })
    console.error(`✗ ${src.venue}: ${(e as Error).message}`)
  }
}
process.exit(failures ? 1 : 0)
