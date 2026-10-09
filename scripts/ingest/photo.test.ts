import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { makeVariants, widthsFor } from './photo.ts'

describe('widthsFor', () => {
  it('makes each standard width the photo covers, never wider than it', () => {
    expect(widthsFor(4032)).toEqual([480, 960, 1600])
    expect(widthsFor(1200)).toEqual([480, 960])
    expect(widthsFor(300)).toEqual([300])
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
    expect(variants.map((v) => [v.width, v.height])).toEqual([[480, 640], [960, 1280]])
    const meta = await sharp(variants[1].file).metadata()
    expect([meta.format, meta.exif, meta.orientation]).toEqual(['webp', undefined, undefined])
    expect(color).toMatch(/^#[0-9a-f]{6}$/)
  })
})
