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
