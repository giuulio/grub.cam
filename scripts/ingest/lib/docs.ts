// Menus and price lists that come as documents: a PDF, a page's text, a page only a browser draws. Each run, a source
// lists its documents from its small listing page (documents()); a document is fetched only when it may have changed
// (its listing fingerprint, or what its server says when asked with the last ETag), read only when its content did,
// and read by the model only when the source has no parser or the parser can't. What each was read as is kept
// (source_documents, 0043), so an unchanged document costs nothing, a document that couldn't be read isn't sent to
// the model again until it changes, and a cycle week's menu is copied to its later weeks without reading it again.
import { createHash } from 'node:crypto'
import { basename } from 'node:path'
import { parse } from 'node-html-parser'
import { mealCancelled } from '../../../src/lib/menuNotes.ts'
import { MenuDay } from '../../schema.ts'
import type { PriceList } from '../prices.ts'
import { renderedHtml, screenshot } from './browser.ts'
import { dayHash } from './checks.ts'
import { addDays, fromISODate } from './dates.ts'
import { FetchError, fetchFile, type Download, type Validators } from './http.ts'
import type { ModelReader, Venue } from './model.ts'

/** A document as a source lists it. */
export type DocRef = {
  /** Its identity from run to run: the PDF's URL, or its filename where the link carries a token (Trinity) */
  key: string
  url: string
  /** What it is, for the log and the model: "the buttery menu for the week commencing 12 October" */
  label: string
  /** pdf: `url` (and `attachments`) are files; text: `text` is the document (a page's menu, fetched by documents()); browser: `url` is drawn by Chrome */
  kind: 'pdf' | 'text' | 'browser'
  /** A fingerprint from the listing (Trinity's upload stamp): while it's unchanged, the document isn't fetched */
  version?: string
  /** For text, the document; for a pdf, words that go with it (an St Edmund's post's notes) */
  text?: string
  attachments?: string[]
  /** browser: the model reads a screenshot, not the page's text (Canva's day columns come out scrambled as text) */
  screenshot?: boolean
  /** browser: the menu's part of the page's text (between()), so a cookie notice or the viewer's buttons aren't a change */
  extract?: (text: string) => string
  /** The site to name in a message (`--only <site>`) */
  site?: string
  /** Told to the model about this document */
  hint?: string
  /** A week of a repeating cycle: dated as the week of Monday `week`, then copied to each Monday of `repeats` */
  week?: string
  repeats?: string[]
}

/** A document fetched: its text (a page's, or a post's) and its files (PDFs, a screenshot). */
export type Doc = DocRef & { body?: string; files: Download[] }
export type DocContext = { today: string }

/** A source whose menus are documents. */
export type DocSource = {
  documents(ctx: DocContext): Promise<DocRef[]>
  /** Reads a document without the model; throws when it can't (and then the model reads it) */
  parse?(doc: Doc, ctx: DocContext): MenuDay[]
  /** Told to the model about every document of the source */
  guide?: string
}

/** A source whose price list is a document, read by the model once a day at most, and only when it has changed. */
export type PriceSource = { documents(ctx: DocContext): Promise<DocRef[]>; guide?: string }

/** A row of source_documents (0043). */
export type StoredDoc = {
  venue_id: string
  key: string
  url: string
  kind: 'menu' | 'prices'
  version: string | null
  /** each file's validators, and its content's hash */
  validators: Record<string, Validators & { sha: string }> | null
  hash: string | null
  status: 'ok' | 'failed'
  read_by: 'parser' | 'model' | null
  result: MenuDay[] | PriceList | null
  week: string | null
  unsure: string | null
  error: string | null
  checked_at: string
  read_at: string | null
  changed_at: string | null
}

const sha = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex').slice(0, 32)

/** A page's readable text: no scripts or styles, a line per block. */
export function pageText(html: string): string {
  const root = parse(html, { blockTextElements: { script: false, style: false, noscript: false } })
  return root.structuredText
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

/** The lines from the first matching `start` to just before `end`; nothing when `start` isn't there (the page didn't draw its menu). */
export function between(text: string, start: RegExp, end?: RegExp): string {
  const lines = text.split('\n')
  const from = lines.findIndex((l) => start.test(l))
  if (from < 0) return ''
  const to = end ? lines.findIndex((l, i) => i > from && end.test(l)) : -1
  return lines.slice(from, to < 0 ? undefined : to).join('\n')
}

/**
 * What a document's hash was computed with: for a PDF its bytes, for a page the code that cut its menu out (and reads
 * it). When that code changes, a document's hash changes though the college changed nothing: it's read again, but
 * not taken as changed, so it can't replace a day a person saved.
 */
export function schemeOf(src: { documents: unknown; parse?: unknown }, ref: DocRef): string {
  return ref.kind === 'pdf' ? 'pdf' : sha([ref.kind, String(src.documents), String(src.parse ?? ''), String(ref.extract ?? '')].join('\n')).slice(0, 8)
}

/** When the document last changed, for the rule that a person's day gives way only to a document changed since. */
function changedAt(prev: StoredDoc | undefined, scheme: string, now: string, read?: MenuDay[]): string | null {
  if (!prev) return null
  // Our code changed, not the document
  if (!prev.hash?.startsWith(`${scheme}:`)) return prev.changed_at
  // Changed, but read as the same menus (a page's markup, a PDF re-saved)
  const same = (a: MenuDay[]) => a.map(dayHash).sort().join(' ')
  if (read && Array.isArray(prev.result) && prev.status === 'ok' && same(read) === same(prev.result)) return prev.changed_at
  return now
}

const venueSite = (ref: DocRef) => ref.site ?? 'its site'

type Fetched = { status: 'same'; validators?: StoredDoc['validators'] } | { status: 'new'; doc: Doc; hash: string; validators: StoredDoc['validators'] }

/** The document, or `same` when nothing says it has changed since `prev` (always fetched afresh with `reread`). */
async function fetchDoc(ref: DocRef, prev: StoredDoc | undefined, reread: boolean, scheme: string): Promise<Fetched> {
  const known = !reread && prev ? prev : undefined
  if (known && ref.version && known.version === ref.version) return { status: 'same' }
  if (ref.kind === 'text') {
    const hash = `${scheme}:${sha(ref.text ?? '')}`
    return known?.hash === hash ? { status: 'same' } : { status: 'new', doc: { ...ref, body: ref.text, files: [] }, hash, validators: null }
  }
  if (ref.kind === 'browser') {
    const html = await renderedHtml(ref.url)
    const text = pageText(html)
    const body = ref.extract ? ref.extract(text) : text
    // A bot check isn't got round: it's the source refusing us
    if (!body.trim() && /just a moment|verif(y|ication)|captcha|are you (a )?(human|robot)/i.test(text.slice(0, 2000)))
      throw new FetchError(`the page asks this machine to prove it's a person (a bot check, not got round): read it from a machine it doesn't challenge (npm run ingest -- --only ${venueSite(ref)}), or by hand`)
    // A page that didn't draw (or no longer has the menu where it was) is a failure to fetch it, never a change
    if (!body.trim()) throw new FetchError(`its menu wasn't on the page Chrome drew (${html.length} bytes, ${text ? `starting "${text.slice(0, 80).replace(/\s+/g, ' ')}"` : `no text: "${html.slice(0, 160).replace(/\s+/g, ' ')}"`})`)
    const hash = `${scheme}:${sha(body)}`
    if (known?.hash === hash) return { status: 'same' }
    const files: Download[] = ref.screenshot ? [{ url: ref.url, mime: 'image/png', bytes: await screenshot(ref.url) }] : []
    return { status: 'new', doc: { ...ref, body: ref.screenshot ? undefined : body, files }, hash, validators: null }
  }
  // PDFs: ask each with what its server said last time; a 304 is that file unchanged
  const urls = [ref.url, ...(ref.attachments ?? [])]
  const validators: NonNullable<StoredDoc['validators']> = {}
  const files = new Map<string, Download>()
  for (const url of urls) {
    const before = known?.validators?.[url]
    const got = await fetchFile(url, before)
    if (got === 'unchanged') validators[url] = before!
    else {
      files.set(url, got)
      validators[url] = { etag: got.etag, lastModified: got.lastModified, sha: sha(got.bytes) }
    }
  }
  const hash = `${scheme}:${sha([sha(ref.text ?? ''), ...urls.map((u) => validators[u].sha)].join(' '))}`
  if (known?.hash === hash) return { status: 'same', validators }
  // Something changed: the files the server said were unchanged are needed too, to read it whole
  for (const url of urls) if (!files.has(url)) files.set(url, (await fetchFile(url)) as Download)
  return { status: 'new', doc: { ...ref, body: ref.text, files: urls.map((u) => files.get(u)!) }, hash, validators }
}

/** Why `days` can't be what the document said, or the days to keep: a meal with no dishes and no cancellation is dropped. */
export function checkDays(days: MenuDay[], ref: DocRef, today: string): MenuDay[] {
  const kept = days.map((d) => MenuDay.parse(d)).filter((d) => d.items.length || mealCancelled(d))
  if (!kept.length) throw new Error('no menus in it')
  const [from, to] = ref.week ? [ref.week, addDays(ref.week, 6)] : [addDays(today, -28), addDays(today, 200)]
  const outside = kept.find((d) => d.date < from || d.date > to)
  if (outside) throw new Error(`a menu dated ${outside.date}, outside ${from} to ${to}`)
  const long = kept.find((d) => d.items.length > 80 || d.items.some((i) => i.name.length > 200))
  if (long) throw new Error(`${long.date} ${long.service} doesn't look like a menu (${long.items.length} dishes)`)
  return kept
}

/** A cycle week's days (dated as the week of `base`) copied to each Monday of `repeats`; other days as they are. */
export function expandWeeks(days: MenuDay[], base: string | null, repeats?: string[]): MenuDay[] {
  if (!base || !repeats?.length) return days
  const gap = (a: string, b: string) => Math.round((fromISODate(b).getTime() - fromISODate(a).getTime()) / 86_400_000)
  return repeats.flatMap((monday) => days.map((d) => ({ ...d, date: addDays(d.date, gap(base, monday)) })))
}

/** A day from a document, with when that document last changed (null: not since it was first seen). */
export type DocDay = MenuDay & { since: string | null }
/** `errors`: documents that couldn't be fetched (the source's failure). One that couldn't be read is a `failed` row instead. */
/** A saved day as docChanges() weighs it. */
export type SavedDay = { content_hash: string | null; method: string; fetched_at: string }

/**
 * The days to save: those that differ from what's saved, except over a day a person saved (by hand, a member's),
 * which gives way only to a document that changed after they saved it; a document first seen never replaces one.
 * `rewrite` saves unchanged days too, never over a person's.
 */
export function docChanges(days: DocDay[], saved: Map<string, SavedDay>, rewrite = false): DocDay[] {
  return days.filter((d) => {
    const s = saved.get(`${d.date}|${d.service}`)
    if (!s) return true
    if (s.method !== 'script') return !!d.since && Date.parse(d.since) > Date.parse(s.fetched_at)
    return rewrite || s.content_hash !== dayHash(d)
  })
}

export type DocRun = { days: DocDay[]; rows: StoredDoc[]; errors: string[]; read: { parser: number; model: number; same: number } }

const fileName = (f: Download) => basename(new URL(f.url).pathname) || 'document'

/** No OPENAI_API_KEY: the document waits (it isn't marked unreadable), and is read once there's a key. */
export class NoModel extends Error {
  constructor(parserError?: Error) {
    super(`${parserError ? `the parser couldn't read it (${parserError.message}), and ` : ''}there's no OPENAI_API_KEY for the model`)
  }
}

async function readMenu(src: DocSource, doc: Doc, ctx: DocContext, venue: Venue, model?: ModelReader): Promise<{ days: MenuDay[]; by: 'parser' | 'model'; unsure: string | null }> {
  let parserError: Error | undefined
  if (src.parse) {
    try {
      return { days: checkDays(src.parse(doc, ctx), doc, ctx.today), by: 'parser', unsure: null }
    } catch (e) {
      parserError = e as Error
    }
  }
  if (!model) throw new NoModel(parserError)
  const about = [doc.label, src.guide, doc.hint].filter(Boolean).join('. ')
  // A page's menu is kept as its HTML for the parser; the model gets its text
  const text = doc.body && /<[a-z][^>]*>/i.test(doc.body) ? pageText(doc.body) : doc.body
  const r = await model.menu({ venue, url: doc.url, about, text, files: doc.files.map((f) => ({ mime: f.mime, bytes: f.bytes, name: fileName(f) })), today: ctx.today, week: doc.week })
  return { days: checkDays(r.days, doc, ctx.today), by: 'model', unsure: r.unsure || null }
}

/** Every document of a menu source: fetched if it may have changed, read if it did, its days (and cycle copies) from what it was read as. */
export async function readMenuDocs(venue: Venue, src: DocSource, refs: DocRef[], stored: Map<string, StoredDoc>, ctx: DocContext, opts: { now: Date; model?: ModelReader; reread?: boolean }): Promise<DocRun> {
  const run: DocRun = { days: [], rows: [], errors: [], read: { parser: 0, model: 0, same: 0 } }
  const now = opts.now.toISOString()
  for (const ref of refs) {
    const prev = stored.get(ref.key)
    let row: StoredDoc | undefined = prev && { ...prev, checked_at: now }
    const scheme = schemeOf(src, ref)
    try {
      const got = await fetchDoc(ref, prev, !!opts.reread, scheme)
      if (got.status === 'same') {
        row = { ...prev!, checked_at: now, url: ref.url, version: ref.version ?? prev!.version, validators: got.validators ?? prev!.validators }
        run.read.same++
      } else {
        const base = { venue_id: venue.id, key: ref.key, url: ref.url, kind: 'menu' as const, version: ref.version ?? null, validators: got.validators, hash: got.hash, week: ref.week ?? null, checked_at: now, read_at: now, changed_at: changedAt(prev, scheme, now) }
        try {
          const r = await readMenu(src, got.doc, ctx, venue, opts.model)
          row = { ...base, status: 'ok', read_by: r.by, result: r.days, unsure: r.unsure, error: null, changed_at: changedAt(prev, scheme, now, r.days) }
          run.read[r.by]++
        } catch (e) {
          if (e instanceof NoModel) throw e
          row = { ...base, status: 'failed', read_by: null, result: null, unsure: null, error: (e as Error).message }
        }
      }
    } catch (e) {
      run.errors.push(`${ref.label}: ${(e as Error).message}`)
    }
    if (!row) continue
    run.rows.push(row)
    if (row.status === 'ok' && Array.isArray(row.result)) for (const d of expandWeeks(row.result, row.week, ref.repeats)) run.days.push({ ...d, since: row.changed_at })
  }
  return run
}

export type PriceRun = { lists: { ref: DocRef; list: PriceList }[]; rows: StoredDoc[]; errors: string[] }

/**
 * Every price-list document of a source. One first seen while the venue already lists prices from the source is taken
 * as what the site lists (read only once it changes: a hand-checked list isn't replaced by the model's first reading).
 */
export async function readPriceDocs(venue: Venue, src: PriceSource, refs: DocRef[], stored: Map<string, StoredDoc>, ctx: DocContext, opts: { now: Date; model?: ModelReader; listed: (ref: DocRef) => boolean; reread?: boolean }): Promise<PriceRun> {
  const run: PriceRun = { lists: [], rows: [], errors: [] }
  const now = opts.now.toISOString()
  for (const ref of refs) {
    const prev = stored.get(ref.key)
    const scheme = schemeOf(src, ref)
    try {
      const got = await fetchDoc(ref, prev, !!opts.reread, scheme)
      if (got.status === 'same') {
        run.rows.push({ ...prev!, checked_at: now, url: ref.url, version: ref.version ?? prev!.version, validators: got.validators ?? prev!.validators })
        continue
      }
      const base = { venue_id: venue.id, key: ref.key, url: ref.url, kind: 'prices' as const, version: ref.version ?? null, validators: got.validators, hash: got.hash, week: null, checked_at: now, changed_at: changedAt(prev, scheme, now) }
      // First seen, or only our code changed, while the site lists prices from it: taken as what the site lists
      const codeOnly = !!prev && !prev.hash?.startsWith(`${scheme}:`)
      if ((!prev || codeOnly) && opts.listed(ref) && !opts.reread) {
        run.rows.push({ ...base, status: 'ok', read_by: prev?.read_by ?? null, result: prev?.result ?? null, unsure: null, error: null, read_at: prev?.read_at ?? null })
        continue
      }
      if (!opts.model) throw new NoModel()
      try {
        const doc = got.doc
        const text = doc.body && /<[a-z][^>]*>/i.test(doc.body) ? pageText(doc.body) : doc.body
        const r = await opts.model.prices({ venue, url: ref.url, about: [ref.label, src.guide, ref.hint].filter(Boolean).join('. '), text, files: doc.files.map((f) => ({ mime: f.mime, bytes: f.bytes, name: fileName(f) })), today: ctx.today })
        run.rows.push({ ...base, status: 'ok', read_by: 'model', result: r.list, unsure: r.unsure || null, error: null, read_at: now })
        run.lists.push({ ref, list: r.list })
      } catch (e) {
        run.rows.push({ ...base, status: 'failed', read_by: null, result: null, unsure: null, error: (e as Error).message, read_at: now })
      }
    } catch (e) {
      if (prev) run.rows.push({ ...prev, checked_at: now })
      run.errors.push(`${ref.label}: ${(e as Error).message}`)
    }
  }
  return run
}
