// Usage: npm run ingest -- [--only jesus,homerton] [--from 2026-09-28] [--scope soon|fortnight|all] [--rewrite] [--dry] [--report dir]
// Fetches the scripted sources and saves what changed to Supabase. The scheduled run (every half hour, migration 0042)
// picks how far ahead to ask each source (lib/checks.ts): every published week on its first run of the day (from this
// week's Monday until a week ahead comes back empty), the next two weeks every four hours, and otherwise today and
// tomorrow, so a last-minute change is seen within half an hour. `--only`, `--from` and `--dry` fetch everything, as
// `--scope all` does; `--from` starts at that date's week, to fill in the past. Earlier days of this week are kept
// when the source still lists them (a venue first fetched on Thursday gets Monday to Wednesday too). Days already
// saved are kept; a day the source still lists is saved again only if it changed (`--rewrite` saves them all).
// Sources run at once, one request at a time per host (lib/http.ts); a failing source waits longer before each try,
// and fails the run (so GitHub emails) only when it has failed ALERT_AFTER times in a row; so does a source in
// sources.ts with no venue. `--report dir` writes the "Source health" issue's body (health.md) and, when a source
// starts failing or recovers, a comment (health-comment.md); in Actions, `changed=true` goes to GITHUB_OUTPUT when
// anything was saved, so the site is rebuilt only then.
import { appendFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { ALERT_AFTER, SCOPES, changedDays, dayHash, failed, healthComment, healthReport, scopeFor, succeeded, waiting, type Scope, type SourceCheck } from './lib/checks.ts'
import { todayLondon } from './lib/dates.ts'
import { connect } from './lib/db.ts'
import { fetchRange, scopeEnd } from './lib/range.ts'
import type { MenuSource } from './lib/source.ts'
import { SOURCES } from './sources.ts'

const { values } = parseArgs({
  options: { only: { type: 'string' }, from: { type: 'string' }, scope: { type: 'string' }, rewrite: { type: 'boolean' }, dry: { type: 'boolean' }, report: { type: 'string' } },
})
const only = values.only?.split(',').map((s) => s.trim())
const db = values.dry ? undefined : connect()
const now = new Date()
const today = todayLondon()
if (values.from && !/^\d{4}-\d{2}-\d{2}$/.test(values.from)) throw new Error('--from takes a date, YYYY-MM-DD')
if (values.scope && !SCOPES.includes(values.scope as Scope)) throw new Error(`--scope is one of ${SCOPES.join(', ')}`)
const forced = (values.scope as Scope | undefined) ?? (only || values.from || values.dry ? 'all' : undefined)

// A source still fetching after this long is given up on for this run (each request already times out at 30 s)
const BUDGET_MS: Record<Scope, number> = { soon: 3 * 60_000, fortnight: 4 * 60_000, all: 8 * 60_000 }
const AT_ONCE = 8

let fatal = 0
const unknown = (await db?.syncSources(SOURCES)) ?? []
for (const id of unknown) {
  fatal++
  console.error(`✗ ${id}: in sources.ts but not in venues`)
}

const scripted = SOURCES.filter((s) => s.adapter)
const chosen = scripted.filter((s) => !only || only.includes(s.venue.split('/')[0]))
const checks = new Map((await db?.sourceChecks())?.map((c) => [c.venue_id, c]))
const startedFailing: SourceCheck[] = []
const recovered: string[] = []
let saved = 0

function within<T>(ms: number, work: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`still fetching after ${ms / 60_000} min; stopped for this run`)), ms)
  })
  return Promise.race([work, late]).finally(() => clearTimeout(timer))
}

async function check(src: MenuSource) {
  const before = checks.get(src.venue)
  if (!forced && waiting(before, now)) {
    console.log(`· ${src.venue.padEnd(40)} waiting: failed ${before!.failures} times, next try after ${new Date(before!.retry_at!).toISOString().slice(11, 16)} UTC`)
    return
  }
  const scope = forced ?? scopeFor(before, now, today)
  const started = new Date().toISOString()
  try {
    // A backfill (--from) takes as long as the source's history: no budget
    const work = fetchRange(src, today, values.from, scope)
    const days = values.from ? await work : await within(BUDGET_MS[scope], work)
    // Empty is normal out of term, but not when the source listed days still ahead last time: the page has probably changed.
    const ahead = days.length ? 0 : ((await db?.savedAfter(src.venue, today, scopeEnd(scope, today))) ?? 0)
    if (ahead) throw new Error(`returned nothing, but ${ahead} services ${scope === 'all' ? 'after today' : `from tomorrow to ${scopeEnd(scope, today)}`} were saved from it before; check the adapter`)
    const hashes = !days.length || values.rewrite ? new Map<string, string | null>() : ((await db?.savedHashes(src.venue, days[0].date, days.at(-1)!.date)) ?? new Map())
    const changed = changedDays(days, hashes)
    const dishes = changed.reduce((n, d) => n + d.items.length, 0)
    if (changed.length) {
      await db?.saveMenu(src.venue, src.url!, started, 'script', changed.map((d) => ({ ...d, hash: dayHash(d) })))
      // A script's run is logged when it changed something (days and dishes are what changed) or failed; source_checks has the rest
      await db?.logRun({ venue_id: src.venue, method: 'script', started_at: started, status: 'ok', days: changed.length, dishes })
      saved += changed.length
    }
    const after = succeeded(before, src.venue, scope, now, today, changed.length > 0)
    checks.set(src.venue, after)
    await db?.saveCheck(after)
    if ((before?.failures ?? 0) >= ALERT_AFTER) recovered.push(src.venue)
    const span = days.length ? `${days[0].date} to ${days.at(-1)!.date}` : '—'
    console.log(`✓ ${src.venue.padEnd(40)} ${scope.padEnd(9)} ${String(days.length).padStart(3)} services, ${String(changed.length).padStart(3)} changed (${dishes} dishes)  ${span}`)
  } catch (e) {
    const message = (e as Error).message
    const after = failed(before, src.venue, now, message)
    checks.set(src.venue, after)
    try {
      await db?.saveCheck(after)
    } catch (err) {
      fatal++
      console.error(`✗ ${(err as Error).message}`)
    }
    await db?.logRun({ venue_id: src.venue, method: 'script', started_at: started, status: 'error', error: message })
    if (after.failures === ALERT_AFTER) startedFailing.push(after)
    console.error(`✗ ${src.venue.padEnd(40)} ${scope.padEnd(9)} ${message}${after.failures > 1 ? ` (${after.failures} in a row)` : ''}`)
  }
}

let next = 0
await Promise.all(Array.from({ length: Math.min(AT_ONCE, chosen.length) }, async () => {
  while (next < chosen.length) await check(chosen[next++])
}))

if (values.report && db) {
  writeFileSync(join(values.report, 'health.md'), healthReport(scripted.map((s) => s.venue), checks, now))
  const comment = healthComment(startedFailing, recovered)
  if (comment) writeFileSync(join(values.report, 'health-comment.md'), comment)
}
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${saved > 0}\n`)
console.log(values.dry ? `${saved} services fetched (dry: nothing saved)` : saved ? `${saved} services saved` : 'nothing changed')
process.exit(fatal || startedFailing.length ? 1 : 0)
