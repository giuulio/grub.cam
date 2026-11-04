import { describe, expect, it } from 'vitest'
import { allergenFromLabel, allergensFromLabels, allergensFromName, cleanName, explicitDietTags, tagsFromName } from './tags.ts'
import { MenuDay } from '../../schema.ts'

describe('explicit dish labels', () => {
  it('reads whole-dish wording through the shared ingest schema', () => {
    const day = MenuDay.parse({ date: '2026-11-04', service: 'lunch', items: [
      { name: 'Vegan chilli', tags: ['halal'] }, { name: 'Plant-Based Burrito' },
      { name: 'Apple, pear and anise crumble, vegan version' },
    ] })
    expect(day.items.map((i) => i.tags)).toEqual([
      ['halal', 'vegan', 'vegetarian'], ['plant_based', 'vegan', 'vegetarian'], ['vegan', 'vegetarian'],
    ])
  })
  it('leaves mixed choices, ingredient claims and conflicting allergens for review', () => {
    for (const name of ['Brunch: bacon, eggs, vegan sausages', 'Pie night: vegan & vegetarian options available',
      'Chicken with vegan mayonnaise', 'Green lentil ragù with vegan cheese', 'Vegan sausage, fried eggs', 'Vegan sausage and bacon', 'Not vegan', 'Veggie Vegan']) {
      expect(explicitDietTags(name)).toEqual([])
    }
    expect(explicitDietTags('Vegan pudding', [], ['milk'])).toEqual([])
    expect(tagsFromName('Pudding (not vegan)').tags).toEqual([])
    expect(explicitDietTags('Vegan pudding', [], ['may contain milk'])).toEqual(['vegan', 'vegetarian'])
  })
})

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

describe('allergens', () => {
  it('names each of the 14 the same way whatever the source calls it, keeping its detail', () => {
    expect(['Sulphur Dioxide', 'Sulphur dioxide/sulphites', 'Egg', 'Sesame seeds', 'Cereals with gluten (wheat)', 'Gluten: Wheat', 'Wheat', 'Nuts (walnuts)', 'Molluscs'].map((l) => allergenFromLabel(l)))
      .toEqual(['sulphites', 'sulphites', 'eggs', 'sesame', 'gluten (wheat)', 'gluten (wheat)', 'gluten (wheat)', 'nuts (walnuts)', 'molluscs'])
    expect(allergenFromLabel('May contain: Nuts')).toBe('may contain nuts')
    expect(allergenFromLabel('Vegetarian')).toBeUndefined()
  })
  it("a source's own list: one allergen's details together, what it may contain after, a label we don't know kept", () => {
    expect(allergensFromLabels(['Gluten', 'Gluten: Wheat', 'may contain Nuts', 'Milk', 'may contain Gluten', 'Alcohol', 'None'])).toEqual(['gluten (wheat)', 'milk', 'alcohol', 'may contain nuts'])
    expect(allergensFromLabels(['Vegetarian', 'Celery'], false)).toEqual(['celery'])
  })
  it('reads them from brackets printed with a dish, and only brackets wholly of them', () => {
    expect(allergensFromName('Salmon pasta bake, paprika cheese crust (gluten, fish, milk)')).toEqual({ name: 'Salmon pasta bake, paprika cheese crust', allergens: ['gluten', 'fish', 'milk'] })
    expect(allergensFromName('Vegan meatball, buckwheat and harissa stew (Ve) (soya)')).toEqual({ name: 'Vegan meatball, buckwheat and harissa stew (Ve)', allergens: ['soya'] })
    expect(allergensFromName('Loaf (contains: gluten (wheat, barley), nuts (walnuts); may contain sesame)').allergens).toEqual([])
    expect(allergensFromName('Flapjack (oats, may contain nuts)')).toEqual({ name: 'Flapjack', allergens: ['gluten (oats)', 'may contain nuts'] })
    expect(allergensFromName('Fish (cod or haddock)')).toEqual({ name: 'Fish (cod or haddock)', allergens: [] })
    expect(allergensFromName('Toast (gluten free)')).toEqual({ name: 'Toast (gluten free)', allergens: [] })
  })
})
