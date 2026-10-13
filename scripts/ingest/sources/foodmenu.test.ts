import { afterEach, describe, expect, it, vi } from 'vitest'
import { weekDates } from '../lib/dates.ts'
import { corpus } from './corpus.ts'
import { jesus } from './jesus.ts'

// Jesus's and Corpus's menu app answers any date with a menu; only the College's page limits it, to eight weeks ahead.
const page = '<h2>Cafeteria Lunch</h2><table class="fm-menu-courses"><tr><td><h4>Main course</h4></td></tr><tr class="fm-item"><td class="fm-item-label">Projected dish</td></tr></table>'

function stubFetch() {
  const asked: string[] = []
  vi.stubGlobal('fetch', async (url: string) => {
    asked.push(url)
    return new Response(page)
  })
  return asked
}

afterEach(() => vi.unstubAllGlobals())

describe('the foodmenu app (Jesus, Corpus)', () => {
  it('asks for no date past the eight weeks the College page offers', async () => {
    const asked = stubFetch()
    const ctx = (week: string) => ({ week, dates: weekDates(week), today: '2026-10-12' })
    // 12 Oct + 56 days = Monday 7 Dec
    const edge = await jesus.fetch(ctx('2026-W50'))
    expect(asked.map((u) => new URL(u).searchParams.get('date'))).toEqual(['2026-12-07', '2026-12-07'])
    expect(edge.days.map((d) => d.date)).toEqual(['2026-12-07', '2026-12-07'])
    expect((await jesus.fetch(ctx('2026-W51'))).days).toEqual([])
    expect(asked).toHaveLength(2)
  })

  it('stops Corpus at the same edge', async () => {
    const asked = stubFetch()
    await corpus.fetch({ week: '2026-W50', dates: weekDates('2026-W50'), today: '2026-10-12' })
    expect(asked.map((u) => new URL(u).searchParams.get('date'))).toEqual(['2026-12-07'])
  })
})
