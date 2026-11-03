import { describe, expect, it, vi } from 'vitest'
import { panelCover, pickToken, pinLabel, placeLabels, tokenOrigin, whenStill, zoomFor, type Moving } from './mapView.ts'

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
  it('leaves the college out on a map of one site, whose page names it', () => {
    expect(pinLabel({ name: 'Hall', site }, true)).toBe('Hall')
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

describe('a panel over the map', () => {
  // The map 600 px square at (500, 100) on the page
  const box = { left: 500, top: 100, right: 1100, bottom: 700, width: 600, height: 600 } as DOMRect
  const panel = (left: number, top: number, width: number, height: number) => ({ getBoundingClientRect: () => ({ left, top, width, height, right: left + width, bottom: top + height }) }) as HTMLElement
  it('covers nothing when it isn’t drawn (an empty sheet, beside a list)', () => {
    expect(panelCover(panel(0, 0, 0, 0), box)).toEqual({ left: 0, bottom: 0 })
    expect(panelCover(undefined, box)).toEqual({ left: 0, bottom: 0 })
  })
  it('covers the foot on a phone, the left beside the map', () => {
    expect(panelCover(panel(500, 520, 600, 180), box)).toEqual({ left: 0, bottom: 180 })
    expect(panelCover(panel(500, 100, 240, 600), box)).toEqual({ left: 240, bottom: 0 })
  })
})

describe('moving Apple’s map once it’s still', () => {
  // A map that's moving, and ends its move when told to
  const map = () => {
    const ends = new Set<() => void>()
    const e: Moving & { end: () => void } = {
      moving: true,
      map: { addEventListener: (_, f) => ends.add(f), removeEventListener: (_, f) => ends.delete(f) },
      end: () => {
        e.moving = false
        ends.forEach((f) => f())
      },
    }
    return e
  }
  it('moves at once when it’s still', () => {
    const move = vi.fn()
    whenStill({ ...map(), moving: false }, move)
    expect(move).toHaveBeenCalledOnce()
  })
  it('waits for the move under way to end, as MapKit would drop this one', () => {
    vi.useFakeTimers()
    const e = map()
    const move = vi.fn()
    whenStill(e, move)
    vi.advanceTimersByTime(1500)
    expect(move).not.toHaveBeenCalled()
    e.end()
    vi.runAllTimers()
    expect(move).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })
  it('moves anyway when the end is never told, and not twice', () => {
    vi.useFakeTimers()
    const e = map()
    const move = vi.fn()
    whenStill(e, move)
    vi.advanceTimersByTime(4000)
    vi.runAllTimers()
    e.end()
    vi.runAllTimers()
    expect(move).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })
  it('never moves once cancelled (another venue picked meanwhile)', () => {
    vi.useFakeTimers()
    const e = map()
    const move = vi.fn()
    const cancel = whenStill(e, move)
    cancel()
    e.end()
    vi.runAllTimers()
    expect(move).not.toHaveBeenCalled()
    // Nor when cancelled between the end and the move
    const later = vi.fn()
    const stop = whenStill(e.moving ? e : Object.assign(e, { moving: true }), later)
    e.end()
    stop()
    vi.runAllTimers()
    expect(later).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
