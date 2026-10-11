import type { Dish, MenuDay } from '../../schema.ts'
import { fetchJson } from '../lib/http.ts'
import { cleanName, tagsFromLabels } from '../lib/tags.ts'
import type { Adapter } from '../lib/source.ts'

type Entry = [string, string[]]
type DayMenu = {
  soup?: Entry | Entry[]
  lunch?: { mains?: Entry[]; sides?: Entry[] }
  dinner?: { mains?: Entry[]; sides?: Entry[] }
  /** Saturdays: the hot and cold counter, and the day's specials */
  brunch?: { regular?: Entry[]; specials?: Entry[] }
  desserts?: Entry[]
  potato?: Entry[]
  salads?: Entry[]
}
export type Servery = { breakfast: Entry[]; menus_by_date: Record<string, DayMenu>; term_name: string }

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

const nonEmpty = (d: Dish) => d.name.length > 0
/** The salad bar and desserts are listed every day; a meal is only served when something is cooked for it. */
const cooked = (items: Dish[]) => items.some((d) => d.course === 'main' || d.course === 'soup')

/** The days of `dates` that servery.json has menus for. */
export function parseServery(data: Servery, dates: string[]): MenuDay[] {
  const days: MenuDay[] = []
  const breakfast = data.breakfast.map((e) => dish(e, 'other'))
  for (const date of dates) {
    const m = data.menus_by_date[date]
    if (!m) continue
    const dow = new Date(date + 'T00:00:00Z').getUTCDay()
    if (dow >= 1 && dow <= 5 && breakfast.length) days.push({ date, service: 'breakfast', items: breakfast })
    const soup = list(m.soup).map((e) => dish(e, 'soup'))
    const desserts = (m.desserts ?? []).map((e) => dish(e, 'dessert'))
    const potato = (m.potato ?? []).map((e) => dish(e, 'main'))
    const salads = splitSalads(m.salads ?? [])
    const brunch = [...(m.brunch?.specials ?? []).map((e) => dish(e, 'main')), ...(m.brunch?.regular ?? []).map((e) => dish(e, 'other'))].filter(nonEmpty)
    const lunch = [...soup, ...(m.lunch?.mains ?? []).map((e) => dish(e, 'main')), ...potato, ...(m.lunch?.sides ?? []).map((e) => dish(e, 'side')), ...salads, ...desserts].filter(nonEmpty)
    const dinner = [...soup, ...(m.dinner?.mains ?? []).map((e) => dish(e, 'main')), ...(m.dinner?.sides ?? []).map((e) => dish(e, 'side')), ...desserts].filter(nonEmpty)
    if (brunch.length) days.push({ date, service: 'brunch', items: brunch })
    else if (cooked(lunch)) days.push({ date, service: 'lunch', items: lunch })
    if (cooked(dinner)) days.push({ date, service: 'dinner', items: dinner })
  }
  return days
}

// The whole term comes in one file: fetch it once per run, however many weeks are asked for.
let servery: Promise<Servery> | undefined

export const peterhouse: Adapter = {
  async fetch(ctx) {
    const data = await (servery ??= fetchJson<Servery>('https://petmenu.co.uk/servery.json'))
    return { days: parseServery(data, ctx.dates), note: `Unofficial student-run source (petmenu.co.uk) built from College PDFs; ${data.term_name}. Not guaranteed complete or correct.` }
  },
}
