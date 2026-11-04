import { describe, expect, it } from 'vitest'
import { venueLinks } from './links.ts'

const price = (source: string) => ({ section: null, name: 'Soup', price_gbp: 1, non_member_gbp: null, services: null, course: null, tags: [], observed_on: '2026-11-01', source })

describe('venueLinks', () => {
  it('puts the menu at the top when the venue has no page of its own, and only there', () => {
    expect(venueLinks({ url: null, menu_url: 'https://catering.emma.cam.ac.uk/' })).toEqual({ top: { href: 'https://catering.emma.cam.ac.uk/', menu: true } })
  })
  it('keeps a file under the menu, never at the top, and leaves the college page to the college', () => {
    expect(venueLinks({ url: null, menu_url: 'https://www.trin.cam.ac.uk/download/hall-menu-this-week/' })).toEqual({ menu: 'https://www.trin.cam.ac.uk/download/hall-menu-this-week/' })
    expect(venueLinks({ url: null, menu_url: 'https://x.cam.ac.uk/menu.pdf' }).top).toBeUndefined()
  })
  it('links its own page at the top and its menu below, saying so when they are one', () => {
    expect(venueLinks({ url: 'https://a.cam.ac.uk/cafe', menu_url: 'https://a.cam.ac.uk/menu' })).toMatchObject({ top: { href: 'https://a.cam.ac.uk/cafe', menu: false }, menu: 'https://a.cam.ac.uk/menu' })
    expect(venueLinks({ url: 'https://a.cam.ac.uk/menu/', menu_url: 'https://www.a.cam.ac.uk/menu' })).toEqual({ top: { href: 'https://a.cam.ac.uk/menu/', menu: true } })
  })
  it('links formal hall and a price list only when nothing above has (Pembroke: its page is the formal procedure)', () => {
    const procedure = 'https://pem.cam.ac.uk/college/catering/information-students/formal-hall-procedure'
    expect(venueLinks({ url: procedure, formal: { url: procedure } }).formal).toBeUndefined()
    expect(venueLinks({ url: null, menu_url: 'https://m.cam.ac.uk/', formal: { url: 'https://m.cam.ac.uk/formal' } }).formal).toBe('https://m.cam.ac.uk/formal')
    expect(venueLinks({ url: null, menu_url: 'https://m.cam.ac.uk/', prices: [price('https://m.cam.ac.uk/ (board)')] }).prices).toBeUndefined()
    expect(venueLinks({ url: null, prices: [price('Noticeboard, photographed 1 Nov')] }).prices).toBeUndefined()
  })
})
