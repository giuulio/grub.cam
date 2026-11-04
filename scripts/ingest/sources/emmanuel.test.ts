import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { emmanuelMenu } from './emmanuel.ts'

const html = readFileSync(new URL('./fixtures/emmanuel.html', import.meta.url), 'utf8')
describe('Emmanuel public display', () => {
  it('trusts the published date and meal, reads each responsive dish once and preserves prices/allergens', () => {
    const [day] = emmanuelMenu(html)
    expect(day.date).toBe('2026-11-04')
    expect(day.service).toBe('dinner')
    expect(day.note).toBe('Dinner 17:45–19:00')
    expect(day.items.filter((i) => i.name === 'Beef Bourguignon with mash potato')).toHaveLength(1)
    expect(day.items[0]).toMatchObject({ name: 'Beef Bourguignon with mash potato', course: 'main', price_gbp: 5.45, allergens: ['celery', 'milk', 'sulphites'] })
    expect(day.items.find((i) => i.name === 'Vegetarian Bolognaise')?.tags).toEqual(['vegetarian'])
  })
  it('omits an empty display but refuses dishes without a source date', () => {
    expect(emmanuelMenu('<main><h1>Menus will be available before service</h1></main>')).toEqual([])
    expect(() => emmanuelMenu(html.replaceAll('4 November 2026', 'November'))).toThrow(/date and meal/)
  })
})
