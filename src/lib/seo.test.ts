import { describe, expect, it } from 'vitest'
import type { Data } from './data.tsx'
import { headTags, hoursText, llmsFullTxt, llmsTxt, pages, sitemap } from './seo.ts'
import type { Venue } from './types.ts'

const jesus = { slug: 'jesus', name: 'Jesus', short_name: null, kind: 'college' as const, official_dining_url: null }
const caff: Venue = {
  id: 'jesus/caff',
  slug: 'caff',
  name: 'Caff',
  type: 'hall',
  url: null,
  where: null,
  serves: null,
  access: { level: 'members_only' },
  payment: {},
  dietary: { tags: [] },
  site: jesus,
  slots: [
    { meal: 'dinner', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], start: '17:40', end: '18:40', period: 'all' },
    { meal: 'lunch', days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '12:00', end: '13:45', period: 'all' },
  ],
  menu: [
    { date: '2026-10-08', service: 'dinner', items: [{ name: 'Pie </script>', tags: [] }] },
    { date: '2026-10-08', service: 'lunch', items: [{ name: 'Dhal', tags: ['vegan', 'vegetarian'], price_gbp: 3.3 }] },
  ],
}
const data: Data = { sites: [jesus], venues: [caff], menuFrom: '2026-10-08', menuTo: '2026-10-15' }
const date = '2026-10-08'

describe('seo', () => {
  it('lists home, the directory, about, coverage, terms, photo credits, each site and each venue', () => {
    expect(pages(data, date).map((p) => p.path)).toEqual(['/', '/directory', '/about', '/coverage', '/terms', '/credits', '/jesus', '/jesus/caff'])
  })

  it('describes a venue with its hours, and gives schema.org hours and menus by date then meal', () => {
    const venue = pages(data, date).at(-1)!
    expect(venue.description).toBe('Caff, Jesus College, Cambridge: dining. Open Lunch Mon–Fri 12:00–13:45; Dinner Daily 17:40–18:40. Menu dish by dish.')
    const ld = venue.jsonLd as Record<string, any>
    expect(ld['@type']).toBe('FoodEstablishment')
    expect(ld.publicAccess).toBe(false)
    expect(ld.openingHoursSpecification[0]).toMatchObject({ name: 'Lunch', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '12:00', closes: '13:45' })
    expect(ld.hasMenu.hasMenuSection.map((s: { name: string }) => s.name)).toEqual(['Lunch, Thursday 8 October', 'Dinner, Thursday 8 October'])
    expect(ld.hasMenu.hasMenuSection[0].hasMenuItem[0]).toMatchObject({ name: 'Dhal', suitableForDiet: ['https://schema.org/VeganDiet', 'https://schema.org/VegetarianDiet'], offers: { price: '3.30', priceCurrency: 'GBP' } })
  })

  it('previews a venue with its photo, at an absolute URL on the site', () => {
    const photo = { path: 'jesus/caff/0a1b2c3d', widths: [240, 480, 960, 1600], width: 1600, height: 1067, color: null, alt: 'The Caff', credit: 'Someone', licence: 'CC BY-SA 4.0', source: null }
    const withPhoto = { ...data, venues: [{ ...caff, photos: [photo] }] }
    expect(pages(withPhoto, date).at(-1)!.image).toBe('https://grub.cam/photos/jesus/caff/0a1b2c3d-1600.webp')
    expect(pages(data, date).at(-1)!.image).toBeUndefined()
  })

  it("writes head tags that a dish name can't break out of", () => {
    const tags = headTags(pages(data, date).at(-1)!, 'Caff "quoted"')
    expect(tags).toContain('<link rel="canonical" href="https://grub.cam/jesus/caff" />')
    expect(tags).toContain('content="Caff &quot;quoted&quot;"')
    expect(tags).not.toContain('Pie </script>')
    expect(tags).toContain('Pie \\u003c/script>')
  })

  it('writes a sitemap and llms.txt files', () => {
    expect(sitemap(pages(data, date), date)).toContain('<url><loc>https://grub.cam/jesus/caff</loc><lastmod>2026-10-08</lastmod></url>')
    expect(llmsTxt(data)).toContain('- [Jesus College](https://grub.cam/jesus): Caff')
    const full = llmsFullTxt(data, date, '8 Oct 2026, 14:00')
    expect(full).toContain('Hours: Lunch Mon–Fri 12:00–13:45; Dinner Daily 17:40–18:40')
    expect(full).toContain('Access: members only')
    expect(full).toContain('- Thu 8 Oct, lunch: Dhal [VG]')
    expect(hoursText([])).toBe('')
  })
})
