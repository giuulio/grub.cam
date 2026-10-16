import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { PriceList } from './MenuRows.tsx'
import type { VenuePrice } from '../lib/types.ts'

it('shows posted N/A and TBC values in the second price column even without a second numeric price', () => {
  const lines: VenuePrice[] = ['N/A', 'TBC'].map((text, i) => ({
    section: null, name: i ? 'Sparkling Water' : 'Carlsberg (pint)', price_gbp: i ? 0.8 : 3.7,
    non_member_gbp: null, non_member_text: text as 'N/A' | 'TBC', services: null, course: null,
    tags: [], observed_on: '2026-10-14', source: 'price list',
  }))
  lines.push({ ...lines[0], name: 'Unlabelled member price', non_member_text: null })
  const html = renderToStaticMarkup(<PriceList lines={lines} terms={{ tiers: ['Price', 'Member Price'] }} />)
  expect(html).toContain('Member Price')
  expect(html).toMatch(/tabular-nums text-muted">N\/A<\/span>/)
  expect(html).toMatch(/tabular-nums text-muted">TBC<\/span>/)
  expect(html).toMatch(/tabular-nums text-muted"><\/span>/)
  expect(html).not.toContain('Member price:')
})

it("heads only the sections priced in two columns, as Christ's Buttery posts its bar and food lists", () => {
  const line = (section: string, name: string, price: number, second: number | null): VenuePrice => ({
    section, name, price_gbp: price, non_member_gbp: second, non_member_text: null, services: null, course: null,
    tags: [], observed_on: '2026-10-15', source: 'Buttery',
  })
  const html = renderToStaticMarkup(
    <PriceList lines={[line('Draught Beers & Ciders', 'Stella (Pint)', 4.3, 5.2), line('Hot Food', 'Sausage Roll', 2, null)]} terms={{ tiers: ['Member', 'Non-Member'] }} narrow />,
  )
  expect(html.match(/>Non-Member</g)).toHaveLength(1)
  const food = html.slice(html.indexOf('Hot Food'))
  expect(food).not.toContain('Member')
  expect(food.match(/tabular-nums/g)).toHaveLength(1)
  // The café's section alone, split from the bar's: its one column isn't the members'
  const cafe = renderToStaticMarkup(<PriceList lines={[line('Hot Food', 'Sausage Roll', 2, null)]} terms={{ tiers: ['Member', 'Non-Member'] }} />)
  expect(cafe).not.toContain('Member')
})
