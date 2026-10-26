import { describe, expect, it } from 'vitest'
import { list, siteSummary, venueSummary } from './summary.ts'
import type { Site, Slot, Venue } from './types.ts'

const emma: Site = { slug: 'emmanuel', name: 'Emmanuel', short_name: null, kind: 'college', official_dining_url: null, aliases: ['Emma'] }
const sidgwick: Site = { slug: 'sidgwick', name: 'Sidgwick Site', short_name: null, kind: 'university', official_dining_url: null }
const slot = (meal: Slot['meal'], days: Slot['days'], start: string, end: string, period: Slot['period'] = 'all'): Slot => ({ meal, days, start, end, period })
const venue = (v: Partial<Venue> & Pick<Venue, 'id' | 'name' | 'type' | 'site'>): Venue => ({ slug: v.id.split('/')[1], url: null, where: null, serves: null, dietary: { tags: [] }, slots: [], menu: [], ...v })

// A Tuesday in Michaelmas Full Term
const date = '2026-10-27'
const hall = venue({
  id: 'emmanuel/hall',
  name: 'Hall',
  type: 'hall',
  site: emma,
  slots: [slot('lunch', ['mon', 'tue', 'wed', 'thu', 'fri'], '12:15', '13:30'), slot('lunch', ['sat'], '12:15', '13:15'), slot('dinner', ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], '17:45', '19:00'), slot('formal', ['mon', 'tue', 'thu', 'fri', 'sat', 'sun'], '19:30', '21:00', 'term')],
  menu: [{ date, service: 'lunch', items: [{ name: 'Dhal', tags: [], price_gbp: 3.2, allergens: ['mustard'] }] }],
})

describe('summary', () => {
  it('joins a list without breaking an item that has commas of its own', () => {
    expect(list(['Mon, Wed 18:00', 'Tue, Fri 17:30'])).toBe('Mon, Wed 18:00 and Tue, Fri 17:30')
    expect(list(['a', 'b', 'c'])).toBe('a, b and c')
    expect(list([])).toBe('')
  })

  it('says what a dining hall serves and when, each meal once, its formal hall and what its menus carry', () => {
    expect(venueSummary(hall, date)).toBe(
      'Hall is the dining hall of Emmanuel College (Emma), Cambridge, serving lunch Mon–Fri 12:15–13:30 and Sat 12:15–13:15, and dinner daily 17:45–19:00. ' +
        'It also holds formal hall: daily except Wed · 19:30, in term. Its lunch and dinner menus are here day by day, with prices and allergens.',
    )
  })

  it('names where a formal-only hall holds formal, and a University café with “the” and its opening times', () => {
    const formal = venue({ id: 'emmanuel/old-hall', name: 'Old Hall', type: 'hall', site: emma, slots: [slot('formal', ['fri'], '19:30', '21:00', 'term')] })
    expect(venueSummary(formal, date)).toBe('Old Hall is where Emmanuel College (Emma), Cambridge, holds formal hall: Fri · 19:30, in term.')
    const buttery = venue({ id: 'sidgwick/the-buttery', name: 'The Buttery', type: 'cafe', site: sidgwick, slots: [slot('snacks', ['mon', 'tue', 'wed', 'thu', 'fri'], '08:30', '16:00')] })
    const arc = venue({ id: 'sidgwick/arc-cafe', name: 'ARC Café', type: 'cafe', site: sidgwick })
    expect(venueSummary(buttery, date, [buttery, arc])).toBe('The Buttery is a café at the Sidgwick Site, University of Cambridge. Opening times: Mon–Fri 08:30–16:00.')
    expect(venueSummary(arc, date)).toBe('ARC Café is the café of the Sidgwick Site, University of Cambridge. Its opening times aren’t published yet.')
  })

  it('lists a site’s venues by what they are, plain cafés together, and its other names', () => {
    const bar = venue({ id: 'emmanuel/bar', name: 'Bar', type: 'bar', site: emma })
    expect(siteSummary(emma, [hall, bar])).toBe('Emmanuel College has two places to eat and drink: Hall, the dining hall, for lunch, dinner and formal hall; and Bar, the bar. Also known as Emma.')
    const cafes = ['The Buttery', 'ARC Café', 'Whale Café'].map((name, i) => venue({ id: `sidgwick/c${i}`, name, type: 'cafe', site: sidgwick }))
    expect(siteSummary(sidgwick, cafes)).toBe('The Sidgwick Site has three cafés: The Buttery, ARC Café and Whale Café.')
  })
})
