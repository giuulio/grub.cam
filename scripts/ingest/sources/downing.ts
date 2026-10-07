import type { Dish, MenuDay } from '../../schema.ts'
import { WEEKDAYS } from '../lib/dates.ts'
import { fetchJson } from '../lib/http.ts'
import { cleanName, tagsFromLabels } from '../lib/tags.ts'
import type { Source } from '../lib/source.ts'

const OUTLET = 17260
type Outlet = { menu_groups: { id: number; name: string; is_active: boolean }[] }
type Recipe = { id: number; name: string; tags: { name: string; group: string }[] }
type Group = { menus: { id: number; name: string; recipes: Recipe[]; config: { widgets: { class: string; config: { id: number } }[] } | null }[] }

export const downing: Source = {
  college: 'downing',
  venue: 'servery-great-hall',
  source_url: `https://wba.kafoodle.com/${OUTLET}`,
  async fetch(ctx) {
    const outlet = await fetchJson<Outlet>(`https://kitchen.kafoodle.com/api/wba/v1/data/${OUTLET}`)
    // Weekly groups are named like "MICHAELMAS 2026 WEEK 1"; take the active one with the highest id (newest).
    const weekly = outlet.menu_groups.filter((g) => g.is_active && /WEEK\s*\d+/i.test(g.name)).sort((a, b) => b.id - a.id)
    if (!weekly.length) return { days: [], note: 'No weekly menu group published.' }
    const group = weekly[0]
    const data = await fetchJson<Group>(`https://kitchen.kafoodle.com/api/wba/v1/data/${OUTLET}/search/${group.id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    const days: MenuDay[] = []
    for (const menu of data.menus) {
      const dayIdx = WEEKDAYS.findIndex((w) => menu.name.toLowerCase().includes(w))
      if (dayIdx < 0) continue
      const date = ctx.dates[dayIdx]
      const isBrunch = /brunch/i.test(menu.name)
      const recipes = new Map(menu.recipes.map((r) => [r.id, r]))
      const order = menu.config?.widgets.filter((w) => w.class === 'dish').map((w) => w.config.id) ?? [...recipes.keys()]
      const items: Dish[] = order
        .map((id) => recipes.get(id))
        .filter((r): r is Recipe => !!r)
        .map((r) => ({
          name: cleanName(r.name),
          tags: tagsFromLabels(r.tags.filter((t) => t.group === 'Dietary').map((t) => t.name)),
        }))
      if (!items.length) continue
      if (isBrunch) days.push({ date, service: 'brunch', items })
      else if (dayIdx >= 5) days.push({ date, service: 'dinner', items })
      else {
        const note = 'Downing publishes one daily menu without separating lunch and dinner.'
        days.push({ date, service: 'lunch', items, note }, { date, service: 'dinner', items, note })
      }
    }
    return { days, note: `Kafoodle menu group "${group.name}". No prices published.` }
  },
}
