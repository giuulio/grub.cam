import { describe, expect, it } from 'vitest'
import { cleanName, tagsFromName } from './tags.ts'

describe('tagsFromName', () => {
  it('reads the codes colleges print after a dish', () => {
    expect(tagsFromName('Leek & potato soup (PB)')).toEqual({ name: 'Leek & potato soup', tags: ['plant_based', 'vegan', 'vegetarian'] })
    expect(tagsFromName('Scampi (GF, H)')).toEqual({ name: 'Scampi', tags: ['gluten_free', 'halal'] })
    expect(tagsFromName('Lentil dhal (vegan)').tags).toEqual(['vegan', 'vegetarian'])
  })
  it('leaves a note that is not only codes', () => {
    expect(tagsFromName('Fish tacos (GF available)')).toEqual({ name: 'Fish tacos (GF available)', tags: [] })
  })
})

describe('cleanName', () => {
  it('drops a note of the meals a dish is on', () => {
    expect(cleanName('Hash browns (Breakfast /Brunch)')).toBe('Hash browns')
    expect(cleanName('Baked Beans (Breakfast/Brunch)')).toBe('Baked Beans')
    expect(cleanName('Soup (lunch and dinner)')).toBe('Soup')
  })
  it('keeps any other note', () => {
    expect(cleanName('Porridge (oat milk available)')).toBe('Porridge (oat milk available)')
    expect(cleanName('Full English (breakfast plate)')).toBe('Full English (breakfast plate)')
  })
})
