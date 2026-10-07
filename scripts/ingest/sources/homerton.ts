import type { Dish, MenuDay } from '../../schema.ts'
import { fetchJson } from '../lib/http.ts'
import { cleanName, tagsFromName } from '../lib/tags.ts'
import type { Adapter } from '../lib/source.ts'

type Item = { name: string; allergens: string[]; price?: string }
type Week = { meta: { weekOffset: number; start: string; end: string }; days: { date: string; weekday: string; breakfast: Item[]; lunch: Item[]; dinner: Item[] }[] }

const toDish = (it: Item): Dish => {
  const { name, tags } = tagsFromName(cleanName(it.name ?? ''))
  const price = it.price ? Number(it.price) : undefined
  return { name, tags, price_gbp: Number.isFinite(price) ? price : undefined }
}

export const homerton: Adapter = {
  async fetch(ctx) {
    const days: MenuDay[] = []
    // offset 0 = rest of this week, 1..3 = following weeks; collect all that overlap the requested week
    for (let offset = 0; offset <= 3; offset++) {
      let w: Week
      try {
        w = await fetchJson<Week>(`https://www.homerton.cam.ac.uk/api/cafeteria-menu?weekOffset=${offset}`)
      } catch {
        break
      }
      for (const d of w.days) {
        const date = d.date.slice(0, 10)
        if (!ctx.dates.includes(date)) continue
        for (const service of ['breakfast', 'lunch', 'dinner'] as const) {
          const items = (d[service] ?? []).map(toDish).filter((x) => x.name)
          if (items.length) days.push({ date, service, items })
        }
      }
      if (w.days.length && w.days.at(-1)!.date.slice(0, 10) > ctx.dates[6]) break
    }
    return { days, note: 'Prices are University-card (member) prices.' }
  },
}
