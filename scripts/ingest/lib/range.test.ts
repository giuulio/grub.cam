import { describe, expect, it } from 'vitest'
import type { MenuDay } from '../../schema.ts'
import { addDays } from './dates.ts'
import { fetchRange } from './range.ts'
import type { Adapter, MenuSource } from './source.ts'

const meal = (date: string): MenuDay => ({ date, service: 'lunch', items: [{ name: 'Published dish', tags: [] }] })
const source = (fetch: Adapter['fetch']): MenuSource => ({ venue: 'test/hall', channel: 'json', adapter: { fetch } })

describe('published menu discovery', () => {
  it('continues beyond the former nine/thirteen-week caps until the source is empty', async () => {
    let calls = 0
    const days = await fetchRange(source(async ({ dates }) => {
      calls++
      return { days: dates[0] < '2027-03-01' ? [meal(dates[0])] : [] }
    }), '2026-10-12')
    expect(days).toHaveLength(20)
    expect(days.at(-1)?.date).toBe('2027-02-22')
    expect(calls).toBe(21)
  })
  it('keeps all returned future dates beyond a gap without duplicating a repeated whole-source response', async () => {
    const posted = [meal('2026-10-12'), meal('2028-04-03')]
    let calls = 0
    const days = await fetchRange(source(async () => {
      calls++
      return { days: posted }
    }), '2026-10-12')
    expect(days).toEqual(posted)
    expect(days.every((d) => d.items.length === 1)).toBe(true)
    expect(calls).toBe(2)
  })
  it('continues through past empty weeks and keeps explicitly cancelled meals', async () => {
    const cancelled: MenuDay = { date: '2026-10-12', service: 'dinner', items: [], note: 'No dinner – formal hall' }
    const asked: string[] = []
    const days = await fetchRange(source(async ({ dates }) => {
      asked.push(dates[0])
      return { days: dates[0] === cancelled.date ? [cancelled] : [] }
    }), '2026-10-12', '2026-09-28')
    expect(days).toEqual([cancelled])
    expect(asked).toEqual(['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19'])
  })
  it('does not assign the requested dates to an old source response', async () => {
    const days = await fetchRange(source(async ({ today }) => ({ days: [meal(addDays(today, -14))] })), '2026-10-12')
    expect(days).toEqual([])
  })
})

describe('checking only the next days', () => {
  const asking = () => {
    const asked: { week: string; dates: string[] }[] = []
    const src = source(async ({ week, dates }) => {
      asked.push({ week, dates })
      return { days: dates.map(meal) }
    })
    return { asked, src }
  }
  it('asks for today and tomorrow, across the end of a week', async () => {
    const { asked, src } = asking()
    const days = await fetchRange(src, '2026-10-18', undefined, 'soon')
    expect(asked).toEqual([
      { week: '2026-W42', dates: ['2026-10-18'] },
      { week: '2026-W43', dates: ['2026-10-19'] },
    ])
    expect(days.map((d) => d.date)).toEqual(['2026-10-18', '2026-10-19'])
  })
  it('asks for the rest of this week and all of next, not the days gone', async () => {
    const { asked, src } = asking()
    await fetchRange(src, '2026-10-15', undefined, 'fortnight')
    expect(asked.map((a) => a.dates)).toEqual([
      ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'],
      ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'],
    ])
  })
  it('keeps everything from today on that a whole-page source returns, but not the past', async () => {
    const posted = [meal('2026-10-12'), meal('2026-10-14'), meal('2026-12-01')]
    const days = await fetchRange(source(async () => ({ days: posted })), '2026-10-13', undefined, 'soon')
    expect(days.map((d) => d.date)).toEqual(['2026-10-14', '2026-12-01'])
    expect(days.every((d) => d.items.length === 1)).toBe(true)
  })
})
