import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { DayMenu } from './DayMenu.tsx'

it('shows a cancelled meal as a notice without its usual hours or fixed price list', () => {
  const html = renderToStaticMarkup(<DayMenu
    date="2026-10-13"
    days={[{ date: '2026-10-13', service: 'dinner', items: [], note: 'No dinner – UG freshers formal hall' }]}
    slots={[{ meal: 'dinner', days: ['tue'], start: '17:30', end: '19:30', period: 'all' }]}
    prices={[{ name: 'Main course', section: null, price_gbp: 5, non_member_gbp: null, services: ['dinner'], course: 'meal', tags: [], observed_on: '2026-10-12', source: 'board' }]}
  />)
  expect(html).toContain('Not served')
  expect(html).toContain('No dinner – UG freshers formal hall')
  expect(html).not.toContain('17:30')
  expect(html).not.toContain('£5')
})
