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

it('shows an alert in red with its note, and an ordinary note quietly', () => {
  const slots = [{ meal: 'lunch' as const, days: ['tue' as const], start: '12:00', end: '14:00', period: 'all' as const }]
  const day = { date: '2026-10-13', service: 'lunch' as const, items: [{ name: 'Soup', tags: [] }], note: 'Served at the top table after a leak' }
  const alert = renderToStaticMarkup(<DayMenu date="2026-10-13" days={[{ ...day, alert: true }]} slots={slots} />)
  expect(alert).toContain('bg-alert-bg')
  expect(alert).toContain('Served at the top table after a leak')
  expect(alert).toContain('12:00–14:00')
  expect(renderToStaticMarkup(<DayMenu date="2026-10-13" days={[day]} slots={slots} />)).not.toContain('alert')
})
