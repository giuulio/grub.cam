import { describe, expect, it } from 'vitest'
import { applyFilters, DEFAULT_FILTERS, dishTags, mainDishes, matchesDiet, mealHours, nextService, sectionOf, weekHours, type Filters } from './filters.ts'
import type { Slot, Venue, VenueType } from './types.ts'

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
    expect(ids({ sites: ['d'] })).toEqual(['d/hall'])
    expect(ids({ type: 'hall', sites: ['c'] })).toEqual(['c/hall'])
    expect(ids({ sites: ['c', 'd'] })).toEqual(['c/hall', 'c/bar', 'd/hall'])
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
  it("a meal posted elsewhere is the one shown, with its note; a cancelled one isn't", () => {
    const friday = { date: '2026-10-07', service: 'dinner' as const, items: [], note: 'European Night, see posters for details' }
    const v: Venue = { ...base, slots: [...base.slots, { ...base.slots[0], meal: 'dinner', start: '18:00', end: '19:30' }], menu: [...base.menu, friday] }
    const { status } = applyFilters([v], { ...DEFAULT_FILTERS, date: now.date }, { ...now, minutes: 15 * 60 })[0]
    expect(nextService({ status, days: v.menu })).toMatchObject({ service: 'dinner', note: 'European Night, see posters for details' })
    expect(nextService({ status, days: [...base.menu, { ...friday, note: 'No dinner – formal hall' }] })?.service).toBe('lunch')
  })
})

describe('mealHours', () => {
  it('rows meal by meal, days with the same times together', () => {
    // St Edmund's Dining Hall
    const slot = (meal: Slot['meal'], days: Slot['days'], start: string, end: string): Slot => ({ meal, days, start, end, period: 'term' })
    const rows = mealHours([
      slot('dinner', ['mon', 'tue', 'wed', 'thu', 'fri'], '18:30', '19:45'),
      slot('lunch', ['sun'], '12:30', '13:30'),
      slot('lunch', ['sat'], '11:00', '12:30'),
      slot('lunch', ['mon', 'tue', 'wed', 'thu', 'fri'], '12:30', '13:30'),
      slot('breakfast', ['wed'], '08:00', '09:30'),
    ])
    expect(rows).toEqual([
      { meal: 'breakfast', times: [{ start: '08:00', end: '09:30', days: ['wed'] }] },
      { meal: 'lunch', times: [{ start: '12:30', end: '13:30', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sun'] }, { start: '11:00', end: '12:30', days: ['sat'] }] },
      { meal: 'dinner', times: [{ start: '18:30', end: '19:45', days: ['mon', 'tue', 'wed', 'thu', 'fri'] }] },
    ])
  })
})

describe('weekHours', () => {
  it('runs days with the same times together, each day’s times in order', () => {
    // Homerton's Dining Hall
    const slot = (meal: Slot['meal'], days: Slot['days'], start: string, end: string): Slot => ({ meal, days, start, end, period: 'all' })
    const slots = [
      slot('lunch', ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], '12:00', '14:00'),
      slot('breakfast', ['mon', 'tue', 'wed', 'thu', 'fri'], '07:30', '09:00'),
      slot('breakfast', ['sat'], '08:00', '10:00'),
      slot('brunch', ['sun'], '11:00', '14:00'),
      slot('dinner', ['mon', 'tue', 'wed', 'thu', 'fri'], '17:30', '19:00'),
    ]
    expect(weekHours(slots).map((r) => [r.days.join(','), r.times.map((s) => `${s.start}–${s.end}`).join(' ')])).toEqual([
      ['mon,tue,wed,thu,fri', '07:30–09:00 12:00–14:00 17:30–19:00'],
      ['sat', '08:00–10:00 12:00–14:00'],
      ['sun', '11:00–14:00'],
    ])
    expect(weekHours([])).toEqual([])
  })
})

describe('mainDishes', () => {
  it('keeps the mains, or every dish where the source marks no courses', () => {
    const items = [{ name: 'Soup', tags: [], course: 'soup' as const }, { name: 'Pie', tags: [], course: 'main' as const }, { name: 'Chips', tags: [], course: 'side' as const }, { name: 'Curry', tags: [], course: 'main' as const }]
    expect(mainDishes(items).map((i) => i.name)).toEqual(['Pie', 'Curry'])
    expect(mainDishes(base.menu[0].items)).toBe(base.menu[0].items)
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
