import { describe, expect, it } from 'vitest'
import { coverage, menuGap, menuWindow, overallCoverage, siteProgress, tabCoverage, venueGaps } from './coverage.ts'
import type { Site, Venue } from './types.ts'

const site: Site = { slug: 'c', name: 'C', short_name: null, kind: 'college', official_dining_url: null }
const hall: Venue = {
  id: 'c/hall',
  slug: 'hall',
  name: 'Hall',
  type: 'hall',
  url: null,
  where: null,
  serves: null,
  site,
  slots: [],
  dietary: { tags: [] },
  menu_channel: 'intranet',
  menu: [],
}
const dish = { name: 'Dhal', tags: [] }

describe('menuGap', () => {
  it('says why a menu is missing from how it is published', () => {
    expect(menuGap(hall)).toBe('members')
    expect(menuGap({ ...hall, menu_channel: 'email' })).toBe('members')
    expect(menuGap({ ...hall, menu_channel: 'pdf' })).toBe('online')
    expect(menuGap({ ...hall, menu_channel: 'none' })).toBe('unpublished')
    expect(menuGap({ ...hall, menu_channel: null })).toBeUndefined()
  })
})

describe('coverage', () => {
  const other: Site = { ...site, slug: 'd', name: 'D' }
  const uni: Site = { ...site, slug: 'w', name: 'W', kind: 'university' }
  const priced = { ...hall, menu: [{ date: '2026-10-08', service: 'lunch' as const, items: [{ ...dish, price_gbp: 3.2 }] }] }
  const bar = { ...hall, id: 'c/bar', slug: 'bar', type: 'bar' as const, slots: [{ meal: 'bar' as const, days: ['fri' as const], start: '18:00', end: '23:00', period: 'all' as const }] }
  const dHall = { ...hall, id: 'd/hall', site: other, menu: [{ date: '2026-10-08', service: 'lunch' as const, items: [dish] }] }
  const uniCafe = { ...hall, id: 'w/cafe', site: uni, type: 'cafe' as const }
  const byTitle = Object.fromEntries(coverage({ sites: [site, other, uni], venues: [priced, bar, dHall, uniCafe] }).map((c) => [c.title, c]))
  const missing = (title: string) => byTitle[title].missing.map((m) => `${m.site.slug}:${m.venues.map((v) => v.slug).join('+')}`)

  it('counts menus and prices by college, leaving out University sites', () => {
    expect(byTitle['Menus']).toMatchObject({ have: 2, of: 2, unit: 'sites' })
    expect(byTitle['Dining prices']).toMatchObject({ have: 1, of: 2 })
    expect(missing('Dining prices')).toEqual(['d:hall'])
  })
  it('counts a posted price list as prices', () => {
    const listed = { ...hall, id: 'x/bar', type: 'bar' as const, prices: [{ section: null, name: 'Pint', price_gbp: 3.5, non_member_gbp: null, services: null, course: null, tags: [], observed_on: '2026-10-08', source: 'noticeboard' }] }
    const rows = coverage({ sites: [site], venues: [listed] })
    expect(rows.find((c) => c.title === 'Bar prices')).toMatchObject({ have: 1, of: 1, dated: false })
    expect(rows.find((c) => c.title === 'Menus')).toMatchObject({ have: 0, dated: true })
  })
  it('only counts colleges that have that kind of venue', () => {
    expect(byTitle['Bar prices']).toMatchObject({ have: 0, of: 1 })
    expect(byTitle['Café prices']).toMatchObject({ have: 0, of: 0, missing: [] })
  })
  it('counts University sites on their own', () => {
    const uniTitle = Object.fromEntries(coverage({ sites: [site, uni], venues: [priced, uniCafe] }, 'university').map((c) => [c.title, c]))
    expect(uniTitle['Café prices']).toMatchObject({ have: 0, of: 1 })
    expect(uniTitle['Menus']).toMatchObject({ have: 0, of: 0 })
  })
  it('expects menus from Dining, not from a Hall used only for formal hall', () => {
    const formalHall = { ...hall, id: 'c/old-hall', slug: 'old-hall', formal: {}, slots: [{ meal: 'formal' as const, days: ['fri' as const], start: '19:30', end: '21:30', period: 'term' as const }] }
    expect(coverage({ sites: [site], venues: [formalHall] })[0]).toMatchObject({ title: 'Menus', have: 0, of: 0 })
    // No hours published: a Hall only for formals isn't in the menu sources; a cafeteria (with a menu channel) is
    expect(coverage({ sites: [site], venues: [{ ...formalHall, slots: [], menu_channel: null }] })[0]).toMatchObject({ of: 0 })
    expect(coverage({ sites: [site], venues: [{ ...formalHall, slots: [], menu_channel: 'email' }] })[0]).toMatchObject({ have: 0, of: 1 })
  })
  it('counts hours venue by venue', () => {
    expect(byTitle['Hours']).toMatchObject({ have: 1, of: 3, unit: 'venues' })
    expect(missing('Hours')).toEqual(['c:hall', 'd:hall'])
  })
})

describe('venueGaps', () => {
  const slot = { meal: 'lunch' as const, days: ['mon' as const], start: '12:00', end: '14:00', period: 'all' as const }
  const photo = { path: 'c/hall/1', widths: [480], width: 480, height: 360, color: '#000', alt: '', credit: null, licence: null, source: null }
  it('lists what a dining hall is missing, most worth having first', () => {
    expect(venueGaps(hall).map((g) => [g.kind, g.send])).toEqual([
      ['menu', 'menu'],
      ['hours', 'hours'],
      ['prices', 'prices'],
      ['photo', 'photo'],
    ])
  })
  it('does not ask for a menu that a script fetches, nor from a Hall used only for formal hall', () => {
    expect(venueGaps({ ...hall, menu_scripted: true }).map((g) => g.kind)).toEqual(['hours', 'prices', 'photo'])
    const formalHall = { ...hall, formal: { price_gbp: 20 }, slots: [{ ...slot, meal: 'formal' as const }] }
    expect(venueGaps(formalHall).map((g) => g.kind)).toEqual(['prices', 'photo'])
  })
  it('asks a café for its price list before anything else, and nothing once it is all here', () => {
    const cafe = { ...hall, type: 'cafe' as const, menu_channel: null, slots: [slot] }
    expect(venueGaps(cafe).map((g) => [g.kind, g.label])).toEqual([
      ['prices', 'The price list'],
      ['photo', 'A photo of the venue'],
    ])
    expect(venueGaps({ ...cafe, type: 'bar' })[0].label).toBe('The drinks list')
    expect(venueGaps({ ...cafe, prices: [{ section: null, name: 'Flat white', price_gbp: 3, non_member_gbp: null, services: null, course: null, tags: [], observed_on: '2026-10-08', source: 'board' }], photos: [photo] })).toEqual([])
  })
  it('asks for formal hall’s price or time when one is unknown', () => {
    const withFormal = { ...hall, formal: {}, slots: [slot] }
    expect(venueGaps(withFormal).some((g) => g.kind === 'formal' && g.send === 'other')).toBe(true)
    expect(venueGaps({ ...withFormal, formal: { price_gbp: 15 }, slots: [slot, { ...slot, meal: 'formal' as const }] }).some((g) => g.kind === 'formal')).toBe(false)
  })
})

describe('siteProgress', () => {
  const slot = { meal: 'lunch' as const, days: ['mon' as const], start: '12:00', end: '14:00', period: 'all' as const }
  const other: Site = { ...site, slug: 'd', name: 'D' }
  const third: Site = { ...site, slug: 'e', name: 'E' }
  const uni: Site = { ...site, slug: 'w', name: 'W', kind: 'university' }
  // C's hall has its menu (4) and hours (3) of menu, hours, prices and photo (4 + 3 + 1 + 1)
  const cHall = { ...hall, slots: [slot], menu: [{ date: '2026-10-08', service: 'lunch' as const, items: [dish] }] }
  // D's café has its hours (3) of prices, hours and photo (3 + 3 + 1)
  const dCafe = { ...hall, id: 'd/cafe', site: other, type: 'cafe' as const, menu_channel: null, slots: [slot] }
  // E's hall has a script that has fetched nothing: not the members' to send, so not counted
  const eHall = { ...hall, id: 'e/hall', site: third, menu_scripted: true, slots: [slot] }
  const progress = siteProgress({ sites: [site, other, third, uni], venues: [cHall, dCafe, eHall, { ...dCafe, id: 'w/cafe', site: uni }] }, 'college')

  it('ranks colleges by the weight of what their venues have, out of what they could', () => {
    expect(progress.map((p) => [p.site.slug, p.have, p.of, p.missing])).toEqual([
      ['c', 7, 9, 2],
      ['e', 3, 5, 2],
      ['d', 3, 7, 2],
    ])
  })
  it('says which venues are missing what, most worth having first', () => {
    expect(progress[0].venues.map((v) => [v.venue.id, v.gaps.map((g) => g.kind)])).toEqual([['c/hall', ['prices', 'photo']]])
  })
  it('counts one kind of thing alone, leaving out sites with none of it to have', () => {
    const menus = siteProgress({ sites: [site, other, third], venues: [cHall, dCafe, eHall] }, 'college', 'menu')
    expect(menus.map((p) => [p.site.slug, p.have, p.of, p.missing])).toEqual([['c', 1, 1, 0]])
    const photos = siteProgress({ sites: [site, other, third], venues: [cHall, dCafe, eHall] }, 'college', 'photo')
    expect(photos.map((p) => [p.site.slug, p.have, p.of, p.venues.length])).toEqual([
      ['c', 0, 1, 1],
      ['d', 0, 1, 1],
      ['e', 0, 1, 1],
    ])
  })
  it('keeps to colleges or to University sites', () => {
    expect(siteProgress({ sites: [site, uni], venues: [cHall, { ...dCafe, id: 'w/cafe', site: uni }] }, 'university').map((p) => p.site.slug)).toEqual(['w'])
  })
})
describe('overallCoverage', () => {
  it('counts menus for dining halls, price lists for cafés and bars, hours and photos for every venue', () => {
    const menu = [{ date: '2026-10-08', service: 'lunch' as const, items: [dish] }]
    const cafe = { ...hall, id: 'c/cafe', type: 'cafe' as const, menu_channel: null, prices: [{ section: null, name: 'Tea', price_gbp: 2, non_member_gbp: null, services: null, course: null, tags: [], observed_on: '2026-10-08', source: 'board' }] }
    const [menus, prices, hours, photos] = overallCoverage([hall, { ...hall, id: 'c/other', menu }, cafe])
    expect(menus).toMatchObject({ what: 'Menus this week', have: 1, of: 2, dated: true })
    expect(prices).toMatchObject({ what: 'Price lists', have: 1, of: 1 })
    expect(hours).toMatchObject({ have: 0, of: 3 })
    expect(photos).toMatchObject({ have: 0, of: 3, noun: 'venues' })
  })
})

describe('menuWindow', () => {
  it('names the loaded dates, end exclusive', () => {
    expect(menuWindow({ menuFrom: '2026-10-08', menuTo: '2026-10-15' })).toBe('Thu 8 – Wed 14 Oct')
    expect(menuWindow({ menuFrom: '2026-10-08', menuTo: '2026-10-15' }, true)).toBe('8–14 Oct')
    expect(menuWindow({ menuFrom: '2026-10-28', menuTo: '2026-11-04' })).toBe('Wed 28 Oct – Tue 3 Nov')
    expect(menuWindow({ menuFrom: '2026-10-28', menuTo: '2026-11-04' }, true)).toBe('28 Oct – 3 Nov')
  })
})

describe('tabCoverage', () => {
  const menu = [{ date: '2026-10-08', service: 'lunch' as const, items: [dish] }]
  const cafe = { ...hall, id: 'c/cafe', type: 'cafe' as const, prices: [] }
  it('counts what matters most under each tab', () => {
    expect(tabCoverage([hall, { ...hall, id: 'c/other', menu }, cafe], 'hall')).toEqual({ what: 'Menus this week', noun: 'dining venues', have: 1, of: 2 })
    expect(tabCoverage([hall, cafe], 'cafe')).toMatchObject({ have: 0, of: 1 })
    expect(tabCoverage([{ ...hall, formal: { price_gbp: 12 } }, hall], 'formal')).toMatchObject({ have: 1, of: 1 })
  })
})
