import { describe, expect, it } from 'vitest'
import { applyFilters, DEFAULT_FILTERS, dishTags, matchesDiet, nextService, sectionOf, type Filters } from './filters.ts'
import type { Venue, VenueType } from './types.ts'

const base: Venue = {
  id: 'c/hall',
  slug: 'hall',
  name: 'Hall',
  type: 'hall',
  url: null,
  where: null,
  serves: null,
  site: { slug: 'c', name: 'C', short_name: null, kind: 'college', official_dining_url: null },
  slots: [{ meal: 'lunch', days: ['wed'], start: '12:00', end: '14:00', period: 'all' }],
  dietary: { tags: ['vegetarian'] },
  menu: [{ date: '2026-10-07', service: 'lunch', items: [{ name: 'Dhal', tags: ['vegan', 'vegetarian'] }, { name: 'Lamb', tags: ['halal'] }] }],
}
const now = { date: '2026-10-07', day: 'wed' as const, minutes: 12 * 60 + 30 }

describe('matchesDiet', () => {
  it('uses dish tags when a menu exists for the day', () => {
    const days = base.menu
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
    const closed: Venue = { ...base, id: 'c/cafe', slug: 'cafe', type: 'cafe', menu: [], slots: [{ ...base.slots[0], meal: 'snacks', start: '15:00', end: '17:00' }] }
    const r = applyFilters([closed, base], { ...DEFAULT_FILTERS, date: '2026-10-07', meal: undefined }, now)
    expect(r.map((x) => x.venue.id)).toEqual(['c/hall', 'c/cafe'])
    expect(r[0].status.kind).toBe('open')
    expect(r[0].matchedDishes).toBe(2)
  })
  it('filters by open now and search', () => {
    expect(applyFilters([base], { ...DEFAULT_FILTERS, date: '2026-10-07', openNow: true }, { ...now, minutes: 9 * 60 })).toHaveLength(0)
    expect(applyFilters([base], { ...DEFAULT_FILTERS, date: '2026-10-07', q: 'dhal' }, now)).toHaveLength(1)
    expect(applyFilters([base], { ...DEFAULT_FILTERS, date: '2026-10-07', q: 'pizza' }, now)).toHaveLength(0)
  })
  it('filters by venue type and site', () => {
    const bar: Venue = { ...base, id: 'c/bar', slug: 'bar', type: 'bar', menu: [] }
    const other: Venue = { ...base, id: 'd/hall', site: { ...base.site, slug: 'd', name: 'D', kind: 'university' } }
    const ids = (f: Partial<Filters>) => applyFilters([base, bar, other], { ...DEFAULT_FILTERS, date: '2026-10-07', ...f }, now).map((r) => r.venue.id)
    expect(ids({})).toEqual(['c/hall', 'c/bar', 'd/hall'])
    expect(ids({ type: 'bar' })).toEqual(['c/bar'])
    expect(ids({ type: 'cafe' })).toEqual([])
    expect(ids({ site: 'd' })).toEqual(['d/hall'])
    expect(ids({ type: 'hall', site: 'c' })).toEqual(['c/hall'])
  })
  it('lists a café that is a bar by night under both, by its hours', () => {
    const cafeBar: Venue = { ...base, id: 'c/cafe-bar', slug: 'cafe-bar', type: 'cafe', menu: [], slots: [{ ...base.slots[0], meal: 'snacks' }, { ...base.slots[0], meal: 'bar', start: '18:00', end: '23:00' }] }
    const ids = (type: VenueType) => applyFilters([cafeBar], { ...DEFAULT_FILTERS, date: '2026-10-07', type }, now).map((r) => r.venue.id)
    expect(ids('cafe')).toEqual(['c/cafe-bar'])
    expect(ids('bar')).toEqual(['c/cafe-bar'])
    expect(ids('hall')).toEqual([])
  })
  it('counts formal hall only when asked for, or where it is all a hall holds', () => {
    const formal = { ...base.slots[0], meal: 'formal' as const, start: '19:30', end: '21:30' }
    const evening = { ...now, minutes: 20 * 60 }
    const status = (v: Venue, f: Partial<Filters> = {}) => applyFilters([v], { ...DEFAULT_FILTERS, date: now.date, ...f }, evening)[0]?.status.kind
    const hall: Venue = { ...base, slots: [...base.slots, formal] }
    expect(status(hall)).toBe('closed')
    expect(status(hall, { type: 'hall', meal: 'formal' })).toBe('open')
    expect(status({ ...base, id: 'c/formal-hall', slots: [formal] })).toBe('open')
    // Where formal hall is held but its days aren't published, it's still listed under Formal
    const unpublished: Venue = { ...base, id: 'c/old-hall', slots: [], menu: [], formal: {} }
    const formalHalls = applyFilters([unpublished, { ...unpublished, id: 'c/caff', formal: undefined }], { ...DEFAULT_FILTERS, date: now.date, type: 'hall', meal: 'formal' }, now)
    expect(formalHalls.map((r) => r.venue.id)).toEqual(['c/old-hall'])
  })
})

describe('sectionOf', () => {
  it('groups by status: open, later today, other days, unknown hours', () => {
    const at = (minutes: number, v: Venue = base) => sectionOf(applyFilters([v], { ...DEFAULT_FILTERS, date: now.date }, { ...now, minutes })[0].status)
    expect(at(12 * 60 + 30)).toBe('open')
    expect(at(9 * 60)).toBe('later')
    expect(at(15 * 60)).toBe('other')
    expect(at(12 * 60, { ...base, slots: [] })).toBe('unknown')
  })
})

describe('nextService', () => {
  it("picks the menu for the service the status points at, else the day's first", () => {
    const dinner = { date: '2026-10-07', service: 'dinner' as const, items: [{ name: 'Risotto', tags: [] }] }
    const v: Venue = { ...base, slots: [...base.slots, { ...base.slots[0], meal: 'dinner', start: '18:00', end: '19:30' }], menu: [...base.menu, dinner] }
    const at = (minutes: number) => nextService(applyFilters([v], { ...DEFAULT_FILTERS, date: now.date }, { ...now, minutes })[0])?.service
    expect(at(12 * 60 + 30)).toBe('lunch')
    expect(at(15 * 60)).toBe('dinner')
    expect(nextService({ status: { kind: 'unknown' }, days: v.menu })?.service).toBe('lunch')
  })
})

describe('applyFilters menu date', () => {
  it("browses the next service but keeps searches on the selected date", () => {
    const thu = { date: '2026-10-08', service: 'lunch' as const, items: [{ name: 'Katsu curry', tags: [] }] }
    const v: Venue = { ...base, slots: [{ ...base.slots[0], days: ['wed', 'thu'] }], menu: [...base.menu, thu] }
    const evening = { ...now, minutes: 22 * 60 }
    const [r] = applyFilters([v], { ...DEFAULT_FILTERS, date: now.date }, evening)
    expect(r.days.map((d) => d.date)).toEqual(['2026-10-08'])
    expect(applyFilters([v], { ...DEFAULT_FILTERS, date: now.date, q: 'katsu' }, now)).toEqual([])
    expect(applyFilters([v], { ...DEFAULT_FILTERS, date: now.date, q: 'katsu' }, evening)).toEqual([])
    expect(applyFilters([v], { ...DEFAULT_FILTERS, date: thu.date, q: 'katsu' }, evening)).toHaveLength(1)
  })
})

describe('dishTags', () => {
  it('keeps only the strictest of vegan/vegetarian, in a fixed order', () => {
    expect(dishTags(['halal', 'vegetarian', 'gluten_free', 'vegan'])).toEqual(['vegan', 'gluten_free', 'halal'])
    expect(dishTags(['pescatarian', 'vegetarian'])).toEqual(['vegetarian'])
    expect(dishTags([])).toEqual([])
  })
})
