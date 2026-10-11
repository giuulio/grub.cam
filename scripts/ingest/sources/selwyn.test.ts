import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseSelwynDay } from './selwyn.ts'

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), 'utf8')

describe('selwyn hall menu', () => {
  it('a weekday: numbered mains, then one line of sides', () => {
    const days = parseSelwynDay(fixture('selwyn-2026-10-13'), '2026-10-13')
    expect(days.map((d) => d.service)).toEqual(['lunch', 'dinner'])
    const lunch = days[0]
    expect(lunch.items.filter((i) => i.course === 'main').map((i) => i.name)).toEqual([
      'Vegan tofu pad Thai with rice noodles',
      'Hungarian chicken paprikash with dumplings',
      'Braised pork rib eye steaks with root vegetables',
      'Cauliflower butter bean and parmesan bake',
    ])
    expect(lunch.items.filter((i) => i.course === 'side').map((i) => i.name)).toEqual(['Steamed jasmine rice', 'Chips', 'Mashed potatoes', 'Green beans', 'Carrots'])
    expect(days[1].items.filter((i) => i.course === 'main')).toHaveLength(3)
  })

  it('a Saturday: the "Lunch" block is brunch, its hours are not a dish, and the special is one dish', () => {
    const days = parseSelwynDay(fixture('selwyn-2026-10-17'), '2026-10-17')
    expect(days.map((d) => d.service)).toEqual(['brunch', 'dinner'])
    const brunch = days[0]
    expect(brunch.items.some((i) => /11\.00|1\.00pm/.test(i.name))).toBe(false)
    expect(brunch.items.filter((i) => i.course === 'other').map((i) => i.name)).toEqual([
      'Sausages',
      'Bacon',
      'Fried eggs',
      'Hash browns',
      'Mushrooms',
      'Baked beans',
      'Tomatoes',
      'Croissants',
      'Rolls',
      'Vegan Danish pastries',
      'Veggie sausages',
      'Vegan bacon',
      'Halal sausages',
      'Waffles',
    ])
    expect(brunch.items.filter((i) => i.course === 'main')).toEqual([{ name: 'Potato hash with fried onions, red peppers, sun-dried tomatoes and two fried eggs', tags: [], course: 'main' }])
    expect(days[1].items.map((i) => [i.course, i.name, i.tags])).toEqual([
      ['main', 'Pork and leek sausage rings with onion gravy', []],
      ['main', 'Red Thai coconut chicken curry', ['halal']],
      ['main', 'Tofu and coconut vegetable yellow Thai curry', ['vegan', 'vegetarian']],
      ['side', 'Herby potato wedges', []],
      ['side', 'Rice', []],
      ['side', 'Sweetcorn', []],
      ['side', 'Carrots', []],
    ])
  })

  it('nothing when the page shows another day', () => {
    expect(parseSelwynDay(fixture('selwyn-2026-10-17'), '2026-10-18')).toEqual([])
  })
})
