import { describe, expect, it } from 'vitest'
import { cleanName } from './tags.ts'

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
