import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { MenuDay } from '../../schema.ts'
import { ALERT_AFTER, changedDays, dayHash, failed, healthComment, healthReport, retryAt, scopeFor, succeeded, waiting, type SourceCheck } from './checks.ts'

const at = (iso: string) => new Date(iso)
const today = '2026-10-13'
const day = (over: Partial<MenuDay> = {}): MenuDay => ({ date: today, service: 'dinner', items: [{ name: 'Turkey cottage pie', tags: [], price_gbp: 4 }], ...over })

describe('how far ahead a scheduled run asks', () => {
  it('sweeps every published week on a source’s first run of the day', () => {
    expect(scopeFor(undefined, at('2026-10-13T06:07:00Z'), today)).toBe('all')
    const yesterday = succeeded(undefined, 'jesus/caff', 'all', at('2026-10-12T06:07:00Z'), '2026-10-12', true)
    expect(scopeFor(yesterday, at('2026-10-13T06:07:00Z'), today)).toBe('all')
  })
  it('asks for the next two weeks every four hours, and otherwise only today and tomorrow', () => {
    const swept = succeeded(undefined, 'jesus/caff', 'all', at('2026-10-13T06:07:00Z'), today, true)
    expect(scopeFor(swept, at('2026-10-13T06:37:00Z'), today)).toBe('soon')
    expect(scopeFor(swept, at('2026-10-13T09:37:00Z'), today)).toBe('soon')
    // the half-hourly run at four hours, starting a minute or two early, still takes it
    expect(scopeFor(swept, at('2026-10-13T10:05:00Z'), today)).toBe('fortnight')
    const soon = succeeded(swept, 'jesus/caff', 'soon', at('2026-10-13T09:37:00Z'), today, false)
    expect(soon.fortnight_at).toBe(swept.fortnight_at)
    expect(soon.swept_on).toBe(today)
  })
})

describe('a failing source', () => {
  it('waits half an hour, doubling to six hours, a little early so the half-hourly run takes it', () => {
    const now = at('2026-10-13T10:00:00Z')
    expect(retryAt(1, now).toISOString()).toBe('2026-10-13T10:20:00.000Z')
    expect(retryAt(2, now).toISOString()).toBe('2026-10-13T10:50:00.000Z')
    expect(retryAt(3, now).toISOString()).toBe('2026-10-13T11:50:00.000Z')
    expect(retryAt(9, now).toISOString()).toBe('2026-10-13T15:50:00.000Z')
  })
  it('counts failures in a row from when it started failing, and forgets them once it works', () => {
    const ok = succeeded(undefined, 'wolfson/buttery-dining-hall', 'all', at('2026-10-13T14:37:00Z'), today, true)
    const one = failed(ok, ok.venue_id, at('2026-10-13T16:37:00Z'), '403 Forbidden for https://www.wolfson.cam.ac.uk/food/cafeteria-menus')
    const two = failed(one, ok.venue_id, at('2026-10-13T17:07:00Z'), '403 Forbidden for https://www.wolfson.cam.ac.uk/food/cafeteria-menus')
    expect([one.failures, two.failures]).toEqual([1, ALERT_AFTER])
    expect(two.failing_since).toBe('2026-10-13T16:37:00.000Z')
    expect(two.ok_at).toBe(ok.ok_at)
    expect(two.swept_on).toBe(today)
    expect(waiting(two, at('2026-10-13T17:37:00Z'))).toBe(true)
    expect(waiting(two, at('2026-10-13T18:07:00Z'))).toBe(false)
    const back = succeeded(two, ok.venue_id, 'soon', at('2026-10-13T18:07:00Z'), today, false)
    expect([back.failures, back.failing_since, back.retry_at, back.error]).toEqual([0, null, null, null])
    expect(back.changed_at).toBe(ok.changed_at)
  })
})

describe('saving only what changed', () => {
  it('gives the same day the same hash, and a different one when anything save_menu stores changes', () => {
    expect(dayHash(day())).toBe(dayHash(day()))
    expect(dayHash(day({ items: [{ name: 'Turkey cottage pie', tags: [], price_gbp: 4.2 }] }))).not.toBe(dayHash(day()))
    expect(dayHash(day({ note: 'No dinner – UG freshers formal hall', items: [] }))).not.toBe(dayHash(day({ items: [] })))
    expect(dayHash(day({ alert: true, note: 'Served at the top table' }))).not.toBe(dayHash(day({ note: 'Served at the top table' })))
    expect(dayHash(day({ items: [{ name: 'Turkey cottage pie', tags: ['vegetarian'], price_gbp: 4 }] }))).not.toBe(dayHash(day()))
  })
  it("changes with a dish's allergens, and a day without any keeps the hash it had before they were stored", () => {
    const pie = { name: 'Turkey cottage pie', tags: [], price_gbp: 4 }
    expect(dayHash(day({ items: [{ ...pie, allergens: ['celery'] }] }))).not.toBe(dayHash(day({ items: [pie] })))
    expect(dayHash(day({ items: [{ ...pie, allergens: [] }] }))).toBe(dayHash(day({ items: [pie] })))
    // As computed before 0044
    expect(dayHash(day({ items: [pie] }))).toBe(createHash('sha256').update(JSON.stringify([day().date, day().service, null, false, [[pie.name, [], 4, null, null, null, null]]])).digest('hex').slice(0, 32))
  })
  it('skips days saved with the same hash and saves the rest, including those saved by hand', () => {
    const same = day()
    const swapped = day({ service: 'lunch', items: [{ name: 'Chef choice pasta', tags: [] }] })
    const handSaved = day({ date: '2026-10-14' })
    const fresh = day({ date: '2026-10-15' })
    const saved = new Map<string, string | null>([
      [`${today}|dinner`, dayHash(same)],
      [`${today}|lunch`, dayHash(day({ service: 'lunch', items: [{ name: 'Tomato and olives linguine', tags: [] }] }))],
      ['2026-10-14|dinner', null],
    ])
    expect(changedDays([same, swapped, handSaved, fresh], saved)).toEqual([swapped, handSaved, fresh])
  })
})

describe('the Source health issue', () => {
  const failing: SourceCheck = {
    ...failed(failed(undefined, 'corpus-christi/cafeteria', at('2026-10-13T15:37:00Z'), 'x'), 'corpus-christi/cafeteria', at('2026-10-13T16:37:00Z'), '403 Forbidden for https://www.corpus.cam.ac.uk/foodmenu/menu/?reference=1&date=2026-10-12'),
  }
  it('lists sources failing twice in a row, and not one blip', () => {
    const blip = failed(undefined, 'jesus/caff', at('2026-10-13T16:37:00Z'), 'timed out after 30 s')
    const body = healthReport(['corpus-christi/cafeteria', 'jesus/caff', 'darwin/servery'], new Map([[failing.venue_id, failing], [blip.venue_id, blip]]), at('2026-10-13T16:40:00Z'))
    expect(body).toContain('**1 of 3 scripted sources is failing.**')
    expect(body).toContain('| corpus-christi/cafeteria | 13 Oct, 16:37 | 2 |')
    expect(body).not.toContain('jesus/caff')
    expect(body.trim().split('\n').at(-1)).toBe('Checked 13 Oct, 17:40 (London).')
  })
  it('says all is well when nothing is failing, and comments only on a change', () => {
    expect(healthReport(['darwin/servery'], new Map(), at('2026-10-13T16:40:00Z'))).toContain('**All 1 scripted sources are fetching.**')
    expect(healthComment([], [])).toBeUndefined()
    expect(healthComment([failing], ['wolfson/buttery-dining-hall'])).toBe(
      '- **corpus-christi/cafeteria** has failed 2 times in a row: 403 Forbidden for https://www.corpus.cam.ac.uk/foodmenu/menu/?reference=1&date=2026-10-12\n- **wolfson/buttery-dining-hall** is fetching again.\n',
    )
  })
})
