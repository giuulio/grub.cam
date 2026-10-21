// Usage: npm run ingest -- [--only jesus,homerton] [--from 2026-09-28] [--scope soon|fortnight|all] [--rewrite] [--reread] [--dry] [--report dir]
// Fetches the scripted sources and saves what changed to Supabase. The scheduled run (every half hour, migration 0042)
// picks how far ahead to ask each adapter (lib/checks.ts): every published week on its first run of the day (from this
// week's Monday until a week ahead comes back empty), the next two weeks every four hours, and otherwise today and
// tomorrow, so a last-minute change is seen within half an hour. `--only`, `--from` and `--dry` fetch everything, as
// `--scope all` does; `--from` starts at that date's week, to fill in the past. Earlier days of this week are kept
// when the source still lists them (a venue first fetched on Thursday gets Monday to Wednesday too). Days already
// saved are kept; a day the source still lists is saved again only if it changed (`--rewrite` saves them all).
//
// Sources whose menus are documents (`documents`: PDFs, a page, a Sway) are checked every run, each document fetched
// only when it may have changed and read (by its parser, or the model) only when it did (lib/docs.ts); `--reread`
// reads them all again. A day from a document replaces one a person saved (by hand, a member's) only when the document
// changed after they saved it. Price-list documents (`prices`) are checked on a venue's first run of the day. When an
// adapter with `fallback` breaks on its page, the model reads the page instead. Model calls need OPENAI_API_KEY.
//
// Sources run at once, one request at a time per host (lib/http.ts); a failing source waits longer before each try
// and is reported in the "Source health" issue once it has failed ALERT_AFTER times in a row, as is a document that
// couldn't be read. Only our own errors fail the run (so GitHub emails): a source in sources.ts with no venue, or a
// database write that failed. `--report dir` writes the "Source health" issue's body
// (health.md) and, when something starts failing or recovers, a comment (health-comment.md); in Actions,
// `changed=true` goes to GITHUB_OUTPUT when anything was saved, so the site is rebuilt only then.
import { appendFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { ALERT_AFTER, SCOPES, changedDays, dayHash, failed, healthComment, healthReport, scopeFor, succeeded, waiting, type Scope, type SourceCheck } from './lib/checks.ts'
import { isoWeek, todayLondon, weekMonday } from './lib/dates.ts'
import { connect } from './lib/db.ts'
import { docChanges, pageText, readMenuDocs, readPriceDocs, type DocDay, type DocRef, type StoredDoc } from './lib/docs.ts'
import { FetchError, fetchText } from './lib/http.ts'
import { modelReader, type Venue } from './lib/model.ts'
import { fetchRange, scopeEnd } from './lib/range.ts'
import type { MenuSource } from './lib/source.ts'
import type { MenuDay } from '../schema.ts'
import { savedList, unnamedColumns, type SavedPrice } from './prices.ts'
import { SOURCES } from './sources.ts'

const { values } = parseArgs({
  options: {
    only: { type: 'string' }, from: { type: 'string' }, scope: { type: 'string' }, rewrite: { type: 'boolean' }, reread: { type: 'boolean' }, dry: { type: 'boolean' }, report: { type: 'string' },
  },
})
const only = values.only?.split(',').map((s) => s.trim())
const db = values.dry ? undefined : connect()
const now = new Date()
const today = todayLondon()
const monday = weekMonday(isoWeek(today))
if (values.from && !/^\d{4}-\d{2}-\d{2}$/.test(values.from)) throw new Error('--from takes a date, YYYY-MM-DD')
if (values.scope && !SCOPES.includes(values.scope as Scope)) throw new Error(`--scope is one of ${SCOPES.join(', ')}`)
const forced = (values.scope as Scope | undefined) ?? (only || values.from || values.dry ? 'all' : undefined)

// A source still fetching after this long is given up on for this run (each request already times out at 30 s)
const BUDGET_MS: Record<Scope, number> = { soon: 3 * 60_000, fortnight: 4 * 60_000, all: 8 * 60_000 }
// Documents: Chrome and a model call or two
const DOCS_BUDGET_MS = 6 * 60_000
const AT_ONCE = 8

let fatal = 0
const unknown = (await db?.syncSources(SOURCES)) ?? []
for (const id of unknown) {
  fatal++
  console.error(`✗ ${id}: in sources.ts but not in venues`)
}

const scripted = SOURCES.filter((s) => s.adapter || s.documents || s.prices)
const chosen = scripted.filter((s) => !only || only.includes(s.venue.split('/')[0]))
const checks = new Map((await db?.sourceChecks())?.map((c) => [c.venue_id, c]))
const documents = new Map<string, Map<string, StoredDoc>>()
for (const d of (await db?.sourceDocuments()) ?? []) documents.set(d.venue_id, (documents.get(d.venue_id) ?? new Map()).set(d.key, d))
const venues = (await db?.venues(chosen.map((s) => s.venue))) ?? new Map<string, Venue>()
const model = db && modelReader(db)
const startedFailing: SourceCheck[] = []
const recovered: string[] = []
const unreadNow: StoredDoc[] = []
let saved = 0

function within<T>(ms: number, work: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`still fetching after ${ms / 60_000} min; stopped for this run`)), ms)
  })
  return Promise.race([work, late]).finally(() => clearTimeout(timer))
}

const venueOf = (src: MenuSource): Venue => venues.get(src.venue) ?? { id: src.venue, name: src.venue, type: 'hall', site: src.venue.split('/')[0] }
const storedOf = (venue: string) => documents.get(venue) ?? new Map<string, StoredDoc>()

/** Keeps what a run did to a source's documents: saved, and noted when one newly couldn't be read. */
async function keepDocuments(rows: StoredDoc[]) {
  await db?.saveDocuments(rows)
  for (const r of rows) {
    storedOf(r.venue_id).set(r.key, r)
    if (r.status === 'failed' && r.read_at === now.toISOString()) unreadNow.push(r)
  }
}

/** Saves the days from documents that changed. A person's day gives way only to a document changed after they saved it. */
async function saveDocDays(src: MenuSource, docDays: DocDay[], started: string): Promise<{ total: number; changed: number }> {
  const byKey = new Map<string, DocDay>()
  for (const d of docDays) if (d.date >= monday) byKey.set(`${d.date}|${d.service}`, d)
  const days = [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date) || a.service.localeCompare(b.service))
  if (!days.length) return { total: 0, changed: 0 }
  const changed = docChanges(days, (await db?.savedDays(src.venue, days[0].date, days.at(-1)!.date)) ?? new Map(), values.rewrite)
  if (changed.length) {
    // Without `since`, which isn't the day's
    const plain = changed.map((d): MenuDay => ({ date: d.date, service: d.service, items: d.items, ...(d.note ? { note: d.note } : {}), ...(d.alert ? { alert: d.alert } : {}) }))
    await db?.saveMenu(src.venue, src.url!, started, 'script', plain.map((d) => ({ ...d, hash: dayHash(d) })))
    await db?.logRun({ venue_id: src.venue, method: 'script', started_at: started, status: 'ok', days: changed.length, dishes: changed.reduce((n, d) => n + d.items.length, 0) })
    saved += changed.length
  }
  return { total: days.length, changed: changed.length }
}

async function readDocuments(src: MenuSource, started: string): Promise<{ line: string; errors: string[]; changed: number }> {
  const venue = venueOf(src)
  const refs = await src.documents!.documents({ today })
  const run = await readMenuDocs(venue, src.documents!, refs, storedOf(src.venue), { today }, { now, model, reread: values.reread })
  await keepDocuments(run.rows)
  const { total, changed } = await saveDocDays(src, run.days, started)
  const unread = run.rows.filter((r) => r.status === 'failed').length
  const read = [run.read.parser && `${run.read.parser} by parser`, run.read.model && `${run.read.model} by model`, run.read.same && `${run.read.same} unchanged`, unread && `${unread} unread`].filter(Boolean).join(', ')
  return { line: `${refs.length} docs (${read || 'none'}) ${String(total).padStart(3)} services, ${String(changed).padStart(3)} changed`, errors: run.errors, changed }
}

/** A price list's documents, once a day: one that changed replaces the lines that came from it, where they were. */
async function readPrices(src: MenuSource): Promise<{ line: string; errors: string[]; changed: number }> {
  const venue = venueOf(src)
  let lines = savedList((await db?.rowsOf('venue_prices', src.venue)) ?? [])
  const stored = storedOf(src.venue)
  const refs = await src.prices!.documents({ today })
  const run = await readPriceDocs(venue, src.prices!, refs, stored, { today }, { now, model, reread: values.reread, listed: (ref) => lines.some((l) => l.source.startsWith(ref.url)) })
  let replaced = 0
  for (const { ref, list } of run.lists) {
    const prev = stored.get(ref.key)?.url
    const owned = (l: SavedPrice) => l.source.startsWith(ref.url) || (!!prev && l.source.startsWith(prev))
    const before = lines.filter(owned)
    const row = run.rows.find((r) => r.key === ref.key)!
    const refuse = (why: string) => Object.assign(row, { status: 'failed', result: null, error: why })
    const unnamed = unnamedColumns(list, (await db?.priceTerms(src.venue))?.tiers)
    if (unnamed) refuse(unnamed)
    else if (list.items.some((i) => (i.price_gbp ?? 0) > 100 || (i.non_member_gbp ?? 0) > 100)) refuse('a price over £100: misread?')
    else if (before.length >= 6 && list.items.length < before.length / 2) refuse(`${list.items.length} lines where ${before.length} came from it before: not saved, in case it was misread`)
    else {
      const fresh = list.items.map((i) => ({ ...i, source: `${ref.url} (linked from ${src.url})`, observed_on: today }))
      const at = lines.findIndex(owned)
      const kept = lines.filter((l) => !owned(l))
      lines = at < 0 ? [...kept, ...fresh] : [...kept.slice(0, at), ...fresh, ...kept.slice(at)]
      await db?.saveList(src.venue, lines)
      if (list.columns) await db?.nameColumns(src.venue, list.columns)
      replaced += fresh.length
      saved++
    }
  }
  await keepDocuments(run.rows)
  return { line: `${refs.length} price docs, ${run.lists.length} read, ${replaced} lines saved`, errors: run.errors, changed: replaced }
}

/** When an adapter breaks on its page, the model reads the page (once per version of it) instead. */
async function rescue(src: MenuSource, started: string, error: Error): Promise<string> {
  if (!src.fallback || !src.url || error instanceof FetchError) return ''
  if (!model) return '; no OPENAI_API_KEY for the model to read the page instead'
  try {
    const ref: DocRef = { key: 'fallback', url: src.url, kind: 'text', text: pageText(await fetchText(src.url)), label: `${venueOf(src).name}'s menu page, read because its adapter failed` }
    const run = await readMenuDocs(venueOf(src), { documents: async () => [ref] }, [ref], storedOf(src.venue), { today }, { now, model })
    await keepDocuments(run.rows)
    const { total, changed } = await saveDocDays(src, run.days, started)
    const row = run.rows[0]
    return row?.status === 'failed' ? `; the model couldn't read the page either: ${row.error}` : `; the model read the page instead (${total} services, ${changed} changed)`
  } catch (e) {
    return `; reading the page instead failed: ${(e as Error).message}`
  }
}

async function check(src: MenuSource) {
  const before = checks.get(src.venue)
  if (!forced && waiting(before, now)) {
    console.log(`· ${src.venue.padEnd(40)} waiting: failed ${before!.failures} times, next try after ${new Date(before!.retry_at!).toISOString().slice(11, 16)} UTC`)
    return
  }
  const scope = forced ?? scopeFor(before, now, today)
  // A price list alone is checked on the venue's first run of the day
  if (src.prices && !src.adapter && !src.documents && scope !== 'all') return
  const started = new Date().toISOString()
  try {
    let line: string
    let errors: string[] = []
    let didChange = false
    if (src.documents || src.prices) {
      const parts = []
      if (src.documents) parts.push(await within(DOCS_BUDGET_MS, readDocuments(src, started)))
      if (src.prices && scope === 'all') parts.push(await within(DOCS_BUDGET_MS, readPrices(src)))
      line = parts.map((p) => p.line).join('; ')
      errors = parts.flatMap((p) => p.errors)
      didChange = parts.some((p) => p.changed > 0)
    } else {
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
        didChange = true
      }
      const span = days.length ? `${days[0].date} to ${days.at(-1)!.date}` : '—'
      line = `${scope.padEnd(9)} ${String(days.length).padStart(3)} services, ${String(changed.length).padStart(3)} changed (${dishes} dishes)  ${span}`
    }
    if (errors.length) throw new Error(errors.join('; '))
    const after = succeeded(before, src.venue, scope, now, today, didChange)
    checks.set(src.venue, after)
    await db?.saveCheck(after)
    if ((before?.failures ?? 0) >= ALERT_AFTER) recovered.push(src.venue)
    console.log(`✓ ${src.venue.padEnd(40)} ${line}`)
  } catch (e) {
    const message = (e as Error).message + (src.adapter ? await rescue(src, started, e as Error) : '')
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

for (const d of unreadNow) console.error(`✗ ${d.venue_id.padEnd(40)} couldn't read ${d.key}: ${d.error}`)
if (values.report && db) {
  const unread = scripted.flatMap((s) => [...storedOf(s.venue).values()].filter((d) => d.status === 'failed'))
  writeFileSync(join(values.report, 'health.md'), healthReport(scripted.map((s) => s.venue), checks, now, unread))
  const comment = healthComment(startedFailing, recovered, unreadNow)
  if (comment) writeFileSync(join(values.report, 'health-comment.md'), comment)
}
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${saved > 0}\n`)
console.log(values.dry ? `${saved} services fetched (dry: nothing saved)` : saved ? `${saved} services saved` : 'nothing changed')
process.exit(fatal ? 1 : 0)
