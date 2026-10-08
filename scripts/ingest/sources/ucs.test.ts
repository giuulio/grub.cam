import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseUcsMenu, splitSides, weekCommencing } from './ucs.ts'

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), 'utf8')

describe('ucs weekly menus', () => {
  it('reads the week from the heading', () => {
    expect(weekCommencing('Week commencing 5th October 2026')).toBe('2026-10-05')
    expect(weekCommencing('Week commencing 1 June 2027')).toBe('2027-06-01')
    expect(weekCommencing('This week’s menu')).toBeUndefined()
  })

  it('splits sides only before a capital', () => {
    expect(splitSides('Rainbow slaw, Sweet potato fries with lime sriracha & lime yoghurt & Harissa roasted carrots with maple, lime & tahini sauce')).toEqual([
      'Rainbow slaw',
      'Sweet potato fries with lime sriracha & lime yoghurt',
      'Harissa roasted carrots with maple, lime & tahini sauce',
    ])
    expect(splitSides('Corn & black bean salad & Mexican rice')).toEqual(['Corn & black bean salad', 'Mexican rice'])
  })

  it('parses the West Hub Canteen page: Mon–Fri lunch, four mains a day, nothing from the hours below', () => {
    const days = parseUcsMenu(fixture('ucs-west-hub-canteen'))
    expect(days.map((d) => d.date)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'])
    expect(days.every((d) => d.service === 'lunch' && d.items.length === 4 && d.items.every((i) => i.course === 'main'))).toBe(true)
    expect(days[0].items[0].name).toBe('Sri Lankan lentil & potato curry, mint sambolmini, naan')
    expect(days[4].items.at(-1)?.name).toBe('Battered cod, lemon homemade tartare sauce')
  })

  it('parses mains and sides on Greenwich House and Scholars Brew, including dishes wrapped in <p>', () => {
    const greenwich = parseUcsMenu(fixture('ucs-greenwich-house-cafe'))
    expect(greenwich).toHaveLength(5)
    expect(greenwich[0].items.map((i) => [i.course, i.name])).toEqual([
      ['main', 'Spinach, three cheese cannelloni with a garlic topping'],
      ['main', 'chicken fajitas, soured cream, guacamole, salsa, cheese'],
      ['side', 'Rainbow slaw'],
      ['side', 'Sweet potato fries with lime sriracha & lime yoghurt'],
      ['side', 'Harissa roasted carrots with maple, lime & tahini sauce'],
    ])
    const scholars = parseUcsMenu(fixture('ucs-scholars-brew'))
    expect(scholars.map((d) => d.date).at(-1)).toBe('2026-10-09')
    expect(scholars[2].items.map((i) => i.name)).toEqual(['Vegetable samosa, mint raita', 'Chicken tikka quarter, crushed poppadom topping & raita', 'Blacked eyed pea salad', 'Bombay potatoes'])
  })
})
