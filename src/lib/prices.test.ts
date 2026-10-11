import { describe, expect, it } from 'vitest'
import { dishPrice, formatPrice, headlinePrices, priceHeads, mealPrices, postedOn, priceGroups } from './prices.ts'
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

describe('headlinePrices', () => {
  const names = (lines: VenuePrice[], type: 'hall' | 'cafe' | 'bar') => headlinePrices(lines, type).map((p) => p.name)
  it('leads a café with an espresso, a second coffee and a tea, as posted', () => {
    // Occidente: the cocktail and the extra shot are not the coffee
    const occidente = [line('Espresso Martini', 12, { section: 'Dessert cocktails' }), line('Espresso', 1.95, { section: 'Hot drinks' }), line('Double espresso', 2.35, { section: 'Hot drinks' }), line('Chai latte', 3.5, { section: 'Hot drinks' }), line('Latte', 3.4, { section: 'Hot drinks' }), line('Tea pot', 3, { section: 'Hot drinks' })]
    expect(names(occidente, 'cafe')).toEqual(['Espresso', 'Latte', 'Tea pot'])
    // Caffiend: "Espresso, single" before "Espresso, double"; the tea is named by its section
    const caffiend = [line('Espresso, single', 2.3, { section: 'Coffee' }), line('Espresso, double', 2.9, { section: 'Coffee' }), line('Flat white, single', 2.9, { section: 'Coffee' }), line('English breakfast', 2, { section: 'Tea' }), line('Extra shot of espresso', 0.6, { section: 'Extras' })]
    expect(names(caffiend, 'cafe')).toEqual(['Espresso, single', 'Flat white, single', 'English breakfast'])
  })
  it('fills in with the first lines posted when the usual orders are missing', () => {
    const homerton = [line('Sandwiches', 3.24, { price_max_gbp: 3.96 }), line('Hot paninis and wraps', 4.14), line('Cold drinks', 0.9, { price_max_gbp: 2.7 }), line('Hot drinks', 1.5, { price_max_gbp: 2.33 }), line('Cakes', 2.14, { price_max_gbp: 2.61 })]
    expect(names(homerton, 'cafe')).toEqual(['Hot drinks', 'Sandwiches', 'Hot paninis and wraps'])
    expect(names([], 'cafe')).toEqual([])
  })
  it('leads a bar with a pint, a glass of wine and a spirit', () => {
    const sidney = [line('Carlsberg (pint)', 2.2, { section: 'Draught' }), line('Carlsberg (half)', 1.1, { section: 'Draught' }), line('Corona (pint)', 3, { section: 'Draught' }), line('White Rum', 1.9, { section: 'Optic Spirits (Single, 25ml)' }), line("Stone's Ginger Wine", 0.8, { section: 'Other Spirits (Single, 25ml)' }), line('White (125ml)', 1.95, { section: 'Wine & Port' }), line('Prosecco (Bottle)', 12, { section: 'Wine & Port' })]
    expect(names(sidney, 'bar')).toEqual(['Carlsberg (pint)', 'White (125ml)', 'White Rum'])
    const kettles = [line("Pimm's, glass", 8.5, { section: 'Beer, wine & cocktails' }), line('White wine, 187ml', 7, { section: 'Beer, wine & cocktails' }), line('Local beers, 440ml', 6.5, { section: 'Beer, wine & cocktails' })]
    expect(names(kettles, 'bar')).toEqual(['Local beers, 440ml', 'White wine, 187ml', "Pimm's, glass"])
  })
  it('leads a Dining venue with its main course, set meal and soup, and skips a line priced only for the second tier', () => {
    const robinson = [line('Meat or fish meal deal: a main, two sides and the dessert of the day', 6.6), line('Vegetarian meal deal: a main, two sides and the dessert of the day', 6.3), line('Meat or fish main course', 3.78), line('Soup of the day', 1.16), line('Hot and cold desserts', 1.16)]
    expect(names(robinson, 'hall')).toEqual(['Meat or fish main course', 'Meat or fish meal deal: a main, two sides and the dessert of the day', 'Soup of the day'])
    const clare = [line('3 course lunch or supper', 15.25, { non_member_gbp: 7.9 }), { ...line('Guest main', 0, { course: 'main' }), price_gbp: null, non_member_gbp: 21 }, line('Main course', 10.75, { course: 'main' }), line('Soup', 3.8, { course: 'soup' })]
    expect(names(clare, 'hall')).toEqual(['Main course', '3 course lunch or supper', 'Soup'])
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
