import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { catzDocuments } from './st-catharines.ts'
import { churchillMenu, parseChurchill } from './churchill.ts'
import { eddiesDocuments } from './st-edmunds.ts'
import { fitzDocuments } from './fitzwilliam.ts'
import { parseNewnham } from './newnham.ts'
import { pembrokeDocuments } from './pembroke.ts'
import { trinityDocument } from './trinity.ts'

const page = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
const today = '2026-10-13'

describe('Churchill', () => {
  const days = parseChurchill(churchillMenu(page('churchill-2026-10-13.html')), today)
  it('reads a table a day, lunch and dinner, leaving days not posted yet and a Saturday that only says "Brunch"', () => {
    expect(days.map((d) => `${d.date} ${d.service}`)).toEqual(['2026-10-13 lunch', '2026-10-13 dinner', '2026-10-12 lunch', '2026-10-12 dinner'])
  })
  it('keeps the dishes as listed, codes as tags, the special as a dish', () => {
    const lunch = days[0].items
    expect(lunch[0]).toEqual({ name: "Churchill Trattoria (today's special)", tags: [] })
    expect(lunch.find((d) => d.name === 'Tomato & Pepper Soup')?.tags).toEqual(['vegan', 'vegetarian'])
    expect(lunch.find((d) => d.name === 'Chicken & Coconut Curry')?.tags).toEqual(['halal'])
    expect(lunch).toHaveLength(8)
    expect(days[1].items.map((d) => d.name)).toContain('Lamb Steak with a Mushroom Sauce')
  })
})

describe('Newnham', () => {
  const days = parseNewnham(page('newnham-2026-10-13.html'))
  it('reads the lunch and dinner menus by their dated days, a brunch-only Saturday giving none', () => {
    expect(days.filter((d) => d.service === 'lunch').map((d) => d.date)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'])
    expect(days.some((d) => d.service === 'dinner' && d.date === '2026-10-12')).toBe(true)
  })
  it('takes "(Vegan)" in front as a tag, and a pudding last as dessert', () => {
    const monday = days.find((d) => d.date === '2026-10-12' && d.service === 'lunch')!.items
    expect(monday[0]).toMatchObject({ name: 'Tofu and courgette pad Thai with toasted cashew nut', tags: ['vegan', 'vegetarian'], course: 'main' })
    expect(monday.at(-1)).toMatchObject({ name: 'Bread & Butter Pudding', course: 'dessert' })
    expect(monday.at(-2)).toMatchObject({ name: 'Turkey & Pie', course: 'main' })
  })
})

describe('the documents a listing links', () => {
  it('Fitzwilliam: the weeks and formal nights not over yet, each PDF once', () => {
    const docs = fitzDocuments(page('fitzwilliam-buttery-2026-10-13.html'), today)
    expect(docs.map((d) => d.label)).toEqual([
      "Fitzwilliam's buttery menu for the week commencing Monday 12 October 2026",
      "Fitzwilliam's Formal Hall menu for Wednesday 14 October 2026",
    ])
    expect(docs[0].url).toBe('https://www.fitz.cam.ac.uk/sites/default/files/2026-10/Buttery%20Menu%208.10.26.pdf')
  })
  it('Trinity: known by its filename, fetched again only when its upload stamp changes', () => {
    const doc = trinityDocument(page('trinity-hall-menu-this-week-2026-10-13.html'), 'https://www.trin.cam.ac.uk/download/hall-menu-this-week/')!
    expect(doc.key).toBe('Hall-menu-181026.pdf')
    expect(doc.version).toBe('30107:1791797419463:Hall-menu-181026.pdf')
    expect(doc.label).toBe("Trinity's hall menu for Monday 12 October 2026 to Sunday 18 October 2026")
  })
  it("St Edmund's: the current week's post, its notes and both PDFs, dated by the post", () => {
    const [doc, ...rest] = eddiesDocuments(page('st-edmunds-menus-2026-10-13.html'), today)
    expect(rest).toEqual([])
    expect(doc.week).toBe('2026-10-12')
    expect(doc.url).toMatch(/Week-3-Lunch-menu/)
    expect(doc.attachments).toEqual(['https://my.st-edmunds.cam.ac.uk/wp-content/uploads/2026/10/Week-3-Supper-menu.-version-1-with-calories.pdf'])
    expect(doc.text).toMatch(/Dinner service: 18:00 – 18:45/)
  })
  it('Pembroke: each cycle week with a PDF, dated as its first week and copied to the rest', () => {
    const docs = pembrokeDocuments(page('pembroke-servery-2026-10-13.html'), today)
    expect(docs.map((d) => [d.label, d.week, d.repeats])).toEqual([
      ["Pembroke's servery menu, week 1 of its cycle", '2026-10-05', ['2026-10-05', '2026-10-26', '2026-11-16']],
      ["Pembroke's servery menu, week 2 of its cycle", '2026-10-12', ['2026-10-12', '2026-11-02', '2026-11-23']],
    ])
  })
  it("St Catharine's: twelve PDFs, lunch, dinner and weekends for four weeks", () => {
    const docs = catzDocuments(page('st-catharines-cafeteria-2026-10-13.html'))
    expect(docs).toHaveLength(12)
    expect(docs[0].label).toBe("St Catharine's cafeteria menu, weekday lunch, week 1 of its four-week cycle")
    expect(docs[11].label).toBe("St Catharine's cafeteria menu, weekend brunch and dinner, week 4 of its four-week cycle")
  })
})
