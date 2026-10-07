import { parse } from 'node-html-parser'
import type { Dish, MenuDay } from '../../schema.ts'
import { WEEKDAYS, addDays, weekMonday } from '../lib/dates.ts'
import { fetchText } from '../lib/http.ts'
import { cleanName, parsePrice } from '../lib/tags.ts'
import type { Source } from '../lib/source.ts'

export const darwin: Source = {
  college: 'darwin',
  venue: 'servery',
  source_url: 'https://www.darwin.cam.ac.uk/dine/weekly-menu/',
  async fetch(ctx) {
    const html = await fetchText('https://www.darwin.cam.ac.uk/dine/weekly-menu/')
    const root = parse(html)
    const days: MenuDay[] = []
    // Tabs are id="menus-content--<ISO week number>"; the current tab is this week.
    for (const content of root.querySelectorAll('.menus-content')) {
      const wk = content.getAttribute('id')?.match(/--(\d+)$/)?.[1]
      if (!wk) continue
      const weekId = `${ctx.week.slice(0, 4)}-W${wk.padStart(2, '0')}`
      if (weekId !== ctx.week) continue
      const monday = weekMonday(weekId)
      let date = ''
      for (const el of content.querySelectorAll('h3, table')) {
        if (el.tagName === 'H3') {
          const idx = WEEKDAYS.indexOf(el.text.trim().toLowerCase())
          date = idx >= 0 ? addDays(monday, idx) : ''
          continue
        }
        if (!date) continue
        const title = el.querySelector('thead th')?.text.trim().toLowerCase() ?? ''
        const service: MenuDay['service'] | undefined = /lunch/.test(title) ? 'lunch' : /dinner/.test(title) ? 'dinner' : /brunch/.test(title) ? 'brunch' : undefined
        if (!service) continue
        const items: Dish[] = []
        for (const tr of el.querySelectorAll('tbody tr')) {
          const tds = tr.querySelectorAll('td')
          const name = cleanName(tds[0]?.text ?? '')
          if (!name) continue
          const price = parsePrice(tds[2]?.text)
          const sides = name.match(/^sides?\s*[:\-–]\s*(.+)$/i)
          if (sides) {
            for (const s of sides[1].split(/,\s*/)) {
              const sn = cleanName(s)
              if (sn) items.push({ name: sn, tags: [], course: 'side', price_gbp: price })
            }
          } else items.push({ name, tags: [], course: 'main', price_gbp: price })
        }
        if (items.length) days.push({ date, service, items })
      }
    }
    return { days, note: 'Darwin publishes allergen codes but no diet labels; member prices shown.' }
  },
}
