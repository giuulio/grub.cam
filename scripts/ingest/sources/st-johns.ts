import { parse } from 'node-html-parser'
import type { Dish, MenuDay } from '../../schema.ts'
import { parseLongDate } from '../lib/dates.ts'
import { fetchText } from '../lib/http.ts'
import { cleanName, courseFromHeading, tagsFromLabels } from '../lib/tags.ts'
import type { Adapter } from '../lib/source.ts'

export const stJohns: Adapter = {
  async fetch(ctx) {
    const html = await fetchText('https://menu.joh.cam/')
    const root = parse(html)
    const days: MenuDay[] = []
    const year = Number(ctx.today.slice(0, 4))
    for (const day of root.querySelectorAll('.weekday')) {
      const h2 = day.querySelector('h2')
      if (!h2) continue
      let date = parseLongDate(cleanName(h2.text), year)
      if (!date) continue
      // rolling 7 days may cross a year boundary
      if (date < ctx.today && ctx.today.slice(5) > '11') date = parseLongDate(cleanName(h2.text), year + 1) ?? date
      for (const acc of day.querySelectorAll('.accordion-item')) {
        const title = acc.querySelector('.accordion-header span')?.text.trim().toLowerCase() ?? ''
        const service: MenuDay['service'] | undefined = /lunch/.test(title) ? 'lunch' : /dinner|supper/.test(title) ? 'dinner' : /brunch/.test(title) ? 'brunch' : /breakfast/.test(title) ? 'breakfast' : undefined
        if (!service) continue
        const items: Dish[] = []
        const content = acc.querySelector('.accordion-content')
        if (!content) continue
        let course = ''
        for (const el of content.querySelectorAll('h2, p.font-semibold')) {
          if (el.tagName === 'H2') {
            course = el.text.trim()
            continue
          }
          const name = cleanName(el.text)
          if (!name) continue
          // Tag/allergen row is the sibling block right after the dish paragraph's wrapper
          const wrapper = el.parentNode?.parentNode
          const tagSpans = wrapper?.querySelectorAll('span.rounded-sm').map((s) => s.text.trim()) ?? []
          items.push({ name, tags: tagsFromLabels(tagSpans), course: courseFromHeading(course) })
        }
        if (items.length) days.push({ date, service, items })
      }
    }
    return { days }
  },
}
