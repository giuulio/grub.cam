import type { Dish, MenuDay } from '../../schema.ts'
import { fetchJson } from '../lib/http.ts'
import { cleanName, tagsFromLabels } from '../lib/tags.ts'
import type { Source } from '../lib/source.ts'

type Entry = [string, string[]]
type DayMenu = {
  soup?: Entry | Entry[]
  lunch?: { mains?: Entry[]; sides?: Entry[] }
  dinner?: { mains?: Entry[]; sides?: Entry[] }
  desserts?: Entry[]
  potato?: Entry[]
  salads?: Entry[]
}
type Servery = { breakfast: Entry[]; menus_by_date: Record<string, DayMenu>; term_name: string }

const DIET_CODES = new Set(['V', 'VV', 'HM'])

function dish([name, codes]: Entry, course: Dish['course']): Dish {
  return { name: cleanName(name), tags: tagsFromLabels(codes.filter((c) => DIET_CODES.has(c))), course }
}

const list = (e?: Entry | Entry[]): Entry[] => (!e ? [] : Array.isArray(e[0]) ? (e as Entry[]) : [e as Entry])

const CODE = /^(V|VV|HM|C|D|E|F|G|L|M|MO|N|P|PN|S|SD|SO)$/
/** The salad bar arrives as one string: "Mixed side salad VV  Tomato and fennel VV  Pesto pasta V G D ...". Split on 2+ spaces, peel trailing codes. */
function splitSalads(entries: Entry[]): Dish[] {
  const out: Dish[] = []
  for (const [text] of entries) {
    for (const chunk of text.split(/\s{2,}/)) {
      const words = chunk.trim().split(/\s+/)
      const codes: string[] = []
      while (words.length && CODE.test(words.at(-1)!)) codes.unshift(words.pop()!)
      const name = cleanName(words.join(' '))
      if (name) out.push({ name, tags: tagsFromLabels(codes.filter((c) => DIET_CODES.has(c))), course: 'side' })
    }
  }
  return out
}

export const peterhouse: Source = {
  college: 'peterhouse',
  venue: 'hall-servery',
  source_url: 'https://petmenu.co.uk/',
  async fetch(ctx) {
    const data = await fetchJson<Servery>('https://petmenu.co.uk/servery.json')
    const days: MenuDay[] = []
    const breakfast = data.breakfast.map((e) => dish(e, 'other'))
    for (const date of ctx.dates) {
      const m = data.menus_by_date[date]
      if (!m) continue
      const dow = new Date(date + 'T00:00:00Z').getUTCDay()
      if (dow >= 1 && dow <= 5 && breakfast.length) days.push({ date, service: 'breakfast', items: breakfast })
      const soup = list(m.soup).map((e) => dish(e, 'soup'))
      const desserts = (m.desserts ?? []).map((e) => dish(e, 'dessert'))
      const potato = (m.potato ?? []).map((e) => dish(e, 'main'))
      const salads = splitSalads(m.salads ?? [])
      const nonEmpty = (d: Dish) => d.name.length > 0
      const lunch = [...soup, ...(m.lunch?.mains ?? []).map((e) => dish(e, 'main')), ...potato, ...(m.lunch?.sides ?? []).map((e) => dish(e, 'side')), ...salads, ...desserts].filter(nonEmpty)
      const dinner = [...soup, ...(m.dinner?.mains ?? []).map((e) => dish(e, 'main')), ...(m.dinner?.sides ?? []).map((e) => dish(e, 'side')), ...desserts].filter(nonEmpty)
      if (lunch.length) days.push({ date, service: dow === 6 ? 'brunch' : 'lunch', items: lunch })
      if (dinner.length) days.push({ date, service: 'dinner', items: dinner })
    }
    return { days, note: `Unofficial student-run source (petmenu.co.uk) built from College PDFs; ${data.term_name}. Not guaranteed complete or correct.` }
  },
}
