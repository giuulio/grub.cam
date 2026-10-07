import { parse } from 'node-html-parser'
import type { Dish, MenuDay } from '../../schema.ts'
import { WEEKDAYS, weekMonday } from '../lib/dates.ts'
import { fetchText } from '../lib/http.ts'
import { cleanName, courseFromHeading, tagsFromLabels } from '../lib/tags.ts'
import type { Source } from '../lib/source.ts'

type LdItem = { name: string; suitableForDiet?: string | string[]; offers?: { price?: string } }
type LdSection = { name: string; hasMenuItem?: LdItem[]; hasMenuSection?: LdSection[] }
type LdMenu = { '@type': string; name: string; hasMenuSection?: LdSection[] }

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

export const magdalene: Source = {
  college: 'magdalene',
  venue: 'ramsay-hall',
  source_url: 'https://viewthe.menu/lyzv',
  async fetch(ctx) {
    const index = parse(await fetchText('https://viewthe.menu/lyzv'))
    const monday = weekMonday(ctx.week)
    const option = index
      .querySelectorAll('.k10-menu-selector__option-name')
      .find((a) => /ramsay/i.test(a.text) && comDate(a.text) === monday)
    if (!option) return { days: [], note: `No Ramsay Hall menu listed for week commencing ${monday}.` }
    const guid = option.getAttribute('data-menu-identifier')
    const html = await fetchText(`https://menus.tenkites.com/magdalenecollege/webmenus?cl=true&mguid=${guid}`)
    const root = parse(html)

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

    const days: MenuDay[] = []
    const toDish = (it: LdItem, service: MenuDay['service']): Dish => {
      const name = cleanName(it.name)
      const diets = ([] as string[]).concat(it.suitableForDiet ?? []).map((u) => u.replace(/.*\//, '').replace(/Diet$/, ''))
      const price = it.offers?.price ? Number(it.offers.price) : undefined
      const course: Dish['course'] = service === 'brunch' ? 'other' : price !== undefined && price <= 1 ? 'side' : price !== undefined && price < 2 ? 'dessert' : courseFromHeading(name) === 'soup' ? 'soup' : 'main'
      return { name, tags: tagsFromLabels([...(labelsByName.get(name) ?? []), ...diets]), course, price_gbp: Number.isFinite(price) ? price : undefined }
    }
    for (const daySec of ld.hasMenuSection ?? []) {
      const idx = WEEKDAYS.indexOf(daySec.name.trim().toLowerCase())
      if (idx < 0) continue
      const date = ctx.dates[idx]
      const direct = daySec.hasMenuItem ?? []
      if (direct.length) days.push({ date, service: 'lunch', items: direct.map((i) => toDish(i, 'lunch')) })
      for (const sub of daySec.hasMenuSection ?? []) {
        const service = serviceOf(sub.name)
        if (!service) continue
        const items = (sub.hasMenuItem ?? []).map((i) => toDish(i, service))
        const note = /theme night/i.test(sub.name) ? sub.name.replace(/\s*\d.*$/, '') : undefined
        if (items.length) days.push({ date, service, items, ...(note ? { note } : {}) })
      }
    }
    return { days, note: `Source menu "${option.text.trim()}" on viewthe.menu. Course is inferred from price (sides ≤ £1, desserts < £2).` }
  },
}
