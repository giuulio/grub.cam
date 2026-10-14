import { parse } from 'node-html-parser'
import type { Dish, MenuDay } from '../../schema.ts'
import { addDays } from '../lib/dates.ts'
import { fetchText } from '../lib/http.ts'
import { allergensFromLabels, cleanName, courseFromHeading, parsePrice, tagsFromLabels } from '../lib/tags.ts'
import type { Adapter } from '../lib/source.ts'

const EVENTS: [number, MenuDay['service']][] = [
  [1, 'lunch'],
  [2, 'dinner'],
]

/** Days ahead the College's own page offers (its datepicker's maxDate "+8W"). Past it, digiboard.php returns a menu
 * for any date (into 2035, checked 12 Oct 2026), which would keep discovery going for ever. */
export const JESUS_AHEAD = 56

export const jesus: Adapter = {
  async fetch(ctx) {
    const days: MenuDay[] = []
    for (const date of ctx.dates) {
      if (date > addDays(ctx.today, JESUS_AHEAD)) break
      for (const [eventId, baseService] of EVENTS) {
        const html = await fetchText(`https://apps.jesus.cam.ac.uk/foodmenuview/digiboard.php?event_id=${eventId}&date=${date}`)
        const root = parse(html)
        const heading = root.querySelector('h2')?.text.toLowerCase() ?? ''
        const service: MenuDay['service'] = /brunch/.test(heading) ? 'brunch' : baseService
        const items: Dish[] = []
        let course = ''
        for (const tr of root.querySelectorAll('table.fm-menu-courses tr')) {
          const h4 = tr.querySelector('h4')
          if (h4) {
            course = h4.text.trim()
            continue
          }
          if (!tr.classList.contains('fm-item')) continue
          const name = cleanName(tr.querySelector('.fm-item-label')?.text ?? '')
          if (!name) continue
          const reqs = tr.querySelectorAll('.fm-requirement').map((d) => d.getAttribute('title') ?? d.text)
          const soldOut = /sold.?out/i.test(tr.text)
          const allergens = allergensFromLabels(tr.querySelectorAll('.fm-allergen').map((d) => d.getAttribute('title') ?? d.text))
          items.push({
            name,
            tags: tagsFromLabels([...reqs, course]),
            price_gbp: parsePrice(tr.querySelector('.fm-item-price')?.text),
            course: courseFromHeading(course),
            ...(soldOut ? { sold_out: true } : {}),
            ...(allergens.length ? { allergens } : {}),
          })
        }
        if (items.length) days.push({ date, service, items })
      }
    }
    return { days }
  },
}
