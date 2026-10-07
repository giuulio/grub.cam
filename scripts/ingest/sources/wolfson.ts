import { parse } from 'node-html-parser'
import type { Dish, MenuDay } from '../../schema.ts'
import { parseLongDate } from '../lib/dates.ts'
import { fetchText } from '../lib/http.ts'
import { cleanName, courseFromHeading, parsePrice, tagsFromLabels } from '../lib/tags.ts'
import type { Adapter } from '../lib/source.ts'

export const wolfson: Adapter = {
  async fetch(ctx) {
    const html = await fetchText('https://www.wolfson.cam.ac.uk/food/cafeteria-menus')
    const root = parse(html)
    const days: MenuDay[] = []
    const content = root.querySelector('.food-menu .view-content')
    if (!content) return { days }
    let date = ''
    for (const el of content.childNodes) {
      if (el.nodeType !== 1) continue
      const node = el as unknown as ReturnType<typeof parse>
      if (node.tagName === 'H3') {
        date = parseLongDate(node.text, Number(ctx.today.slice(0, 4))) ?? ''
        continue
      }
      if (!date || node.tagName !== 'UL') continue
      for (const li of node.querySelectorAll(':scope > li')) {
        const title = li.querySelector('.collapse__top h4')?.text.trim().toLowerCase() ?? ''
        const service: MenuDay['service'] | undefined = /breakfast/.test(title) ? 'breakfast' : /brunch/.test(title) ? 'brunch' : /lunch/.test(title) ? 'lunch' : /dinner|supper/.test(title) ? 'dinner' : undefined
        if (!service) continue
        const items: Dish[] = []
        for (const item of li.querySelectorAll('.single-food-menu-item')) {
          const spans = item.querySelectorAll('h4 span').map((s) => cleanName(s.text))
          const category = spans[0] ?? ''
          const name = spans[1] || category
          if (!name) continue
          const prices = item.querySelectorAll('.food-menu__prices > span')
          const byLabel: Record<string, number | undefined> = {}
          for (const p of prices) {
            const [label, val] = p.querySelectorAll('span').map((s) => s.text.trim())
            byLabel[label?.toLowerCase() ?? ''] = parsePrice(val)
          }
          const student = byLabel.student
          const others = byLabel.others
          const course: Dish['course'] = service === 'breakfast' || service === 'brunch' ? 'other' : courseFromHeading(category || name)
          const tags = tagsFromLabels([/plant.?based|vegan/i.test(name) ? 'vegan' : ''])
          items.push({
            name,
            tags,
            course: course === 'other' && /main|dish of the day/i.test(category) ? 'main' : course,
            price_gbp: student,
            price_text: student !== undefined && others !== undefined ? `£${student.toFixed(2)} student / £${others.toFixed(2)} others` : undefined,
          })
        }
        if (items.length) days.push({ date, service, items })
      }
    }
    return { days, note: 'Student price shown first; "others" price second. Wolfson labels allergens but not diets, so only explicitly plant-based/vegan dish names are tagged.' }
  },
}
