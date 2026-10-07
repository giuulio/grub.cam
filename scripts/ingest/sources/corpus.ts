import { parse } from 'node-html-parser'
import type { Dish, MenuDay } from '../../schema.ts'
import { fetchText } from '../lib/http.ts'
import { cleanName, courseFromHeading, parsePrice, tagsFromLabels } from '../lib/tags.ts'
import type { Source } from '../lib/source.ts'

const SERVICES: Record<string, MenuDay['service']> = { breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner', brunch: 'brunch' }

export const corpus: Source = {
  college: 'corpus-christi',
  venue: 'cafeteria',
  source_url: 'https://www.corpus.cam.ac.uk/foodmenu/',
  async fetch(ctx) {
    const days: MenuDay[] = []
    for (const date of ctx.dates) {
      const html = await fetchText(`https://www.corpus.cam.ac.uk/foodmenu/menu/?reference=1&date=${date}`)
      const root = parse(html)
      for (const h3 of root.querySelectorAll('.accordion > h3')) {
        const title = h3.querySelector('.accordion-title')?.text.trim().toLowerCase() ?? ''
        const service = SERVICES[title.split(/\s+/)[0]]
        if (!service) continue
        const panelId = h3.querySelector('button')?.getAttribute('aria-controls')
        const panel = panelId ? root.querySelector(`#${panelId}`) : null
        if (!panel) continue
        const items: Dish[] = []
        let category = ''
        for (const tr of panel.querySelectorAll('tbody tr')) {
          const cat = tr.querySelector('.hide-label h3')
          if (cat) {
            category = cat.text.trim()
            continue
          }
          const cells = tr.querySelectorAll('td').map((td) => cleanName(td.text))
          if (!cells[0]) continue
          const tags = tagsFromLabels([category])
          items.push({ name: cells[0].replace(/\.$/, ''), tags, price_gbp: parsePrice(cells[1]), course: courseFromHeading(category) })
        }
        if (items.length) days.push({ date, service, items })
      }
    }
    return { days }
  },
}
