import { describe, expect, it } from 'vitest'
import { list, placed } from './summary.ts'
import type { Site } from './types.ts'

const emma: Site = { slug: 'emmanuel', name: 'Emmanuel', short_name: null, kind: 'college', official_dining_url: null, aliases: ['Emma'] }
const sidgwick: Site = { slug: 'sidgwick', name: 'Sidgwick Site', short_name: null, kind: 'university', official_dining_url: null }

describe('summary', () => {
  it('joins a list without breaking an item that has commas of its own', () => {
    expect(list(['Mon, Wed 18:00', 'Tue, Fri 17:30'])).toBe('Mon, Wed 18:00 and Tue, Fri 17:30')
    expect(list(['a', 'b', 'c'])).toBe('a, b and c')
    expect(list([])).toBe('')
  })

  it('places a college with its other name and a University site with “the”', () => {
    expect(placed(emma)).toBe('Emmanuel College (Emma), Cambridge')
    expect(placed(sidgwick)).toBe('the Sidgwick Site, University of Cambridge')
  })
})
