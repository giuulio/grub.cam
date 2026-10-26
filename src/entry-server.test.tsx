import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parse } from 'node-html-parser'
import { render } from './entry-server.tsx'
import type { Data } from './lib/data.tsx'
import type { Venue } from './lib/types.ts'

// Render only: no database or account requests. Keep these tests independent of a developer's .env.
vi.hoisted(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-publishable-key')
})

const site = { slug: 'st-edmunds', name: "St Edmund's", kind: 'college' as const, short_name: null, official_dining_url: null, aliases: ['Eddies'] }
const venue: Venue = {
  id: 'st-edmunds/dining-hall', slug: 'dining-hall', name: 'Dining Hall', site,
  type: 'hall', url: null, where: null, serves: null, dietary: { tags: [] },
  slots: [{ meal: 'lunch', days: ['mon'], start: '12:30', end: '13:30', period: 'all' }],
  menu: [{ date: '2026-10-26', service: 'lunch', items: [{ name: 'Vegetable pie', tags: ['vegan'] }] }],
}
const data: Data = { sites: [site], venues: [venue], menuFrom: '2026-10-26', menuTo: '2026-11-02' }

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-26T12:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('searchable HTML without JavaScript', () => {
  it('identifies Eddies and its dining hall beside the menu and hours', () => {
    const page = render('/st-edmunds/dining-hall', data)
    const main = parse(page.html).querySelector('main')!
    expect(page.title).toContain("St Edmund's College (Eddies), Cambridge")
    expect(main.text).toContain("Dining Hall at St Edmund's College (Eddies), Cambridge")
    expect(main.text).toContain('Vegetable pie')
    expect(main.text).toContain('12:30–13:30')
    expect(main.querySelector('a[href="/st-edmunds"]')).not.toBeNull()
  })

  it('exposes venue aliases in visible text and keeps a college alias on its own page', () => {
    const cafe = { ...venue, name: 'Caffiend of Cambridge', aliases: ['WGB Café', 'Computer Laboratory Café'] }
    const main = parse(render('/st-edmunds/dining-hall', { ...data, venues: [cafe] }).html).querySelector('main')!
    expect(main.text).toContain('Also listed as WGB Café or Computer Laboratory Café.')
    expect(parse(render('/st-edmunds', data).html).querySelector('main')!.text).toContain('Also known as Eddies.')
  })

  it('renders the food-map explanation, category links and venues beyond the first browser page', () => {
    const venues = Array.from({ length: 30 }, (_, i) => ({ ...venue, id: `${site.slug}/hall-${i}`, slug: `hall-${i}`, name: `Hall ${i}` }))
    const page = parse(render('/', { ...data, venues }).html)
    expect(page.querySelector('h1')!.text).toBe('Cambridge food map')
    expect(page.querySelector('main')!.text).toContain('college and University food map')
    for (const path of ['/dining', '/cafes', '/bars', '/formal', '/st-edmunds/hall-29']) {
      expect(page.querySelector(`a[href="${path}"]`), path).not.toBeNull()
    }
    expect(parse(render('/dining', data).html).querySelector('h1')!.text).toBe('Cambridge college menus')
  })
})
