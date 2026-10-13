import { describe, expect, it } from 'vitest'
import { partialString } from '../../supabase/functions/_shared/openai.ts'
import { mealNow, readableLines, servedMeals } from './reading.ts'
import type { Slot } from './types.ts'

describe('a reading as it arrives on the Send page', () => {
  it('turns lines into something to watch arriving', () => {
    expect(readableLines('2026-10-13 lunch | ! Moved upstairs\n## Mains\nRoast pork £3.60', 'menu')).toEqual([
      { kind: 'day', text: '2026-10-13 lunch', detail: 'Moved upstairs' },
      { kind: 'section', text: 'Mains' },
      { kind: 'item', text: 'Roast pork £3.60', detail: undefined },
    ])
    expect(readableLines('columns: Full price | SFC\nLatte | £3.30 | £1.98', 'prices')).toEqual([
      { kind: 'meta', text: 'Full price · SFC' },
      { kind: 'item', text: 'Latte', price: '£3.30 · £1.98', detail: undefined },
    ])
  })
})

describe('the meal a menu is for, by default', () => {
  const slots: Slot[] = [
    { meal: 'lunch', days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '12:00', end: '14:00', period: 'all' },
    { meal: 'dinner', days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '18:00', end: '19:30', period: 'all' },
  ]
  it('is the one being served or next, by the venue’s hours', () => {
    expect(mealNow({ slots }, { date: '2026-10-13', day: 'tue', minutes: 11 * 60 })).toBe('lunch')
    expect(mealNow({ slots }, { date: '2026-10-13', day: 'tue', minutes: 15 * 60 })).toBe('dinner')
    expect(mealNow({ slots }, { date: '2026-10-13', day: 'tue', minutes: 21 * 60 })).toBe('lunch')
    expect(mealNow({ slots: [{ meal: 'snacks', days: ['tue'], start: '08:00', end: '17:00', period: 'all' }] }, { date: '2026-10-13', day: 'tue', minutes: 7 * 60 })).toBe('lunch')
  })
  it('offers only the meals the venue serves', () => {
    expect(servedMeals({ slots })).toEqual(['lunch', 'dinner'])
    expect(servedMeals({ slots: [] })).toContain('brunch')
  })
})

describe('a model’s answer as it streams', () => {
  it('reads a string field out of JSON still being written', () => {
    expect(partialString('{"readable":true,"bo', 'body')).toBeUndefined()
    expect(partialString('{"readable":true,"body":"Latte | £3.25\\nTea | \\u00a3', 'body')).toBe('Latte | £3.25\nTea | £')
    expect(partialString('{"readable":true,"body":"A \\"quote\\"","unsure":""}', 'body')).toBe('A "quote"')
    expect(partialString('{"body":"half an escape \\', 'body')).toBe('half an escape ')
  })
})
