import { FULL_TERMS } from '../../../src/lib/time/termDates.ts'
import type { Dish, MenuDay } from '../../schema.ts'
import { addDays, fromISODate, isoWeek, WEEKDAYS } from '../lib/dates.ts'
import { fetchJson } from '../lib/http.ts'
import { cleanName, tagsFromLabels } from '../lib/tags.ts'
import type { Adapter } from '../lib/source.ts'

const OUTLET = 17260

// Groups carry no dates, only names like "MICHAELMAS 2026 WEEK 1". Downing's weeks run Mon–Sun and week 1 is the
// week Full Term starts in (Tue 6 Oct 2026 ⇒ WEEK 1 = Mon 5 Oct), so WEEK n starts n−1 weeks after that Monday.
function groupMonday(name: string): string | undefined {
  const m = name.match(/^(.+?)\s+WEEK\s*(\d+)\b/i)
  const term = m && FULL_TERMS.find((t) => t.name.toLowerCase() === m[1].trim().toLowerCase())
  if (!term) return undefined
  const termMonday = addDays(term.start, -((fromISODate(term.start).getUTCDay() + 6) % 7))
  return addDays(termMonday, 7 * (Number(m[2]) - 1))
}

type Outlet = { menu_groups: { id: number; name: string; is_active: boolean }[] }
type Recipe = { id: number; name: string; tags: { name: string; group: string }[] }
type Group = { menus: { id: number; name: string; recipes: Recipe[]; config: { widgets: { class: string; config: { id: number } }[] } | null }[] }

export const downing: Adapter = {
  async fetch(ctx) {
    const outlet = await fetchJson<Outlet>(`https://kitchen.kafoodle.com/api/wba/v1/data/${OUTLET}`)
    const weekly = outlet.menu_groups.filter((g) => g.is_active && /WEEK\s*\d+/i.test(g.name))
    const group = weekly.find((g) => { const mon = groupMonday(g.name); return mon && isoWeek(mon) === ctx.week })
    if (!group) return { days: [], note: `No Kafoodle menu group for ${ctx.week} (published: ${weekly.map((g) => `"${g.name}"`).join(', ') || 'none'}).` }
    const monday = groupMonday(group.name)!
    // Kafoodle hides each day's menu once that weekday has passed (menu.weekdays), so later runs return fewer days.
    const data = await fetchJson<Group>(`https://kitchen.kafoodle.com/api/wba/v1/data/${OUTLET}/search/${group.id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    const days: MenuDay[] = []
    for (const menu of data.menus) {
      const dayIdx = WEEKDAYS.findIndex((w) => menu.name.toLowerCase().includes(w))
      if (dayIdx < 0) continue
      const date = addDays(monday, dayIdx)
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
