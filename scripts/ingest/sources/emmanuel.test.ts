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
  it('reads a serving time that starts before noon and ends after it, with one am/pm', () => {
    const at = (h1: string, serving: string) => emmanuelMenu(`<main><p>Wednesday, 4 November 2026</p><div><h1>${h1}</h1><span>Serving ${serving}</span></div><div class="grid"><section><h2>Main</h2><ul><li><p><span>Chilli</span><span>£3.00</span></p></li></ul></section></div></main>`)[0].note
    expect(at('Lunch', '11:45 – 1:30 pm')).toBe('Lunch 11:45–13:30')
    expect(at('Lunch', '12:00 – 1:30 pm')).toBe('Lunch 12:00–13:30')
    expect(at('Evening Servery', '5:45 – 7:00 pm')).toBe('Dinner 17:45–19:00')
    expect(at('Breakfast', '8:00 – 9:30 am')).toBe('Breakfast 08:00–09:30')
  })
  it('omits an empty display but refuses dishes without a source date', () => {
    expect(emmanuelMenu('<main><h1>Menus will be available before service</h1></main>')).toEqual([])
    expect(() => emmanuelMenu(html.replaceAll('4 November 2026', 'November'))).toThrow(/date and meal/)
  })
})
