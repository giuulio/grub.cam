import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
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

it('shows a meal posted elsewhere with its usual hours, its note, and a link to send a photo of it', () => {
  const day = { date: '2026-10-16', service: 'dinner' as const, items: [], note: 'European Night, see posters for details' }
  const slots = [{ meal: 'dinner' as const, days: ['fri' as const], start: '17:45', end: '19:00', period: 'all' as const }]
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <DayMenu date="2026-10-16" days={[day]} slots={slots} send={(meal) => `/send?venue=sidney-sussex%2Fservery-dining-hall&kind=menu&date=2026-10-16&meal=${meal}`} />
    </MemoryRouter>,
  )
  expect(html).toContain('17:45–19:00')
  expect(html).toContain('European Night, see posters for details')
  expect(html).not.toContain('Not served')
  expect(html).toContain('meal=dinner')
  // Without a link (a prerendered page, a past date), the note alone
  expect(renderToStaticMarkup(<DayMenu date="2026-10-16" days={[day]} slots={slots} />)).not.toContain('Send a photo')
})

it("shows a dish's allergens under it, what it may contain after", () => {
  const day = { date: '2026-10-14', service: 'dinner' as const, items: [{ name: 'Tuscan pulled pork ragu', tags: [], allergens: ['celery', 'gluten (wheat)', 'may contain nuts'] }, { name: 'Roast of the day', tags: [] }] }
  const html = renderToStaticMarkup(<DayMenu date="2026-10-14" days={[day]} slots={[]} />)
  expect(html).toContain('Contains celery, gluten (wheat) · may contain nuts')
  expect(html.match(/Contains/g)).toHaveLength(1)
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
