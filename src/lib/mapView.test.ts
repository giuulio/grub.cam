import { describe, expect, it } from 'vitest'
import { pickToken, pinLabel, placeLabels, tokenOrigin, zoomFor } from './mapView.ts'

const jwt = (claims: object) => `header.${btoa(JSON.stringify(claims)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.signature`
const apex = jwt({ iss: 'TEAM', origin: 'grub.cam', scope: 'mapkit_js' })
const www = jwt({ iss: 'TEAM', origin: 'www.grub.cam', scope: 'mapkit_js' })
const open = jwt({ iss: 'TEAM', scope: 'mapkit_js' })

describe('MapKit tokens', () => {
  it('reads the domain a token was made for', () => {
    expect(tokenOrigin(apex)).toBe('grub.cam')
    expect(tokenOrigin(jwt({ origin: 'https://grub.cam:443' }))).toBe('grub.cam')
    expect(tokenOrigin(open)).toBeUndefined()
    expect(tokenOrigin('not a token')).toBeUndefined()
  })
  it('picks the token for the page’s domain, else an unrestricted one, else none', () => {
    expect(pickToken([apex, www], 'www.grub.cam')).toBe(www)
    expect(pickToken([apex, www], 'grub.cam')).toBe(apex)
    expect(pickToken([apex, www, open], 'localhost')).toBe(open)
    expect(pickToken([apex, www], 'localhost')).toBeUndefined()
  })
})

describe('pin names', () => {
  const site = { name: 'Pembroke', short_name: null }
  it('puts the college first where the name alone says nothing', () => {
    expect(pinLabel({ name: 'Hall', site })).toBe('Pembroke · Hall')
    expect(pinLabel({ name: 'Servery ("Trough")', site })).toBe('Servery ("Trough")')
    expect(pinLabel({ name: 'Coffee Shop and Bar', site: { name: 'Fitzwilliam', short_name: 'Fitz' } })).toBe('Fitz · Coffee Shop and Bar')
    expect(pinLabel({ name: 'Fiona’s', site })).toBe('Fiona’s')
  })
  it('places names right, else left, never over a pin or another name, and only inside the map', () => {
    const map = { width: 400, height: 300 }
    expect(placeLabels([{ id: 'a', x: 100, y: 100, width: 60 }], map)).toEqual(new Map([['a', 'right']]))
    // A pin just right of a: a's name goes left; b's to its right
    expect(placeLabels([{ id: 'a', x: 100, y: 100, width: 60 }, { id: 'b', x: 140, y: 100, width: 60 }], map)).toEqual(new Map([['a', 'left'], ['b', 'right']]))
    // Hemmed in on both sides: no name
    const three = placeLabels([{ id: 'm', x: 100, y: 100, width: 60 }, { id: 'l', x: 70, y: 100, width: 10 }, { id: 'r', x: 130, y: 100, width: 10 }], map)
    expect(three.has('m')).toBe(false)
    // At the right edge it goes left; off the map, none
    expect(placeLabels([{ id: 'e', x: 380, y: 50, width: 60 }], map).get('e')).toBe('left')
    expect(placeLabels([{ id: 'o', x: -5, y: 50, width: 60 }], map).size).toBe(0)
  })
  it('reads the zoom from a span', () => {
    expect(zoomFor(256, 360)).toBe(0)
    expect(Math.round(zoomFor(800, 360 / 2 ** 15 * 800 / 256))).toBe(15)
  })
})
