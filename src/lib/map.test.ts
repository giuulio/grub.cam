import { describe, expect, it } from 'vitest'
import { directions } from './map.ts'

describe('directions', () => {
  it('walks to the point from wherever you are, in Apple Maps and Google Maps', () => {
    expect(directions({ latitude: 52.2053, longitude: 0.1152 })).toEqual({
      apple: 'https://maps.apple.com/?daddr=52.2053,0.1152&dirflg=w',
      google: 'https://www.google.com/maps/dir/?api=1&destination=52.2053,0.1152&travelmode=walking',
    })
  })
})
