import { describe, expect, it } from 'vitest'
import { hasLocation, legacyPath, readFilters, resultDishes, type Scope } from './finder.ts'
import { applyFilters, DEFAULT_FILTERS } from './filters.ts'
import { formatDistance, metresBetween, sideBySide } from './map.ts'
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
const read = (q: string, scope: Scope = 'all') => readFilters(new URLSearchParams(q), scope, today, [site], today, '2026-10-15')

describe('front page tabs', () => {
  it("reads Dining's meal, diet and date there and nowhere else", () => {
    expect(read('meal=lunch&diet=vegan,halal,vegan,invalid&site=jesus&date=2026-10-10', 'hall')).toMatchObject({
      type: 'hall', meal: 'lunch', diets: ['vegan', 'halal'], sites: ['jesus'], date: '2026-10-10', exactDate: true,
    })
    expect(read('meal=lunch&diet=vegan&date=2026-10-10&site=jesus', 'cafe')).toMatchObject({ type: 'cafe', meal: undefined, diets: [], date: today, sites: ['jesus'] })
    expect(read('', 'all').type).toBeUndefined()
    // Formal hall has its own tab: Dining's meal filter doesn't offer it, the Formal hall tab is nothing else
    expect(read('meal=formal', 'hall').meal).toBeUndefined()
    expect(read('', 'formal')).toMatchObject({ type: 'hall', meal: 'formal' })
    expect(read('site=missing&date=2026-02-30', 'hall')).toMatchObject({ sites: [], date: today })
    // Several colleges at once; unknown ones and repeats dropped
    expect(read('site=jesus,missing,jesus').sites).toEqual(['jesus'])
    expect(read('date=2026-10-15', 'hall').date).toBe(today)
    expect(read('date=2026-10-07', 'hall').date).toBe(today)
  })
  it('only applies Open now to today', () => {
    expect(read('open=1').openNow).toBe(true)
    expect(read('open=1&date=2026-10-09', 'hall').openNow).toBe(false)
  })
  it('does not silently use tomorrow’s menu for a dietary match tonight', () => {
    const filters = read('diet=vegan', 'hall')
    expect(applyFilters([venue], filters, now)).toHaveLength(0)
    expect(applyFilters([venue], { ...filters, date: '2026-10-09' }, now)).toHaveLength(1)
    expect(applyFilters([venue], { ...DEFAULT_FILTERS, date: today }, now)[0].days[0].date).toBe('2026-10-09')
  })
  it('sends a link from before the tabs to the tab it names, a picked venue to its page', () => {
    const from = (q: string) => legacyPath(new URLSearchParams(q))
    expect(from('type=cafe&q=latte&diet=vegan&view=list')).toBe('/cafes?q=latte')
    expect(from('type=hall&meal=lunch&diet=vegan&open=1')).toBe('/dining?open=1&meal=lunch&diet=vegan')
    expect(from('type=hall&meal=formal&site=jesus')).toBe('/formal?site=jesus')
    expect(from('venue=jesus/caff&type=hall')).toBe('/jesus/caff')
    expect(from('place=jesus/caff')).toBe('/jesus/caff')
    expect(from('q=dhal&access=public&guests=1')).toBe('/?q=dhal')
    expect(from('venue=../../etc')).toBe('/')
  })
  it('still previews the published menu when a venue name, rather than a dish, matched', () => {
    expect(resultDishes({ venue, status: { kind: 'unknown' }, days: venue.menu, matchedDishes: 0, searchMatches: [] }, read('q=jesus'))).toEqual(['Dhal'])
  })
})

describe('nearest first', () => {
  it('measures straight-line distance and rounds it', () => {
    // King's Parade to the Fitzwilliam Museum: about 560 m
    expect(Math.round(metresBetween({ latitude: 52.2048, longitude: 0.1166 }, { latitude: 52.2001, longitude: 0.1196 }) / 50) * 50).toBe(550)
    expect(formatDistance(4)).toBe('10 m')
    expect(formatDistance(347)).toBe('350 m')
    expect(formatDistance(1260)).toBe('1.3 km')
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
