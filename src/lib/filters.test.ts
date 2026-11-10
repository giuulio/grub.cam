import { describe, expect, it } from 'vitest'
import { applyFilters, awaitedMeal, DEFAULT_FILTERS, dishTags, mainDishes, matchesDiet, mealHours, nextService, sectionOf, weekHours, type Filters } from './filters.ts'
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
    // Open till the same time: the bar, with nothing to show, after both halls' menus
    expect(ids({})).toEqual(['c/hall', 'd/hall', 'c/bar'])
    expect(ids({ type: 'bar' })).toEqual(['c/bar'])
    expect(ids({ type: 'cafe' })).toEqual([])
    expect(ids({ sites: ['d'] })).toEqual(['d/hall'])
    expect(ids({ type: 'hall', sites: ['c'] })).toEqual(['c/hall'])
    expect(ids({ sites: ['c', 'd'] })).toEqual(['c/hall', 'd/hall', 'c/bar'])
  })
  it('lists a café that is a bar by night under both, by its hours', () => {
    const cafeBar: Venue = { ...base, id: 'c/cafe-bar', slug: 'cafe-bar', type: 'cafe', menu: [], slots: [{ ...base.slots[0], meal: 'snacks' }, { ...base.slots[0], meal: 'bar', start: '18:00', end: '23:00' }] }
    const ids = (type: VenueType) => applyFilters([cafeBar], { ...DEFAULT_FILTERS, date: '2026-10-07', type }, now).map((r) => r.venue.id)
    expect(ids('cafe')).toEqual(['c/cafe-bar'])
    expect(ids('bar')).toEqual(['c/cafe-bar'])
    expect(ids('hall')).toEqual([])
  })
  it('lists a café with dated bar openings under Bars without inventing a recurring slot', () => {
    const cafeBar: Venue = { ...base, id: 'c/cafe-bar', slug: 'cafe-bar', type: 'cafe', slots: [{ ...base.slots[0], meal: 'snacks', start: '08:00', end: '20:00' }], menu: [{ date: now.date, service: 'bar', items: [], note: 'Nautilus Bar 20:00–23:00 today' }] }
    const filter = { ...DEFAULT_FILTERS, date: now.date, type: 'bar' as const }
    expect(applyFilters([cafeBar], filter, { ...now, minutes: 21 * 60 })[0]?.status.kind).toBe('open')
    expect(cafeBar.slots.some((s) => s.meal === 'bar')).toBe(false)
    expect(applyFilters([{ ...cafeBar, menu: [] }], filter, now)).toEqual([])
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

describe('applyFilters order', () => {
  const ids = (vs: Venue[], minutes: number) => applyFilters(vs, { ...DEFAULT_FILTERS, date: now.date }, { ...now, minutes }).map((r) => r.venue.id)
  const cafe = (id: string, site: string, end: string, prices = false): Venue => ({
    ...base, id, type: 'cafe', menu: [], site: { ...base.site, slug: site, name: site },
    slots: [{ ...base.slots[0], meal: 'snacks', start: '08:00', end }],
    prices: prices ? [{ name: 'Flat white', price_gbp: 3, services: null } as never] : [],
  })
  it('breaks a tie between open venues closing together: what they show, then kind, then site', () => {
    const bar = { ...cafe('a/bar', 'A', '16:00'), type: 'bar' as const, slots: [{ ...base.slots[0], meal: 'bar' as const, start: '08:00', end: '16:00' }] }
    expect(ids([bar, cafe('b/cafe', 'B', '16:00'), cafe('c/cafe', 'C', '16:00', true)], 15 * 60)).toEqual(['c/cafe', 'b/cafe', 'a/bar'])
  })
  it('lists open venues with something to show first, each lot with those about to close last', () => {
    const vs = [cafe('a/soon', 'A', '15:30', true), cafe('b/empty', 'B', '16:00'), cafe('c/later', 'C', '17:00', true), cafe('d/first', 'D', '16:00', true)]
    expect(ids(vs, 15 * 60 + 10)).toEqual(['d/first', 'c/later', 'a/soon', 'b/empty'])
  })
  it("ranks by the dishes a row lists, not a lunch already served", () => {
    const dinner: Slot = { ...base.slots[0], meal: 'dinner', start: '18:00', end: '19:30' }
    const lunchOnly: Venue = { ...base, id: 'a/lunch-only', site: { ...base.site, name: 'A' }, slots: [...base.slots, dinner], menu: [{ ...base.menu[0], items: [...base.menu[0].items, { name: 'Soup', tags: [] }] }] }
    const withDinner: Venue = { ...base, id: 'b/dinner', site: { ...base.site, name: 'B' }, slots: [...base.slots, dinner], menu: [{ date: now.date, service: 'dinner', items: [{ name: 'Risotto', tags: [] }] }] }
    expect(ids([lunchOnly, withDinner], 15 * 60)).toEqual(['b/dinner', 'a/lunch-only'])
  })
  it('orders a row by the meal whose menu it shows', () => {
    const thu = '2026-10-08'
    const days = ['thu'] as Slot['days']
    // Breakfast at 08:00 without a menu, lunch at 12:00 with one: the row shows lunch, so it follows a café opening at 09:00
    const canteen: Venue = { ...base, id: 'a/canteen', slots: [{ ...base.slots[0], meal: 'breakfast', days, start: '08:00', end: '11:00' }, { ...base.slots[0], days, start: '12:00', end: '14:00' }], menu: [{ date: thu, service: 'lunch', items: [{ name: 'Gratin', tags: [] }] }] }
    const early = { ...cafe('b/cafe', 'B', '17:00', true), slots: [{ ...base.slots[0], meal: 'snacks' as const, days, start: '09:00', end: '17:00' }] }
    const [first, second] = applyFilters([canteen, early], { ...DEFAULT_FILTERS, date: now.date }, { ...now, minutes: 20 * 60 })
    expect([first.venue.id, second.venue.id]).toEqual(['b/cafe', 'a/canteen'])
    expect(second.shown).toMatchObject({ kind: 'closed', next: { date: thu, slot: { meal: 'lunch', start: '12:00' } } })
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

describe('awaitedMeal', () => {
  const breakfast: Slot = { ...base.slots[0], meal: 'breakfast', start: '07:30', end: '09:30' }
  const dinner: Slot = { ...base.slots[0], meal: 'dinner', start: '17:45', end: '19:10' }
  const v: Venue = { ...base, slots: [breakfast, ...base.slots, dinner] }
  const at = (slot: Slot) => ({ slot, date: '2026-10-07' })
  it('names the next meal the venue posts menus for, not a breakfast it never posts', () => {
    expect(awaitedMeal(v, at(breakfast))).toBe('lunch')
    expect(awaitedMeal(v, at(base.slots[0]))).toBe('lunch')
    // Only dinner posted this week: at breakfast, dinner's is the one to wait for
    expect(awaitedMeal({ ...v, menu: [{ date: '2026-10-08', service: 'dinner', items: [{ name: 'Curry', tags: [] }] }] }, at(breakfast))).toBe('dinner')
  })
  it("keeps the status's meal when none it posts is left that day, or it has no menus to go by: it may not be up yet", () => {
    // Only today's lunch loaded, posted day by day: tonight's dinner just isn't up yet
    expect(awaitedMeal(v, at(dinner))).toBe('dinner')
    expect(awaitedMeal({ ...v, menu: [] }, at(breakfast))).toBe('breakfast')
  })
})

describe('nextService', () => {
  const dinnerSlot: Slot = { ...base.slots[0], meal: 'dinner', start: '18:00', end: '19:30' }
  const next = (v: Venue, minutes: number) => applyFilters([v], { ...DEFAULT_FILTERS, date: now.date, exactDate: true }, { ...now, minutes })[0].next
  it("picks the menu for the service the status points at, else the next that day with one", () => {
    const dinner = { date: '2026-10-07', service: 'dinner' as const, items: [{ name: 'Risotto', tags: [] }] }
    const v: Venue = { ...base, slots: [...base.slots, dinnerSlot], menu: [...base.menu, dinner] }
    expect(next(v, 12 * 60 + 30)?.service).toBe('lunch')
    expect(next(v, 15 * 60)?.service).toBe('dinner')
    expect(nextService({ kind: 'unknown' }, v.menu, v.slots)?.service).toBe('lunch')
    // Open for lunch without its menu: dinner's, still to come
    expect(next({ ...v, menu: [dinner] }, 12 * 60 + 30)?.service).toBe('dinner')
  })
  it("never previews a meal that's over: not lunch at dinner, nor today's once it's closed till tomorrow", () => {
    const v: Venue = { ...base, slots: [...base.slots, dinnerSlot, { ...base.slots[0], days: ['thu'] }] }
    expect(next(v, 18 * 60 + 30)).toBeUndefined()
    const thursday = { date: '2026-10-08', service: 'lunch' as const, items: [{ name: 'Curry', tags: [] }] }
    expect(next({ ...v, menu: [...v.menu, thursday] }, 20 * 60)).toMatchObject({ date: '2026-10-08', service: 'lunch' })
  })
  it("a meal posted elsewhere is the one shown, with its note; a cancelled one isn't", () => {
    const friday = { date: '2026-10-07', service: 'dinner' as const, items: [], note: 'European Night, see posters for details' }
    const v: Venue = { ...base, slots: [...base.slots, dinnerSlot], menu: [...base.menu, friday] }
    expect(next(v, 15 * 60)).toMatchObject({ service: 'dinner', note: 'European Night, see posters for details' })
    expect(next({ ...v, menu: [...base.menu, { ...friday, note: 'No dinner – formal hall' }] }, 15 * 60)).toBeUndefined()
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
