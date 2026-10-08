import { describe, expect, it } from 'vitest'
import { parseGbp, parsePrices } from './prices.ts'

describe('parsePrices', () => {
  it('reads sections, member and non-member prices', () => {
    const p = parsePrices(['site: c', 'venue: hall', 'source: noticeboard', 'observed: 2026-10-08', '---', 'Soup | £1.75', '# comment', '## Brunch', 'Bacon rashers x 2 | 95p | £1.30'].join('\n'))
    expect(p).toEqual({
      venue: 'c/hall',
      source: 'noticeboard',
      observed_on: '2026-10-08',
      items: [
        { section: undefined, name: 'Soup', price_gbp: 1.75 },
        { section: 'Brunch', name: 'Bacon rashers x 2', price_gbp: 0.95, non_member_gbp: 1.3 },
      ],
    })
  })
  it('reads the meals a section is sold at, and the course a line prices', () => {
    const p = parsePrices(['site: c', 'venue: hall', 'source: s', 'observed: 2026-10-08', '---', '## Lunch & dinner | lunch, Dinner', 'Main course | £3.75 | £5.65 | main', 'Soup | £1.75 | | soup', '## Bar', 'Pint | £3'].join('\n'))
    expect(p.items).toEqual([
      { section: 'Lunch & dinner', name: 'Main course', price_gbp: 3.75, non_member_gbp: 5.65, services: ['lunch', 'dinner'], course: 'main' },
      { section: 'Lunch & dinner', name: 'Soup', price_gbp: 1.75, services: ['lunch', 'dinner'], course: 'soup' },
      { section: 'Bar', name: 'Pint', price_gbp: 3 },
    ])
    expect(() => parsePrices('site: c\nvenue: hall\nsource: s\nobserved: 2026-10-08\n---\n## X | elevenses\nTea | 1')).toThrow()
    expect(() => parsePrices('site: c\nvenue: hall\nsource: s\nobserved: 2026-10-08\n---\nTea | 1 | | starter')).toThrow()
  })
  it('rejects lines without a price, and a header without a date', () => {
    expect(() => parsePrices('site: c\nvenue: hall\nsource: s\nobserved: 2026-10-08\n---\nSoup')).toThrow(/expected/)
    expect(() => parsePrices('site: c\nvenue: hall\nsource: s\n---\nSoup | 1')).toThrow(/observed/)
  })
})

describe('parseGbp', () => {
  it('takes pounds or pence', () => {
    expect([parseGbp('£3.75'), parseGbp('3.75'), parseGbp('95p'), parseGbp('£ 4')]).toEqual([3.75, 3.75, 0.95, 4])
    expect(() => parseGbp('free')).toThrow()
  })
})
