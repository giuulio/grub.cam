import { describe, expect, it } from 'vitest'
import { pickToken, tokenOrigin } from './mapView.ts'

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
