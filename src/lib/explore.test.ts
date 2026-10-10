import { describe, expect, it } from 'vitest'
import { hasLocation, readExploreFilters, resultDishes } from './explore.ts'
import { applyFilters, DEFAULT_FILTERS } from './filters.ts'
import { sideBySide } from './map.ts'
import type { Venue } from './types.ts'

const today = '2026-10-08'
const site = { slug: 'jesus', name: 'Jesus', short_name: null, kind: 'college' as const, official_dining_url: null }
const venue: Venue = {
  id: 'jesus/caff', slug: 'caff', name: 'Caff', type: 'hall', url: null, where: null, serves: null,
  dietary: { tags: [] }, site,
  slots: [{ meal: 'lunch', days: ['thu', 'fri'], start: '12:00', end: '14:00', period: 'all' }],
  menu: [{ date: '2026-10-09', service: 'lunch', items: [{ name: 'Dhal', tags: ['vegan'] }] }],
}
const now = { date: today, day: 'thu' as const, minutes: 20 * 60 }
const read = (q: string) => readExploreFilters(new URLSearchParams(q), today, [site], today, '2026-10-15')

describe('Explore URL filters', () => {
  it('validates meals, diet, sites and dates and ignores retired access, guest and card filters', () => {
    expect(read('type=hall&meal=lunch&diet=vegan,halal,vegan,invalid&site=jesus&date=2026-10-10')).toMatchObject({
      type: 'hall', meal: 'lunch', diets: ['vegan', 'halal'], site: 'jesus', date: '2026-10-10', exactDate: true,
    })
    expect(read('type=cafe&meal=formal&diet=vegan&site=missing&date=2026-02-30')).toMatchObject({ type: 'cafe', meal: undefined, diets: ['vegan'], site: undefined, date: today })
    expect(read('access=public&guests=1&card=1')).toEqual(read(''))
    expect(read('date=2026-10-15').date).toBe(today)
    expect(read('date=2026-10-07').date).toBe(today)
  })
  it('only applies Open now to today', () => {
    expect(read('open=1').openNow).toBe(true)
    expect(read('open=1&date=2026-10-09').openNow).toBe(false)
  })
  it('does not silently use tomorrow’s menu for a dietary match tonight', () => {
    const filters = { ...read('diet=vegan') }
    expect(applyFilters([venue], filters, now)).toHaveLength(0)
    expect(applyFilters([venue], { ...filters, date: '2026-10-09' }, now)).toHaveLength(1)
    expect(applyFilters([venue], { ...DEFAULT_FILTERS, date: today }, now)[0].days[0].date).toBe('2026-10-09')
  })
  it('still previews the published menu when a venue name, rather than a dish, matched', () => {
    expect(resultDishes({ venue, status: { kind: 'unknown' }, days: venue.menu, matchedDishes: 0, searchMatches: [] }, read('q=jesus'))).toEqual(['Dhal'])
  })
})

describe('verified map points', () => {
  it('requires both finite coordinates, including valid zero coordinates', () => {
    expect(hasLocation(venue)).toBe(false)
    expect(hasLocation({ ...venue, latitude: 52.2, longitude: null })).toBe(false)
    expect(hasLocation({ ...venue, latitude: NaN, longitude: 0.1 })).toBe(false)
    expect(hasLocation({ ...venue, latitude: 92, longitude: 0.1 })).toBe(false)
    expect(hasLocation({ ...venue, latitude: 0, longitude: 0 })).toBe(true)
  })
  it('never merges venues: those sharing a coordinate sit side by side, the rest stay on their point', () => {
    const at = (id: string, latitude: number, longitude = 0.1) => ({ id, latitude, longitude })
    const offsets = sideBySide([at('hall', 52.2), at('cafe', 52.2), at('bar', 52.2), at('near', 52.2001)])
    expect([...offsets]).toEqual([['hall', [-30, 0]], ['cafe', [0, 0]], ['bar', [30, 0]]]) // 'near' keeps its own point
    expect([...sideBySide([at('a', 52.2), at('b', 52.2)])]).toEqual([['a', [-15, 0]], ['b', [15, 0]]])
    // Four or more: a centred grid, the last row centred too
    expect([...sideBySide(['a', 'b', 'c', 'd', 'e'].map((id) => at(id, 52.2)))].map(([, o]) => o)).toEqual([[-30, -15], [0, -15], [30, -15], [-15, 15], [15, 15]])
    expect(sideBySide([]).size).toBe(0)
  })
})
