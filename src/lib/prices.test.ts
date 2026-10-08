import { describe, expect, it } from 'vitest'
import { dishPrice, isFixedMenu, mealPrices, servedMeals } from './prices.ts'
import type { Slot, VenuePrice } from './types.ts'

const line = (name: string, price: number, more: Partial<VenuePrice> = {}): VenuePrice => ({ section: null, name, price_gbp: price, non_member_gbp: null, services: null, course: null, observed_on: '2026-10-08', ...more })
const list = [
  line('Main course', 3.75, { non_member_gbp: 5.65, services: ['lunch', 'dinner'], course: 'main' }),
  line('Soup', 1.75, { services: ['lunch', 'dinner'], course: 'soup' }),
  line('Crisps', 1.25, { services: ['lunch', 'dinner'] }),
  line('Bacon x 2', 0.95, { services: ['brunch'] }),
]

describe('mealPrices', () => {
  it('splits a meal’s lines into course prices and items sold', () => {
    const lunch = mealPrices(list, 'lunch')
    expect(Object.keys(lunch.course)).toEqual(['main', 'soup'])
    expect(lunch.items.map((p) => p.name)).toEqual(['Crisps'])
    expect(isFixedMenu(lunch)).toBe(false)
    expect(isFixedMenu(mealPrices(list, 'brunch'))).toBe(true)
    expect(mealPrices(list, 'formal')).toEqual({ course: {}, items: [] })
  })
})

describe('dishPrice', () => {
  const lunch = mealPrices(list, 'lunch')
  it('prefers the dish’s own price, else its course’s', () => {
    expect(dishPrice({ name: 'Pie', tags: [], course: 'main', price_gbp: 4 }, lunch)).toEqual({ gbp: 4, text: undefined })
    expect(dishPrice({ name: 'Pie', tags: [], course: 'main' }, lunch)).toEqual({ gbp: 3.75, nonMember: 5.65 })
    expect(dishPrice({ name: 'Cake', tags: [], course: 'dessert' }, lunch)).toBeUndefined()
    expect(dishPrice({ name: 'Duck', tags: [], course: 'main' }, mealPrices(list, 'formal'))).toBeUndefined()
  })
})

describe('servedMeals', () => {
  const slots: Slot[] = [
    { meal: 'lunch', days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '12:30', end: '13:30', period: 'all' },
    { meal: 'brunch', days: ['sat', 'sun'], start: '11:00', end: '13:30', period: 'all' },
  ]
  it('shows meals with dishes, and fixed menus on the days they are served', () => {
    expect(servedMeals([], slots, list, '2026-10-10')).toEqual(['brunch']) // Saturday
    expect(servedMeals([], slots, list, '2026-10-08')).toEqual([]) // Thursday: lunch is priced by course, so it needs dishes
    expect(servedMeals([{ date: '2026-10-08', service: 'lunch', items: [{ name: 'Pie', tags: [] }] }], slots, list, '2026-10-08')).toEqual(['lunch'])
  })
})
