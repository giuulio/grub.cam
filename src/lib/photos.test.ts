import { describe, expect, it } from 'vitest'
import { licenceUrl } from './photos.ts'

describe('licenceUrl', () => {
  it("links a Creative Commons licence to its deed, a ported one to its country's", () => {
    expect(licenceUrl('CC BY-SA 2.0')).toBe('https://creativecommons.org/licenses/by-sa/2.0/')
    expect(licenceUrl('CC BY 2.5')).toBe('https://creativecommons.org/licenses/by/2.5/')
    expect(licenceUrl('CC BY-SA 2.0 uk')).toBe('https://creativecommons.org/licenses/by-sa/2.0/uk/')
    expect(licenceUrl('CC0')).toBe('https://creativecommons.org/publicdomain/zero/1.0/')
  })

  it('has nothing to link for public domain or our own photos', () => {
    expect(licenceUrl('Public domain')).toBeUndefined()
    expect(licenceUrl(null)).toBeUndefined()
  })
})
