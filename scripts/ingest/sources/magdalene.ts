import { parse } from 'node-html-parser'
import type { Dish, MenuDay } from '../../schema.ts'
import { WEEKDAYS, weekMonday } from '../lib/dates.ts'
import { fetchText } from '../lib/http.ts'
import { cleanName, courseFromHeading, tagsFromLabels } from '../lib/tags.ts'
import type { Adapter } from '../lib/source.ts'

type LdItem = { name: string; suitableForDiet?: string | string[]; offers?: { price?: string } }
type LdSection = { name: string; hasMenuItem?: LdItem | LdItem[]; hasMenuSection?: LdSection | LdSection[] }
type LdMenu = { '@type': string; name: string; hasMenuSection?: LdSection | LdSection[] }

/** JSON-LD lists one child as an object rather than a one-element array. */
const list = <T>(x: T | T[] | undefined): T[] => (x === undefined ? [] : Array.isArray(x) ? x : [x])

/** "Ramsay Wk Com 05/10/26" or "Ramsay Wk4 Com 01/06/2026" → 2026-10-05 */
function comDate(label: string): string | undefined {
  const m = label.match(/Com\s+(\d{2})\/(\d{2})\/(\d{2,4})/i)
  if (!m) return undefined
  const y = m[3].length === 2 ? `20${m[3]}` : m[3]
  return `${y}-${m[2]}-${m[1]}`
}

function serviceOf(name: string): MenuDay['service'] | undefined {
  const s = name.toLowerCase()
  if (/brunch/.test(s)) return 'brunch'
  if (/lunch/.test(s)) return 'lunch'
  if (/dinner|supper|night/.test(s)) return 'dinner'
  if (/breakfast/.test(s)) return 'breakfast'
  return undefined
}

/** The menu listed on viewthe.menu/lyzv whose name matches `pick` for the week starting `monday`, parsed from its JSON-LD. */
async function tenkitesMenu(pick: RegExp, monday: string) {
  const index = parse(await fetchText('https://viewthe.menu/lyzv'))
  const option = index.querySelectorAll('.k10-menu-selector__option-name').find((a) => pick.test(a.text) && comDate(a.text) === monday)
  if (!option) return undefined
  const guid = option.getAttribute('data-menu-identifier')
  const root = parse(await fetchText(`https://menus.tenkites.com/magdalenecollege/webmenus?cl=true&mguid=${guid}`))

  // Diet labels (V / VG) live on the rendered recipes; JSON-LD only carries one suitableForDiet.
  const labelsByName = new Map<string, string[]>()
  for (const r of root.querySelectorAll('.k10-recipe')) {
    const name = cleanName(r.querySelector('.k10-recipe__name')?.text ?? '')
    const labels = r.querySelectorAll('.k10-recipe__label').map((l) => l.text.trim())
    if (name) labelsByName.set(name, labels)
  }

  const ld = root
    .querySelectorAll('script[type="application/ld+json"]')
    .map((s) => JSON.parse(s.text) as LdMenu)
    .find((d) => d['@type'] === 'Menu')
  if (!ld) throw new Error('no JSON-LD menu found')

  const toDish = (it: LdItem, course: Dish['course']): Dish => {
    const name = cleanName(it.name)
    const diets = list(it.suitableForDiet).map((u) => u.replace(/.*\//, '').replace(/Diet$/, ''))
    const price = it.offers?.price ? Number(it.offers.price) : undefined
    return { name, tags: tagsFromLabels([...(labelsByName.get(name) ?? []), ...diets]), course, price_gbp: Number.isFinite(price) ? price : undefined }
  }
  return { title: option.text.trim(), sections: list(ld.hasMenuSection), toDish }
}

export const magdalene: Adapter = {
  async fetch(ctx) {
    const monday = weekMonday(ctx.week)
    const menu = await tenkitesMenu(/ramsay/i, monday)
    if (!menu) return { days: [], note: `No Ramsay Hall menu listed for week commencing ${monday}.` }
    const days: MenuDay[] = []
    const dish = (it: LdItem, service: MenuDay['service']): Dish => {
      const d = menu.toDish(it, 'main')
      const price = d.price_gbp
      d.course = service === 'brunch' ? 'other' : price !== undefined && price <= 1 ? 'side' : price !== undefined && price < 2 ? 'dessert' : courseFromHeading(d.name) === 'soup' ? 'soup' : 'main'
      return d
    }
    for (const daySec of menu.sections) {
      const idx = WEEKDAYS.indexOf(daySec.name.trim().toLowerCase())
      if (idx < 0) continue
      const date = ctx.dates[idx]
      const direct = list(daySec.hasMenuItem)
      if (direct.length) days.push({ date, service: 'lunch', items: direct.map((i) => dish(i, 'lunch')) })
      for (const sub of list(daySec.hasMenuSection)) {
        const service = serviceOf(sub.name)
        if (!service) continue
        const items = list(sub.hasMenuItem).map((i) => dish(i, service))
        const note = /theme night/i.test(sub.name) ? sub.name.replace(/\s*\d.*$/, '') : undefined
        if (items.length) days.push({ date, service, items, ...(note ? { note } : {}) })
      }
    }
    return { days, note: `Source menu "${menu.title}" on viewthe.menu. Course is inferred from price (sides ≤ £1, desserts < £2).` }
  },
}

/** Formal Hall's menu, on the same page: a "<Weekday> Dinner" section per night with Starter, Main and Dessert. */
export const magdaleneFormal: Adapter = {
  async fetch(ctx) {
    const monday = weekMonday(ctx.week)
    const menu = await tenkitesMenu(/formal hall/i, monday)
    if (!menu) return { days: [], note: `No Formal Hall menu listed for week commencing ${monday}.` }
    const days: MenuDay[] = []
    for (const daySec of menu.sections) {
      const idx = WEEKDAYS.findIndex((w) => daySec.name.trim().toLowerCase().startsWith(w))
      if (idx < 0) continue
      const items: Dish[] = list(daySec.hasMenuItem).map((i) => menu.toDish(i, 'main'))
      for (const sub of list(daySec.hasMenuSection)) items.push(...list(sub.hasMenuItem).map((i) => menu.toDish(i, courseFromHeading(sub.name))))
      if (items.length) days.push({ date: ctx.dates[idx], service: 'formal', items })
    }
    return { days, note: `Source menu "${menu.title}" on viewthe.menu.` }
  },
}
