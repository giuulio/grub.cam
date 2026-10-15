import { describe, expect, it } from 'vitest'
import { mergeList, parseGbp, parsePrices, replaceSections, savedList, unnamedColumns } from './prices.ts'

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
  it('takes diet codes after a name as tags', () => {
    const p = parsePrices('site: c\nvenue: cafe\nsource: s\nobserved: 2026-10-09\n---\nRoasted pepper & hummus (VE) | £5\nRocky road (GF, DF, VE) | 4\nMarinara (GFA) | 10')
    expect(p.items.map((i) => [i.name, i.tags])).toEqual([
      ['Roasted pepper & hummus', ['vegan', 'vegetarian']],
      ['Rocky road', ['gluten_free', 'dairy_free', 'vegan', 'vegetarian']],
      ['Marinara (GFA)', undefined], // not a code we know: kept as printed
    ])
  })
  it('keeps posted descriptions and choices separate from names, diet codes and price tiers', () => {
    const p = parsePrices('site: c\nvenue: cafe\nsource: email\nobserved: 2026-10-12\n---\n## Breakfast / lunch | snacks\nShakshuka (V) | £7.15 | £8.00 | | Tomato sauce, poached eggs and feta\nHerb Potato Rosti | £7.15 | | | Choose spinach and sumac, bacon, or beans and kale\nMain course | £4 | | main | Includes two sides')
    expect(p.items).toEqual([
      { section: 'Breakfast / lunch', services: ['snacks'], name: 'Shakshuka', tags: ['vegetarian'], price_gbp: 7.15, non_member_gbp: 8, description: 'Tomato sauce, poached eggs and feta' },
      { section: 'Breakfast / lunch', services: ['snacks'], name: 'Herb Potato Rosti', price_gbp: 7.15, description: 'Choose spinach and sumac, bacon, or beans and kale' },
      { section: 'Breakfast / lunch', services: ['snacks'], name: 'Main course', price_gbp: 4, course: 'main', description: 'Includes two sides' },
    ])
    expect(() => parsePrices('site: c\nvenue: cafe\nsource: s\nobserved: 2026-10-12\n---\nTea | 1 | | | Description | Extra')).toThrow(/expected/)
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

describe('parseGbp ranges', () => {
  it('reads a range as posted, and a single price as itself', () => {
    const p = parsePrices('site: h\nvenue: buttery\nsource: s\nobserved: 2026-01-01\n---\nSandwiches | £3.24-£3.96\nSalad bowl | £2.71\nVegetable side | £0.82–1.11')
    expect(p.items.map((i) => [i.price_gbp, i.price_max_gbp])).toEqual([[3.24, 3.96], [2.71, undefined], [0.82, 1.11]])
  })
})

describe('second tier only', () => {
  it('takes a line priced for the second tier alone, but not a line with no price', () => {
    const p = parsePrices("site: c\nvenue: hall\nsource: s\nobserved: 2026-10-09\n---\nStudent's first guest | | £21.00")
    expect(p.items).toEqual([{ section: undefined, name: "Student's first guest", non_member_gbp: 21 }])
    expect(() => parsePrices('site: c\nvenue: hall\nsource: s\nobserved: 2026-10-09\n---\nSoup | |')).toThrow(/expected/)
  })
})

describe('price columns', () => {
  const head = 'site: pembroke\nvenue: cafe-84\nsource: board\nobserved: 2026-10-13\n---\n'
  it('keeps N/A and TBC in the posted second column, including when saved lists are merged', () => {
    const p = parsePrices(head + 'columns: Price | Member Price\nCarlsberg (pint) | £3.70 | N/A\nSparkling Water | £0.80 | TBC')
    expect(p.items).toEqual([
      { name: 'Carlsberg (pint)', price_gbp: 3.7, non_member_text: 'N/A' },
      { name: 'Sparkling Water', price_gbp: 0.8, non_member_text: 'TBC' },
    ])
    expect(savedList(mergeList([], p))).toEqual(mergeList([], p))
    expect(unnamedColumns({ ...p, columns: undefined })).toMatch(/whose each is/)
    expect(() => parsePrices(head + 'Carlsberg | 3.70 | unknown')).toThrow(/not a price/)
  })
  it('reads whose each column is, in the body or the header', () => {
    expect(parsePrices(head + 'columns: Full price | SFC rate\nSingle espresso | £2.20 | £1.32').columns).toEqual(['Full price', 'SFC rate'])
    expect(parsePrices(head.replace('---', 'columns: Members | Non-members\n---') + 'Soup | £1.75 | £2.50').columns).toEqual(['Members', 'Non-members'])
    expect(parsePrices(head + 'Tea | £1.30').columns).toBeUndefined()
    expect(() => parsePrices(head + 'columns: A | B | C\nTea | £1')).toThrow(/columns/)
  })
  it('holds two prices a line that nothing names, unless the venue already names its columns', () => {
    const two = parsePrices(head + 'Single espresso | £2.20 | £1.32')
    expect(unnamedColumns(two)).toMatch(/whose each is/)
    expect(unnamedColumns(two, ['Full price', 'SFC rate'])).toBeNull()
    expect(unnamedColumns(parsePrices(head + 'columns: Full price | SFC rate\nSingle espresso | £2.20 | £1.32'))).toBeNull()
    expect(unnamedColumns(parsePrices(head + 'Tea | £1.30'))).toBeNull()
  })
  it('holds sizes given as columns: each size is its own item', () => {
    expect(unnamedColumns(parsePrices(head + 'columns: Single | Double\nEspresso | £2.20 | £2.60'))).toMatch(/size/)
    expect(unnamedColumns(parsePrices(head + 'columns: Members | Non-members\nEspresso | £2.20 | £2.60'))).toBeNull()
  })
})

describe('merging a member\'s list by section', () => {
  const list = (id: string, observed: string, body: string) => parsePrices(`site: lucy-cavendish\nvenue: cafe-bar\nsource: submission ${id}\nobserved: ${observed}\n---\n${body}`)
  const drinks = list('a', '2026-10-13', '## Coffee\nAmericano | 2.09\nLatte | 2.19\n## Teas\nAny tea | 1.65')
  const specials = list('b', '2026-10-13', '## Special Offers\nHot drink & cake | £3.65')
  const shape = (l: ReturnType<typeof mergeList>) => l.map((i) => `${i.section}: ${i.name} ${i.price_gbp} (${i.source})`)

  it('adds a board sent on its own after the sections already listed (Café Lucy\'s specials after its drinks)', () => {
    expect(shape(mergeList(mergeList([], drinks), specials))).toEqual([
      'Coffee: Americano 2.09 (submission a)',
      'Coffee: Latte 2.19 (submission a)',
      'Teas: Any tea 1.65 (submission a)',
      'Special Offers: Hot drink & cake 3.65 (submission b)',
    ])
  })
  it('replaces a section under the same heading, in any case, where it was; the others keep their source and day', () => {
    const merged = mergeList(mergeList([], drinks), list('c', '2026-11-02', '## COFFEE\nAmericano | 2.20'))
    expect(shape(merged)).toEqual(['COFFEE: Americano 2.2 (submission c)', 'Teas: Any tea 1.65 (submission a)'])
    expect(merged.map((l) => l.observed_on)).toEqual(['2026-11-02', '2026-10-13'])
  })
  it('takes lines under no heading as one section', () => {
    const plain = mergeList([], list('a', '2026-10-13', 'Tea | 1.50\n## Cakes\nBrownie | 2'))
    expect(shape(mergeList(plain, list('b', '2026-10-14', 'Tea | 1.60\nCoffee | 2')))).toEqual([
      'undefined: Tea 1.6 (submission b)',
      'undefined: Coffee 2 (submission b)',
      'Cakes: Brownie 2 (submission a)',
    ])
  })
  it('takes a section out when it is replaced with no lines (rejecting the list that added it)', () => {
    const merged = mergeList(mergeList([], drinks), specials)
    expect(shape(replaceSections(merged, new Set(['special offers']), []))).toEqual(shape(mergeList([], drinks)))
  })
  it('reads saved rows back in their order, without empty fields', () => {
    const rows = [
      { venue_id: 'v', position: 1, section: 'Teas', name: 'Any tea', description: null, price_gbp: 1.65, price_max_gbp: null, non_member_gbp: null, services: null, course: null, tags: [], observed_on: '2026-10-13', source: 'submission a' },
      { venue_id: 'v', position: 0, section: null, name: 'Soup (VE)', description: 'Leek', price_gbp: 1.75, price_max_gbp: null, non_member_gbp: 2.1, services: ['lunch'], course: 'soup', tags: ['vegan'], observed_on: '2026-10-12', source: 'noticeboard' },
    ]
    expect(savedList(rows)).toEqual([
      { name: 'Soup (VE)', description: 'Leek', price_gbp: 1.75, non_member_gbp: 2.1, services: ['lunch'], course: 'soup', tags: ['vegan'], observed_on: '2026-10-12', source: 'noticeboard' },
      { section: 'Teas', name: 'Any tea', price_gbp: 1.65, observed_on: '2026-10-13', source: 'submission a' },
    ])
  })
})
