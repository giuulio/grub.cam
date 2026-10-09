import { describe, expect, it } from 'vitest'
import { coverage, coverageMatrix, menuGap, menuWindow } from './coverage.ts'
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
  access: { level: 'unknown' },
  payment: {},
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
  const dHall = { ...hall, id: 'd/hall', site: other, menu: [{ date: '2026-10-08', service: 'lunch' as const, items: [dish] }], payment: { bank_card: false } }
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
  it('only counts colleges that have that kind of place', () => {
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
  it('counts hours, access and card payments place by place', () => {
    expect(byTitle['Hours']).toMatchObject({ have: 1, of: 3, unit: 'places' })
    expect(missing('Hours')).toEqual(['c:hall', 'd:hall'])
    expect(byTitle['Card payments']).toMatchObject({ have: 1, of: 3 }) // known to be no counts as known
    expect(missing('Who can eat there')).toEqual(['c:hall+bar', 'd:hall'])
  })
})

describe('coverageMatrix', () => {
  const cafe = { ...hall, id: 'c/cafe', slug: 'cafe', type: 'cafe' as const, slots: [{ meal: 'snacks' as const, days: ['mon' as const], start: '09:00', end: '17:00', period: 'all' as const }] }
  const [row] = coverageMatrix({ sites: [site], venues: [hall, cafe] })
  const cell = (title: string) => row.cells[['Menus', 'Dining prices', 'Café prices', 'Bar prices', 'Hours', 'Who can eat there', 'Card payments'].indexOf(title)]
  it('says whether all, some or none of a site’s places have each thing', () => {
    expect(cell('Hours')).toMatchObject({ state: 'some', have: 1, of: 2 })
    expect(cell('Hours').missing.map((v) => v.slug)).toEqual(['hall'])
    expect(cell('Menus')).toMatchObject({ state: 'none', have: 0, of: 1 })
    expect(cell('Bar prices')).toMatchObject({ state: 'na', of: 0 })
    expect(coverageMatrix({ sites: [site], venues: [cafe] })[0].cells[4].state).toBe('all')
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
