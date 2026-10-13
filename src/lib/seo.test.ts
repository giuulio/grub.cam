import { describe, expect, it } from 'vitest'
import type { Data } from './data.tsx'
import { headTags, hoursText, llmsFullTxt, llmsTxt, pages, sitemap, siteTitle, splitHoisted, TAB_TITLES, venueTitle } from './seo.ts'
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
  it('lists home and its tabs, about, coverage, terms, photo credits, send, each site and each venue', () => {
    expect(pages(data, date).map((p) => p.path)).toEqual(['/', '/dining', '/cafes', '/bars', '/formal', '/about', '/contribute', '/terms', '/credits', '/send', '/jesus', '/jesus/caff'])
  })

  it('describes a venue with its hours, and gives schema.org hours, menus by date then meal, where it is and its breadcrumb', () => {
    const venue = pages({ ...data, venues: [{ ...caff, latitude: 52.2088, longitude: 0.1241 }] }, date).at(-1)!
    expect(venue.description).toBe("Caff, Jesus College, Cambridge: dining hall. Open Lunch Mon–Fri 12:00–13:45; Dinner Daily 17:40–18:40. Today's menu dish by dish, with prices.")
    const [ld, crumbs] = venue.jsonLd as Record<string, any>[]
    expect(ld['@type']).toBe('FoodEstablishment')
    expect(ld.geo).toEqual({ '@type': 'GeoCoordinates', latitude: 52.2088, longitude: 0.1241 })
    expect(ld.openingHoursSpecification[0]).toMatchObject({ name: 'Lunch', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '12:00', closes: '13:45' })
    expect(ld.hasMenu.hasMenuSection.map((s: { name: string }) => s.name)).toEqual(['Lunch, Thursday 8 October', 'Dinner, Thursday 8 October'])
    expect(ld.hasMenu.hasMenuSection[0].hasMenuItem[0]).toMatchObject({ name: 'Dhal', suitableForDiet: ['https://schema.org/VeganDiet', 'https://schema.org/VegetarianDiet'], offers: { price: '3.30', priceCurrency: 'GBP' } })
    expect(crumbs.itemListElement.map((c: { name: string; item: string }) => [c.name, c.item])).toEqual([
      ['Home', 'https://grub.cam/'],
      ['Jesus College', 'https://grub.cam/jesus'],
      ['Caff', 'https://grub.cam/jesus/caff'],
    ])
  })

  it('titles pages by what people search for, the place first and the site last', () => {
    expect(TAB_TITLES['/']).toBe('Cambridge college menus, cafés and bars today · grub.cam')
    expect(TAB_TITLES['/formal']).toMatch(/^Cambridge college formal hall/)
    const bar: Venue = { ...caff, id: 'jesus/roost', slug: 'roost', name: 'The Roost', type: 'bar', menu: [], slots: [{ meal: 'bar', days: ['fri'], start: '20:00', end: '23:00', period: 'all' }] }
    expect(siteTitle(jesus, [caff, bar])).toBe('Jesus College, Cambridge: dining hall menus and bar opening hours · grub.cam')
    expect(venueTitle(caff)).toBe('Caff, Jesus College, Cambridge: menu today, opening hours and prices · grub.cam')
    expect(venueTitle(bar)).toBe('The Roost, Jesus College, Cambridge: bar opening hours · grub.cam')
    expect(venueTitle({ ...caff, menu: [], slots: [{ meal: 'formal', days: ['fri'], start: '19:30', end: '21:30', period: 'term' }] })).toBe('Caff, Jesus College, Cambridge: formal hall nights, price and dress code · grub.cam')
    const uni = { ...jesus, slug: 'west-cambridge', name: 'West Cambridge', kind: 'university' as const }
    expect(siteTitle(uni, [])).toBe('West Cambridge, University of Cambridge: opening hours · grub.cam')
  })

  it('describes a site by its venues and lists each tab’s venues for search engines', () => {
    const all = pages(data, date)
    expect(all.find((p) => p.path === '/jesus')!.description).toBe("Where to eat and drink at Jesus College, Cambridge: Caff (dining hall). Today's menus, opening hours and prices.")
    const dining = all.find((p) => p.path === '/dining')!.jsonLd as Record<string, any>
    expect(dining).toMatchObject({ '@type': 'ItemList', numberOfItems: 1 })
    expect(dining.itemListElement[0]).toMatchObject({ name: 'Caff, Jesus College', url: 'https://grub.cam/jesus/caff' })
    expect((all.find((p) => p.path === '/bars')!.jsonLd as Record<string, any>).numberOfItems).toBe(0)
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
    expect(tags).toContain('<meta name="robots" content="max-image-preview:large" />')
    expect(tags).toContain('<meta name="twitter:card" content="summary" />')
    expect(tags).not.toContain('Pie </script>')
    expect(tags).toContain('Pie \\u003c/script>')
  })

  it('takes the title and a banner’s preload off the front of a rendered page, whichever comes first', () => {
    const preload = '<link rel="preload" as="image" imageSrcSet="/photos/jesus/a-480.webp 480w" fetchPriority="high"/>'
    expect(splitHoisted(`${preload}<title>Jesus College &amp; more</title><div>body</div>`)).toEqual({ title: 'Jesus College & more', head: preload, html: '<div>body</div>' })
    expect(splitHoisted('<title>Caff</title><div>body</div>')).toEqual({ title: 'Caff', head: '', html: '<div>body</div>' })
    expect(splitHoisted('<div>no title</div>')).toEqual({ title: '', head: '', html: '<div>no title</div>' })
  })

  it('writes a sitemap and llms.txt files', () => {
    expect(sitemap(pages(data, date), date)).toContain('<url><loc>https://grub.cam/jesus/caff</loc><lastmod>2026-10-08</lastmod></url>')
    // A page without a menu doesn't change with each build, so it isn't dated
    expect(sitemap(pages(data, date), date)).toContain('<url><loc>https://grub.cam/about</loc></url>')
    expect(llmsTxt(data)).toContain('- [Jesus College](https://grub.cam/jesus): Caff')
    const full = llmsFullTxt(data, date, '8 Oct 2026, 14:00')
    expect(full).toContain('Hours: Lunch Mon–Fri 12:00–13:45; Dinner Daily 17:40–18:40')
    expect(full).toContain('- Thu 8 Oct, lunch: Dhal [VG]')
    expect(hoursText([])).toBe('')
  })
  it('keeps fixed-menu descriptions in the complete text export', () => {
    const cafe: Venue = { ...caff, type: 'cafe', menu: [], prices: [{ section: 'Breakfast / lunch', name: 'Herb Potato Rosti', description: 'Choose spinach, bacon, or beans', price_gbp: 7.15, non_member_gbp: null, services: ['snacks'], course: null, tags: [], observed_on: '2026-10-12', source: 'email' }] }
    expect(llmsFullTxt({ ...data, venues: [cafe] }, date, '12 Oct 2026')).toContain('Herb Potato Rosti — Choose spinach, bacon, or beans £7.15')
  })
})
