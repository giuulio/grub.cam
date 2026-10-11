import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseServery, type Servery } from './peterhouse.ts'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/peterhouse-servery.json', import.meta.url), 'utf8')) as Servery
const week = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']

describe('peterhouse servery.json', () => {
  it('a weekday has breakfast, lunch (soup, mains, potato, sides, salad bar, desserts) and dinner', () => {
    const friday = parseServery(fixture, week).filter((d) => d.date === '2026-10-16')
    expect(friday.map((d) => d.service)).toEqual(['breakfast', 'lunch', 'dinner'])
    const lunch = friday[1]
    expect(lunch.items.filter((i) => i.course === 'main').map((i) => i.name)).toEqual([
      'Vegetable spring roll Sweet & sour vegetables',
      'Texan beef and bean chilli Tortilla chips',
      'Scampi Seaweed and lemon tartar sauce',
      'Jacket potato',
    ])
    expect(lunch.items[0]).toEqual({ name: 'Cream of parsnip', tags: ['vegetarian'], course: 'soup' })
    expect(lunch.items.some((i) => i.course === 'side')).toBe(true)
    expect(lunch.items.filter((i) => i.course === 'dessert')).toHaveLength(3)
    expect(friday[2].items.filter((i) => i.course === 'main')).toHaveLength(3)
  })

  it('Saturday is the published brunch (specials first), not the salad bar and desserts', () => {
    const saturday = parseServery(fixture, week).filter((d) => d.date === '2026-10-17')
    expect(saturday.map((d) => d.service)).toEqual(['brunch', 'dinner'])
    const brunch = saturday[0]
    expect(brunch.items).toHaveLength(25)
    expect(brunch.items[0]).toEqual({ name: 'Smashed avocado on sourdough with roasted pepper salsa', tags: ['vegan', 'vegetarian'], course: 'main' })
    expect(brunch.items[1]).toEqual({ name: 'Mushrooms', tags: ['vegan', 'vegetarian'], course: 'other' })
    expect(brunch.items.some((i) => /jaffa|side salad/i.test(i.name))).toBe(false)
  })

  it('Sunday has dinner only: no lunch is made out of the salad bar and desserts', () => {
    const sunday = parseServery(fixture, week).filter((d) => d.date === '2026-10-18')
    expect(sunday.map((d) => d.service)).toEqual(['dinner'])
    expect(sunday[0].items.filter((i) => i.course === 'main').map((i) => i.name)).toEqual([
      "Roast seitan smokey ‘pork' Mustard gravy",
      'Ravioli Basil pesto, roasted peppers, parmesan',
      'Roast beef Horseradish sauce',
    ])
  })

  it('only the requested week', () => {
    expect(parseServery(fixture, ['2026-10-19'])).toEqual([])
  })
})
