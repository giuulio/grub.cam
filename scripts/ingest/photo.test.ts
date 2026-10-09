import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { commonsTitle, makeVariants, parseList, widthsFor } from './photo.ts'

describe('widthsFor', () => {
  it('makes each standard width the photo covers, never wider than it', () => {
    expect(widthsFor(4032)).toEqual([240, 480, 960, 1600])
    expect(widthsFor(1200)).toEqual([240, 480, 960])
    expect(widthsFor(200)).toEqual([200])
  })
})

describe('makeVariants', () => {
  it('turns a phone photo upright and strips its metadata', async () => {
    // 1600×1200 as stored, EXIF orientation 6: a portrait photo, 1200 wide once upright
    const phone = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: { r: 200, g: 40, b: 30 } } })
      .jpeg()
      .withMetadata({ orientation: 6, exif: { IFD0: { Copyright: 'someone' } } })
      .toBuffer()
    const { variants, color } = await makeVariants(phone)
    expect(variants.map((v) => [v.width, v.height])).toEqual([[240, 320], [480, 640], [960, 1280]])
    const meta = await sharp(variants[2].file).metadata()
    expect([meta.format, meta.exif, meta.orientation]).toEqual(['webp', undefined, undefined])
    expect(color).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('commonsTitle', () => {
  it('reads a Commons file from its page URL or its title, and nothing else', () => {
    expect(commonsTitle('https://commons.wikimedia.org/wiki/File:Darwin_Dining_Hall.jpg')).toBe('File:Darwin Dining Hall.jpg')
    expect(commonsTitle("https://commons.wikimedia.org/wiki/File:St_Edmund%27s_College_Dining_Hall.jpg")).toBe("File:St Edmund's College Dining Hall.jpg")
    expect(commonsTitle('File:Norfolk Building.jpg')).toBe('File:Norfolk Building.jpg')
    expect(commonsTitle('photos/counter.jpg')).toBeUndefined()
  })
})

describe('parseList', () => {
  it('reads one photo per line, skipping blanks and comments', () => {
    const jobs = parseList('# Halls\n\ndarwin/servery | File:Darwin Dining Hall.jpg | The dining hall, laid for dinner\n')
    expect(jobs).toEqual([{ venue: 'darwin/servery', file: 'File:Darwin Dining Hall.jpg', alt: 'The dining hall, laid for dinner', kind: 'venue' }])
  })

  it('takes a credit when Commons names no author', () => {
    expect(parseList('peterhouse/hall-servery | File:Peterhouse-Hall.JPG | The Hall | OliCAmb')[0].credit).toBe('OliCAmb')
  })

  it('says which line is wrong', () => {
    expect(() => parseList('darwin/servery | File:X.jpg')).toThrow('line 1')
  })
})
