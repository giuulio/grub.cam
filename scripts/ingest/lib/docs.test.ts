import { describe, expect, it } from 'vitest'
import type { MenuDay } from '../../schema.ts'
import { dayHash } from './checks.ts'
import { between, checkDays, docChanges, expandWeeks, readMenuDocs, type DocRef, type DocSource, type StoredDoc } from './docs.ts'
import type { ModelReader, Venue } from './model.ts'

const venue: Venue = { id: 'test/hall', name: 'Test Hall', type: 'hall', site: 'Test College' }
const today = '2026-10-13'
const meal = (date: string, name = 'Pie'): MenuDay => ({ date, service: 'lunch', items: [{ name, tags: [] }] })
const page = (text: string, extra: Partial<DocRef> = {}): DocRef => ({ key: 'page', url: 'https://test.example/menu', kind: 'text', text, label: 'the menu page', ...extra })

/** A model that reads "date name" lines, counting its calls. */
function fakeModel() {
  const calls: string[] = []
  const model: ModelReader = {
    async menu(r) {
      calls.push(r.text ?? '')
      if (/unreadable/.test(r.text ?? '')) throw new Error('the model found no menu in it')
      return { days: (r.text ?? '').split('\n').filter(Boolean).map((l) => meal(l.split(' ')[0], l.split(' ')[1])), unsure: '' }
    },
    async prices() {
      throw new Error('not here')
    },
  }
  return { calls, model }
}

const noParser: DocSource = { documents: async () => [] }
const stored = (rows: StoredDoc[]) => new Map(rows.map((r) => [r.key, r]))

describe('reading documents', () => {
  it('reads a document once, then not while it is unchanged', async () => {
    const { calls, model } = fakeModel()
    const first = await readMenuDocs(venue, noParser, [page('2026-10-13 Pie')], new Map(), { today }, { now: new Date('2026-10-13T08:00:00Z'), model })
    expect(first.days.map((d) => d.date)).toEqual([today])
    expect(first.days[0].since).toBeNull()
    const again = await readMenuDocs(venue, noParser, [page('2026-10-13 Pie')], stored(first.rows), { today }, { now: new Date('2026-10-13T08:30:00Z'), model })
    expect(again.read).toEqual({ parser: 0, model: 0, same: 1 })
    expect(again.days.map((d) => d.date)).toEqual([today])
    expect(calls).toHaveLength(1)
  })
  it('reads it again when it changes, from then on newer than what a person saved before', async () => {
    const { model } = fakeModel()
    const first = await readMenuDocs(venue, noParser, [page('2026-10-13 Pie')], new Map(), { today }, { now: new Date('2026-10-13T08:00:00Z'), model })
    const changed = await readMenuDocs(venue, noParser, [page('2026-10-13 Soup')], stored(first.rows), { today }, { now: new Date('2026-10-13T09:00:00Z'), model })
    expect(changed.days[0]).toMatchObject({ items: [{ name: 'Soup' }], since: '2026-10-13T09:00:00.000Z' })
  })
  it('uses the parser first and the model only when it throws', async () => {
    const { calls, model } = fakeModel()
    const parsed: DocSource = { documents: async () => [], parse: (doc) => (doc.body === 'odd' ? (() => { throw new Error('layout changed') })() : [meal(today, 'Parsed')]) }
    const ok = await readMenuDocs(venue, parsed, [page('fine')], new Map(), { today }, { now: new Date(), model })
    expect(ok.read.parser).toBe(1)
    expect(calls).toEqual([])
    const odd = await readMenuDocs(venue, { ...parsed, parse: () => { throw new Error('layout changed') } }, [page('2026-10-14 Stew')], new Map(), { today }, { now: new Date(), model })
    expect(odd.read.model).toBe(1)
    expect(odd.rows[0].read_by).toBe('model')
  })
  it('does not send a document it could not read to the model again until it changes', async () => {
    const { calls, model } = fakeModel()
    const first = await readMenuDocs(venue, noParser, [page('unreadable')], new Map(), { today }, { now: new Date(), model })
    expect(first.rows[0]).toMatchObject({ status: 'failed', error: 'the model found no menu in it' })
    expect(first.errors).toEqual([])
    await readMenuDocs(venue, noParser, [page('unreadable')], stored(first.rows), { today }, { now: new Date(), model })
    expect(calls).toHaveLength(1)
  })
  it('without a model key, leaves a document waiting rather than unreadable, so it is read once there is one', async () => {
    const run = await readMenuDocs(venue, noParser, [page('2026-10-13 Pie')], new Map(), { today }, { now: new Date() })
    expect(run.rows).toEqual([])
    expect(run.errors).toEqual(["the menu page: there's no OPENAI_API_KEY for the model"])
    const { model } = fakeModel()
    expect((await readMenuDocs(venue, noParser, [page('2026-10-13 Pie')], stored(run.rows), { today }, { now: new Date(), model })).read.model).toBe(1)
  })
  it("reads a document again when only our code changed, without taking it as changed (a person's day stays)", async () => {
    const { calls, model } = fakeModel()
    const first = await readMenuDocs(venue, noParser, [page('2026-10-13 Pie')], new Map(), { today }, { now: new Date('2026-10-13T08:00:00Z'), model })
    const changed = await readMenuDocs(venue, noParser, [page('2026-10-13 Soup')], stored(first.rows), { today }, { now: new Date('2026-10-13T09:00:00Z'), model })
    const recoded = { ...noParser, documents: async () => [page('x')] }
    const again = await readMenuDocs(venue, recoded, [page('2026-10-13 Soup', { extract: (t) => t })], stored(changed.rows), { today }, { now: new Date('2026-10-13T10:00:00Z'), model })
    expect(calls).toHaveLength(3)
    expect(again.days[0].since).toBe('2026-10-13T09:00:00.000Z')
  })
  it('does not take a document as changed when it reads as the same menus', async () => {
    const { model } = fakeModel()
    const first = await readMenuDocs(venue, noParser, [page('2026-10-13 Pie')], new Map(), { today }, { now: new Date('2026-10-13T08:00:00Z'), model })
    const reworded = await readMenuDocs(venue, noParser, [page('2026-10-13 Pie\n')], stored(first.rows), { today }, { now: new Date('2026-10-13T09:00:00Z'), model })
    expect(reworded.read.model).toBe(1)
    expect(reworded.days[0].since).toBeNull()
  })
  it('skips fetching while the listing fingerprint is the same', async () => {
    const { model } = fakeModel()
    const prev = (await readMenuDocs(venue, noParser, [page('2026-10-13 Pie', { version: 'v1' })], new Map(), { today }, { now: new Date(), model })).rows
    const run = await readMenuDocs(venue, noParser, [page('2026-10-13 Changed', { version: 'v1' })], stored(prev), { today }, { now: new Date(), model })
    expect(run.days[0].items[0].name).toBe('Pie')
  })
})

describe("a rendered page's menu", () => {
  it('is its text from the menu to what follows it, or all of it when the start is gone', () => {
    const text = 'But first, cookies\nAccept all\nLucy Cavendish Catering: 12th October\nMon\nSoup\nWeekly Catering Newsletter\nWelcome!'
    expect(between(text, /lucy cavendish catering/i, /^weekly catering newsletter$/i)).toBe('Lucy Cavendish Catering: 12th October\nMon\nSoup')
    expect(between(text, /clare hall/i)).toBe(text)
  })
})

describe('what a document can say', () => {
  it('drops a meal with no dishes and no cancellation, and refuses dates outside its week', () => {
    const blank: MenuDay = { date: today, service: 'dinner', items: [] }
    const cancelled: MenuDay = { date: today, service: 'dinner', items: [], note: 'No dinner – UG freshers formal hall' }
    expect(checkDays([meal(today), blank], page(''), today)).toEqual([meal(today)])
    expect(checkDays([cancelled], page(''), today)).toEqual([cancelled])
    expect(() => checkDays([blank], page(''), today)).toThrow('no menus in it')
    expect(() => checkDays([meal('2026-10-20')], page('', { week: '2026-10-12' }), today)).toThrow('outside 2026-10-12 to 2026-10-18')
  })
  it('copies a cycle week to each of its weeks', () => {
    const week = [meal('2026-10-12', 'Tacos'), meal('2026-10-14', 'Curry')]
    expect(expandWeeks(week, '2026-10-12', ['2026-10-12', '2026-11-02']).map((d) => `${d.date} ${d.items[0].name}`)).toEqual([
      '2026-10-12 Tacos', '2026-10-14 Curry', '2026-11-02 Tacos', '2026-11-04 Curry',
    ])
    expect(expandWeeks(week, '2026-10-12')).toEqual(week)
  })
})

describe('saving days from documents', () => {
  const day = (since: string | null, name = 'Pie') => ({ ...meal(today, name), since })
  const saved = (method: string, fetched_at: string, d = meal(today)) => new Map([[`${today}|lunch`, { content_hash: method === 'script' ? dayHash(d) : null, method, fetched_at }]])
  it("never replaces a person's day with a document first seen", () => {
    expect(docChanges([day(null, 'Model pie')], saved('manual', '2026-10-12T21:00:00Z'))).toEqual([])
  })
  it("replaces a person's day once the document changed after they saved it, and not before", () => {
    expect(docChanges([day('2026-10-13T09:00:00.000Z', 'New pie')], saved('manual', '2026-10-12T21:00:00+00:00'))).toHaveLength(1)
    expect(docChanges([day('2026-10-12T09:00:00.000Z', 'New pie')], saved('user', '2026-10-12T21:00:00+00:00'))).toEqual([])
  })
  it("replaces a script's day only when it differs (or with rewrite)", () => {
    expect(docChanges([day(null)], saved('script', '2026-10-12T21:00:00Z'))).toEqual([])
    expect(docChanges([day(null, 'Stew')], saved('script', '2026-10-12T21:00:00Z'))).toHaveLength(1)
    expect(docChanges([day(null)], saved('script', '2026-10-12T21:00:00Z'), true)).toHaveLength(1)
    expect(docChanges([day(null)], new Map())).toHaveLength(1)
  })
})
