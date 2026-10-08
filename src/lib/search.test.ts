import { describe, expect, it } from 'vitest'
import { applyFilters, DEFAULT_FILTERS, type Filters } from './filters.ts'
import snapshot from './fixtures/snapshot.json'
import { DAYS, venueTypes, type Dish, type Venue } from './types.ts'

// Real data: what the app had loaded on the snapshot's date (scripts/search-snapshot.ts), searched at 12:30 that day.
type Snapshot = { date: string; sites: (Omit<Venue['site'], 'official_dining_url'> & { venues: Omit<Venue, 'site' | 'url' | 'where' | 'serves'>[] })[] }
const { date, sites } = snapshot as unknown as Snapshot
const real: Venue[] = sites.flatMap(({ venues, ...site }) => venues.map((v) => ({ ...v, url: null, where: null, serves: null, site: { ...site, official_dining_url: null } })))
const noon = { date, day: DAYS[(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7], minutes: 12 * 60 + 30 }
const search = (q: string, extra: Partial<Filters> = {}, venues = real) => applyFilters(venues, { ...DEFAULT_FILTERS, date, q, ...extra }, noon)
const dishNames = (r: ReturnType<typeof search>[number]) => r.searchMatches.map((h) => h.dish!.name)
/** What a search shows, order aside: each venue with the dishes listed under it. */
const listed = (q: string) => search(q).map((r) => [r.venue.id, ...dishNames(r).sort()].join(' · ')).sort()
const today = real.flatMap((v) => v.menu.filter((d) => d.date === date).flatMap((d) => d.items))

describe('places', () => {
  it.each([
    ['homerton', 'homerton'], ['HOMERTON', 'homerton'], ['homreton', 'homerton'], ['homertn', 'homerton'], ['homer', 'homerton'],
    ['eddies', 'st-edmunds'], ['st edmunds', 'st-edmunds'], ['St Edmund’s', 'st-edmunds'],
    ['caius', 'gonville-and-caius'], ['gonville & caius', 'gonville-and-caius'], ['gonville and caius', 'gonville-and-caius'],
    ['corpus', 'corpus-christi'], ['trinity', 'trinity'], ['trinity hall', 'trinity-hall'], ['trinty hall', 'trinity-hall'], ['tit hall', 'trinity-hall'],
    ['clare', 'clare'], ['clare hall', 'clare-hall'], ['medwards', 'murray-edwards'], ['new hall', 'murray-edwards'], ['murray edwards', 'murray-edwards'],
    ['lucy cav', 'lucy-cavendish'], ['sidgwick', 'sidgwick'], ['sidgwik', 'sidgwick'], ['sidge', 'sidgwick'],
    ['UL', 'university-library'], ['university library', 'university-library'],
    ['emma', 'emmanuel'], ['emam', 'emmanuel'], ['emmanuel', 'emmanuel'],
    ['catz', 'st-catharines'], ['cat', 'st-catharines'], ['St. Catharine’s', 'st-catharines'], ['saint catharines', 'st-catharines'], ['catharines', 'st-catharines'],
    ['johns', 'st-johns'], ["St John's", 'st-johns'], ['saint johns', 'st-johns'], ['stjohns', 'st-johns'],
    ['fitz', 'fitzwilliam'], ['fitzwilliam', 'fitzwilliam'], ['fitzwilliam museum', 'fitzwilliam-museum'],
    ['magdalen', 'magdalene'], ['queens', 'queens'], ['kings', 'kings'], ['jesus', 'jesus'], ['jesuz', 'jesus'],
    ['jesus college', 'jesus'], ['kings college', 'kings'], ['food at homerton', 'homerton'], ['homerton lunch', 'homerton'], ['homerton dinner', 'homerton'],
    ['west cambridge', 'west-cambridge'], ['botanic gardens', 'botanic-garden'], ['kettles yard', 'kettles-yard'],
  ])('%s lists %s first, before anywhere else', (q, site) => {
    const slugs = search(q).map((r) => r.venue.site.slug)
    expect(slugs[0]).toBe(site)
    expect(slugs.lastIndexOf(site)).toBe(slugs.filter((s) => s === site).length - 1)
  })

  it.each(['jesus college', 'kings college', 'eddies', 'tit hall', 'homreton'])('%s lists every venue there', (q) => {
    const results = search(q)
    const site = results[0].venue.site.slug
    expect(results.filter((r) => r.venue.site.slug === site).map((r) => r.venue.id).sort()).toEqual(real.filter((v) => v.site.slug === site).map((v) => v.id).sort())
  })
})

describe('venues', () => {
  it.each([
    ['jesus caff', 'jesus/caff'], ['caff', 'jesus/caff'], ['darbar', 'darwin/darbar'], ['dar bar', 'darwin/darbar'], ['qbar', 'queens/qbar'], ['q bar', 'queens/qbar'],
    ['edspresso', 'st-edmunds/edspresso'], ['trough', 'pembroke/servery-trough'], ['whale cafe', 'new-museums/whale-cafe'], ['kings coffee shop', 'kings/coffee-shop'],
    ['garden cafe', 'botanic-garden/garden-cafe'], ['courtyard kitchen', 'fitzwilliam-museum/courtyard-kitchen'], ['cybercafe', 'chemistry/cybercafe'], ['cyber cafe', 'chemistry/cybercafe'],
    ['the den', 'wolfson/the-den'], ['arc cafe', 'sidgwick/arc-cafe'], ['the roost', 'jesus/the-roost'], ['eddies bar', 'st-edmunds/eddies-bar'],
    ['st johns formal', 'st-johns/hall'], ['queens old hall', 'queens/old-hall'], ['harveys', 'gonville-and-caius/florey-cafe'],
  ])('%s lists %s first', (q, id) => {
    expect(search(q)[0]?.venue.id).toBe(id)
  })

  it('coffeeshop finds the coffee shops', () => {
    expect(search('coffeeshop')[0]?.venue.name).toBe('Coffee Shop')
  })
  it('formal lists every place that holds formal hall', () => {
    const ids = new Set(search('formal').map((r) => r.venue.id))
    expect(real.filter((v) => v.formal).length).toBeGreaterThan(30)
    expect(real.filter((v) => v.formal).every((v) => ids.has(v.id))).toBe(true)
  })
  it.each([['bar', 'bar'], ['cafe', 'cafe']] as const)('%s lists every %s, including cafés that are bars by night', (q, type) => {
    const ids = new Set(search(q).map((r) => r.venue.id))
    expect(real.filter((v) => venueTypes(v).includes(type)).every((v) => ids.has(v.id))).toBe(true)
  })
})

describe('dishes on the day', () => {
  it.each([['pizza', /pizza/i], ['cake', /cake/i], ['curry', /curr/i], ['chips', /chips|fries|frites/i]])('%s lists only dishes that match', (q, re) => {
    const results = search(q)
    expect(results.length).toBeGreaterThan(0)
    for (const r of results) expect(dishNames(r).length > 0 && dishNames(r).every((n) => re.test(n))).toBe(true)
  })

  it.each([
    ['homerton pizza', 'homerton/dining-hall', /pizza/i], ['pizza homerton', 'homerton/dining-hall', /pizza/i],
    ['jesus chiken', 'jesus/caff', /chicken/i], ['jesus curry', 'jesus/caff', /curry/i], ['pembroke chips', 'pembroke/servery-trough', /chips|fries/i],
  ])('%s lists %s first, with only matching dishes', (q, id, re) => {
    const [first] = search(q)
    expect(first?.venue.id).toBe(id)
    expect(dishNames(first).length).toBeGreaterThan(0)
    expect(dishNames(first).every((n) => re.test(n))).toBe(true)
  })

  it.each([
    ['curries', 'curry'], ['chikcen', 'chicken'], ['chiken', 'chicken'], ['sausages', 'sausage'], ['lasagna', 'lasagne'], ['yoghurt', 'yogurt'],
    ['haloumi', 'halloumi'], ['mac n cheese', 'mac and cheese'], ['veggie', 'vegetarian'],
  ])('%s finds what %s finds', (a, b) => {
    expect(listed(a).length).toBeGreaterThan(0)
    expect(listed(a)).toEqual(listed(b))
  })

  it('chips also lists fries', () => {
    expect(search('chips').flatMap(dishNames).filter((n) => /fries/i.test(n)).length).toBeGreaterThan(0)
  })
  it.each([['vegan', ['vegan']], ['vegetarian', ['vegan', 'vegetarian']], ['halal', ['halal']]] as const)('%s lists every dish tagged or named so', (q, tags) => {
    const shown = new Set(search(q).flatMap((r) => r.searchMatches.map((h) => h.dish)))
    const expected = today.filter((d) => tags.some((t) => d.tags.includes(t)) || new RegExp(`\\b${q}\\b`, 'i').test(d.name))
    expect(expected.length).toBeGreaterThan(0)
    expect(expected.filter((d) => !shown.has(d)).map((d) => d.name)).toEqual([])
  })
  it('a place with no matching dish is listed without dishes', () => {
    const [first] = search('jesus sushi')
    expect(first.venue.site.slug).toBe('jesus')
    expect(dishNames(first)).toEqual([])
  })
  it('finds nothing for nonsense', () => {
    expect(search('zzzzzz')).toEqual([])
  })
})

// Made-up data, for the rules filters and search must keep.
const at = { date: '2026-10-08', day: 'thu' as const, minutes: 12 * 60 + 30 }
function venue(id: string, name: string, site: string, items: Dish[] = []): Venue {
  return {
    id, slug: id.split('/')[1], name, type: 'hall', url: null, where: null, serves: null,
    site: { slug: id.split('/')[0], name: site, short_name: null, kind: 'college', official_dining_url: null, aliases: [] },
    slots: [{ meal: 'lunch', days: ['thu'], start: '12:00', end: '14:00', period: 'all' }],
    access: { level: 'public' }, payment: { bank_card: true }, dietary: { tags: [] },
    menu: [{ date: at.date, service: 'lunch', items }],
  }
}
const jesus = venue('jesus/caff', 'Caff', 'Jesus', [
  { name: 'Chicken curry', tags: ['halal'] }, { name: 'Vegetable curry', tags: ['vegan'] }, { name: 'Lentil soup', tags: ['vegan', 'halal'] },
])
const homerton = venue('homerton/hall', 'Dining Hall', 'Homerton')
const find = (q: string, extra: Partial<Filters> = {}, venues = [jesus, homerton]) => applyFilters(venues, { ...DEFAULT_FILTERS, date: at.date, q, ...extra }, at)

describe('rules', () => {
  it('lists dishes that match every word before dishes that match some', () => {
    const soup = { ...jesus, menu: [{ ...jesus.menu[0], items: [...jesus.menu[0].items, { name: 'Chicken and lentil broth', tags: [] }] }] }
    expect(find('chicken lentil', {}, [soup]).flatMap(dishNames)).toEqual(['Chicken and lentil broth'])
  })
  it('does not fuzzy-match very short words', () => {
    expect(find('cat', {}, [venue('test/hall', 'Hall', 'Test', [{ name: 'Cod', tags: [] }])])).toEqual([])
  })
  it('checks diets on the dish itself, never across dishes', () => {
    expect(find('jesus chicken', { diets: ['vegan'] }).flatMap(dishNames)).toEqual([])
    expect(find('curry', { diets: ['vegan', 'halal'] })).toEqual([])
    expect(find('lentil', { diets: ['vegan', 'halal'] }).flatMap(dishNames)).toEqual(['Lentil soup'])
    expect(find('chicken', { diets: ['halal'] }).map((r) => r.venue.id)).toEqual([jesus.id])
  })
  it('respects meal, type, site, payment and access filters', () => {
    expect(find('chicken', { meal: 'dinner' })).toEqual([])
    expect(find('jesus', { type: 'bar' })).toEqual([])
    expect(find('jesus', { site: 'homerton' })).toEqual([])
    expect(find('jesus', { bankCard: true }, [{ ...jesus, payment: {} }])).toEqual([])
    expect(find('jesus', { nonMemberOk: true }, [{ ...jesus, access: { level: 'members_only' } }])).toEqual([])
    expect(find('homerton', { openNow: true }, [{ ...homerton, slots: [] }])).toEqual([])
  })
  it('searches only the requested date, including for dietary evidence', () => {
    const tomorrow = { ...jesus, menu: jesus.menu.map((d) => ({ ...d, date: '2026-10-09' })) }
    expect(find('chicken', {}, [tomorrow])).toEqual([])
    expect(find('chicken', { date: '2026-10-09' }, [tomorrow])).toHaveLength(1)
    expect(find('jesus', {}, [tomorrow])).toHaveLength(1)
  })
  it('ranks an exact place ahead of a typo match even when it is closed', () => {
    expect(find('homerton', {}, [venue('test/hall', 'Homertom', 'Test'), { ...homerton, slots: [] }])[0].venue.id).toBe(homerton.id)
  })
  it('finds where formal hall is held, with or without published days', () => {
    const dated = { ...venue('jesus/hall', 'Hall', 'Jesus'), slots: [{ meal: 'formal' as const, days: ['thu' as const], start: '19:30', end: '21:30', period: 'all' as const }] }
    const undated = { ...venue('st-johns/hall', 'Hall', 'St John’s'), slots: [], formal: true }
    expect(find('formal', {}, [dated, undated, homerton]).map((r) => r.venue.id).sort()).toEqual(['jesus/hall', 'st-johns/hall'])
  })
  it('does not use editorial notes as evidence of current food', () => {
    expect(find('pizza', {}, [{ ...homerton, serves: 'Pizza last year', where: 'Pizza room' }])).toEqual([])
  })
  it('refreshes the index for a new data snapshot', () => {
    expect(find('pizza', {}, [jesus])).toEqual([])
    expect(find('pizza', {}, [{ ...jesus, menu: [{ ...jesus.menu[0], items: [{ name: 'Pizza', tags: [] }] }] }])).toHaveLength(1)
  })
})
