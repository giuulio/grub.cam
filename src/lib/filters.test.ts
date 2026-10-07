import { describe, expect, it } from 'vitest'
import type { College, VenueView } from './data/types.ts'
import { applyFilters, DEFAULT_FILTERS, matchesDiet } from './filters.ts'

const college: College = { slug: 'c', name: 'C', reviewed: '2026-10-07', links: [], venues: [], notes: [] }
const prov = { source_kind: 'official' as const, confidence: 'high' as const }
const base: VenueView = {
  id: 'c/hall',
  slug: 'hall',
  name: 'Hall',
  type: 'hall',
  college,
  slots: [{ college: 'c', venue: 'hall', meal: 'lunch', days: ['wed'], start: '12:00', end: '14:00', period: 'all', prov }],
  access: { level: 'public', prov },
  payment: { bank_card: true, prov },
  dietary: { tags: ['vegetarian'], prov },
  menu: {
    college: 'c',
    venue: 'hall',
    week: '2026-W41',
    source_url: 'https://x',
    fetched_at: '',
    method: 'script',
    days: [{ date: '2026-10-07', service: 'lunch', items: [{ name: 'Dhal', tags: ['vegan', 'vegetarian'] }, { name: 'Lamb', tags: ['halal'] }] }],
  },
}
const now = { date: '2026-10-07', day: 'wed' as const, minutes: 12 * 60 + 30 }

describe('matchesDiet', () => {
  it('uses dish tags when a menu exists for the day', () => {
    const days = base.menu!.days
    expect(matchesDiet(base, days, ['vegan'])).toBe(true)
    expect(matchesDiet(base, days, ['halal'])).toBe(true)
    expect(matchesDiet(base, days, ['kosher'])).toBe(false)
  })
  it('falls back to venue-level tags without a menu', () => {
    expect(matchesDiet(base, [], ['vegetarian'])).toBe(true)
    expect(matchesDiet(base, [], ['vegan'])).toBe(false)
  })
})

describe('applyFilters', () => {
  it('ranks open venues first and counts matched dishes', () => {
    const closed: VenueView = { ...base, id: 'c/cafe', slug: 'cafe', type: 'cafe', menu: undefined, slots: [{ ...base.slots[0], meal: 'snacks', start: '15:00', end: '17:00' }] }
    const r = applyFilters([closed, base], { ...DEFAULT_FILTERS, date: '2026-10-07', meal: undefined }, now)
    expect(r.map((x) => x.venue.id)).toEqual(['c/hall', 'c/cafe'])
    expect(r[0].status.kind).toBe('open')
    expect(r[0].matchedDishes).toBe(2)
  })
  it('filters by open now, bank card and search', () => {
    expect(applyFilters([base], { ...DEFAULT_FILTERS, date: '2026-10-07', openNow: true }, { ...now, minutes: 9 * 60 })).toHaveLength(0)
    expect(applyFilters([{ ...base, payment: { prov } }], { ...DEFAULT_FILTERS, date: '2026-10-07', bankCard: true }, now)).toHaveLength(0)
    expect(applyFilters([base], { ...DEFAULT_FILTERS, date: '2026-10-07', q: 'dhal' }, now)).toHaveLength(1)
    expect(applyFilters([base], { ...DEFAULT_FILTERS, date: '2026-10-07', q: 'pizza' }, now)).toHaveLength(0)
  })
})
