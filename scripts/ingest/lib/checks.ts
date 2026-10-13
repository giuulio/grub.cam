// How often each scripted source is fetched, how far ahead, and what's said when one keeps failing. The scheduled run
// (every half hour, migration 0042) asks each source for as little as covers what can change: today and tomorrow most
// of the time, the next two weeks every four hours, and every published week once a day.
import { createHash } from 'node:crypto'
import type { MenuDay } from '../../schema.ts'
import type { StoredDoc } from './docs.ts'

/** `soon`: today and tomorrow. `fortnight`: today to the end of next week. `all`: this week's Monday until a week ahead is empty. */
export type Scope = 'soon' | 'fortnight' | 'all'
export const SCOPES: Scope[] = ['soon', 'fortnight', 'all']

/** A row of `source_checks` (0042). */
export type SourceCheck = {
  venue_id: string
  checked_at: string
  ok_at: string | null
  changed_at: string | null
  /** London date of the last `all` fetch */
  swept_on: string | null
  /** the last `fortnight` (or `all`) fetch */
  fortnight_at: string | null
  /** in a row */
  failures: number
  failing_since: string | null
  retry_at: string | null
  error: string | null
}

const MINUTE = 60_000
// A little under four hours, so the half-hourly run that falls on the fourth hour takes it
const FORTNIGHT_EVERY = 4 * 60 * MINUTE - 10 * MINUTE
/** Failures in a row before a source goes in the "Source health" issue (one is usually a blip, retried next run) */
export const ALERT_AFTER = 2

/** What a scheduled run fetches from a source last checked as `c`. */
export function scopeFor(c: SourceCheck | undefined, now: Date, today: string): Scope {
  if (!c || c.swept_on !== today) return 'all'
  if (!c.fortnight_at || now.getTime() - Date.parse(c.fortnight_at) >= FORTNIGHT_EVERY) return 'fortnight'
  return 'soon'
}

/** Whether a failing source sits this run out. */
export const waiting = (c: SourceCheck | undefined, now: Date) => !!c?.retry_at && Date.parse(c.retry_at) > now.getTime()

/** After `failures` in a row: half an hour, doubling to six hours, ten minutes early so the half-hourly run takes it. */
export function retryAt(failures: number, now: Date): Date {
  const wait = Math.min(30 * 2 ** (failures - 1), 360) * MINUTE - 10 * MINUTE
  return new Date(now.getTime() + wait)
}

export function succeeded(c: SourceCheck | undefined, venue: string, scope: Scope, now: Date, today: string, changed: boolean): SourceCheck {
  const at = now.toISOString()
  return {
    venue_id: venue,
    checked_at: at,
    ok_at: at,
    changed_at: changed ? at : (c?.changed_at ?? null),
    swept_on: scope === 'all' ? today : (c?.swept_on ?? null),
    fortnight_at: scope === 'soon' ? (c?.fortnight_at ?? null) : at,
    failures: 0,
    failing_since: null,
    retry_at: null,
    error: null,
  }
}

export function failed(c: SourceCheck | undefined, venue: string, now: Date, error: string): SourceCheck {
  const failures = (c?.failures ?? 0) + 1
  return {
    venue_id: venue,
    checked_at: now.toISOString(),
    ok_at: c?.ok_at ?? null,
    changed_at: c?.changed_at ?? null,
    swept_on: c?.swept_on ?? null,
    fortnight_at: c?.fortnight_at ?? null,
    failures,
    failing_since: c?.failing_since ?? now.toISOString(),
    retry_at: retryAt(failures, now).toISOString(),
    error,
  }
}

/** The day exactly as save_menu stores it, so an unchanged day has the hash it was saved with. */
export function dayHash(d: MenuDay): string {
  const items = d.items.map((i) => [i.name, i.tags, i.price_gbp ?? null, i.price2_gbp ?? null, i.price_text ?? null, i.course ?? null, i.sold_out ?? null])
  return createHash('sha256').update(JSON.stringify([d.date, d.service, d.note ?? null, d.alert ?? false, items])).digest('hex').slice(0, 32)
}

/** The days whose hash differs from the one saved (keyed `date|service`). */
export const changedDays = (days: MenuDay[], saved: Map<string, string | null>) => days.filter((d) => saved.get(`${d.date}|${d.service}`) !== dayHash(d))

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\s+/g, ' ')

/**
 * The "Source health" issue's body: the scripted sources failing now, and documents that couldn't be read (each
 * waits until it changes, or `--reread`). The repo is public: only venues, URLs and errors.
 */
export function healthReport(venues: string[], checks: Map<string, SourceCheck>, now: Date, unread: StoredDoc[] = []): string {
  const failing = venues.map((v) => checks.get(v)).filter((c): c is SourceCheck => !!c && c.failures >= ALERT_AFTER)
  const lines = [
    failing.length
      ? `**${failing.length} of ${venues.length} scripted sources ${failing.length === 1 ? 'is' : 'are'} failing.**`
      : `**All ${venues.length} scripted sources are fetching.**`,
    '',
  ]
  if (failing.length) {
    lines.push('| Source | Failing since | Tries | Last worked | Next try | Error |', '|---|---|---|---|---|---|')
    for (const c of failing) lines.push(`| ${c.venue_id} | ${when(c.failing_since)} | ${c.failures} | ${when(c.ok_at)} | ${when(c.retry_at)} | ${cell(c.error ?? '')} |`)
    lines.push('', 'Saved menus stay up while a source fails. Fix the adapter in `scripts/ingest/sources/`, or try it with `npm run ingest -- --only <site>`.', '')
  }
  if (unread.length) {
    lines.push(`**${unread.length} ${unread.length === 1 ? 'document' : 'documents'} couldn't be read.**`, '', '| Source | Document | Tried | Why |', '|---|---|---|---|')
    for (const d of unread) lines.push(`| ${d.venue_id} | [${cell(d.key.length > 60 ? d.key.slice(0, 57) + '…' : d.key)}](${d.url}) | ${when(d.read_at)} | ${cell(d.error ?? '')} |`)
    lines.push('', 'Each is read again when it changes, or with `npm run ingest -- --only <site> --reread`; meanwhile its menus can be transcribed by hand (`ingest:manual`).', '')
  }
  lines.push(`A source is listed after ${ALERT_AFTER} failures in a row. It's tried again at the next run, then after an hour, two, four and at most six; this issue gets a comment when one starts failing or recovers.`, '')
  lines.push(`Checked ${when(now.toISOString())} (London).`)
  return lines.join('\n') + '\n'
}

/** A comment when sources start failing or recover, or a document can't be read, which emails whoever watches the repo; undefined when none of these. */
export function healthComment(failing: SourceCheck[], recovered: string[], unread: StoredDoc[] = []): string | undefined {
  const lines = [
    ...failing.map((c) => `- **${c.venue_id}** has failed ${c.failures} times in a row: ${c.error}`),
    ...recovered.map((v) => `- **${v}** is fetching again.`),
    ...unread.map((d) => `- **${d.venue_id}**: couldn't read [${d.key}](${d.url}): ${d.error}`),
  ]
  return lines.length ? lines.join('\n') + '\n' : undefined
}
