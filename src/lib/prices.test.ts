import { describe, expect, it } from 'vitest'
import { dishPrice, formatPrice, priceHeads, mealPrices, postedOn, priceGroups } from './prices.ts'
import type { VenuePrice } from './types.ts'

const line = (name: string, price: number, more: Partial<VenuePrice> = {}): VenuePrice => ({ section: null, name, price_gbp: price, non_member_gbp: null, services: null, course: null, tags: [], observed_on: '2026-10-08', source: 'noticeboard', ...more })
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
    expect(mealPrices(list, 'formal')).toEqual({ course: {}, items: [] })
  })
})

describe('dishPrice', () => {
  const lunch = mealPrices(list, 'lunch')
  it('prefers the dish’s own price, else its course’s', () => {
    expect(dishPrice({ name: 'Pie', tags: [], course: 'main', price_gbp: 4 }, lunch)).toEqual({ gbp: 4, second: undefined, text: undefined })
    expect(dishPrice({ name: 'Pie', tags: [], course: 'main', price_gbp: 3.41, price2_gbp: 4.46 }, lunch)).toEqual({ gbp: 3.41, second: 4.46, text: undefined })
    expect(dishPrice({ name: 'Pie', tags: [], course: 'main' }, lunch)).toEqual({ gbp: 3.75, max: undefined, second: 5.65 })
    expect(dishPrice({ name: 'Cake', tags: [], course: 'dessert' }, lunch)).toBeUndefined()
    expect(dishPrice({ name: 'Duck', tags: [], course: 'main' }, mealPrices(list, 'formal'))).toBeUndefined()
  })
})

describe('priceGroups', () => {
  const names = (g: VenuePrice[] | undefined) => g?.map((p) => p.name)
  it('puts a line where it is sold: at meals, the café or the bar', () => {
    const cafeBar = [line('Latte', 3.1, { services: ['snacks'] }), line('Pint', 4.5, { services: ['bar'] }), line('Crisps', 1)]
    expect(priceGroups(cafeBar, ['cafe', 'bar'])).toEqual({ cafe: [cafeBar[0], cafeBar[2]], bar: [cafeBar[1]] })
    // A bar first: lines for every meal are its drinks list
    expect(names(priceGroups(cafeBar, ['bar', 'cafe']).bar)).toEqual(['Pint', 'Crisps'])
    expect(names(priceGroups(list, ['hall']).hall)).toEqual(['Main course', 'Soup', 'Crisps', 'Bacon x 2'])
  })
  it('lists a Dining venue’s all-day list under its café, and a section it lacks under its own type', () => {
    const cavendish = [line('Croissant', 3.5), line('Hot lunch', 6, { services: ['lunch'] })]
    expect(priceGroups(cavendish, ['hall', 'cafe'])).toEqual({ cafe: [cavendish[0]], hall: [cavendish[1]] })
    expect(priceGroups([line('Pint', 4.5, { services: ['bar'] })], ['cafe'])).toEqual({ cafe: [line('Pint', 4.5, { services: ['bar'] })] })
    expect(priceGroups(undefined, ['bar'])).toEqual({})
  })
})

describe('postedOn', () => {
  it('is the latest date a line was seen', () => {
    expect(postedOn([line('A', 1), line('B', 1, { observed_on: '2026-10-09' })])).toBe('2026-10-09')
    expect(postedOn([])).toBeUndefined()
  })
})

describe('priceHeads', () => {
  it("heads price columns the venue's way, else members and others", () => {
    expect(priceHeads(2, { tiers: ['Senior', 'Student'] })).toEqual(['Senior', 'Student'])
    expect(priceHeads(2, null)).toEqual(['Members', 'Others'])
    expect(priceHeads(1, { tiers: ['Students and staff'] })).toEqual(['Students and staff'])
    expect(priceHeads(1, { note: 'Students get 25% off' })).toEqual([])
  })
})

describe('formatPrice', () => {
  it('shows a range as posted', () => {
    expect(formatPrice({ gbp: 3.24, max: 3.96 })).toBe('£3.24–£3.96')
    expect(formatPrice({ gbp: 0.95 })).toBe('£0.95')
    expect(formatPrice({ text: 'market price' })).toBe('market price')
  })
})
