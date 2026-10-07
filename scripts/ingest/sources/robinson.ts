import { parse } from 'node-html-parser'
import type { Dish, MenuDay } from '../../schema.ts'
import { addDays, parseLongDate } from '../lib/dates.ts'
import { fetchText } from '../lib/http.ts'
import { cleanName, courseFromHeading, tagsFromLabels } from '../lib/tags.ts'
import type { Source } from '../lib/source.ts'

export const robinson: Source = {
  college: 'robinson',
  venue: 'garden-restaurant-dining-hall',
  source_url: 'https://www.robinson.cam.ac.uk/college-life/garden-restaurant-menu',
  async fetch(ctx) {
    const days: MenuDay[] = []
    const seen = new Set<string>()
    // The server's ?date= is off by one (returns the following day), so request date-1 and trust the heading.
    for (const date of ctx.dates) {
      const html = await fetchText(`https://www.robinson.cam.ac.uk/college-life/garden-restaurant-menu?date=${addDays(date, -1)}`)
      const root = parse(html)
      const heading = root.querySelectorAll('h3').find((h) => /Menus for/i.test(h.text))
      const shown = heading ? parseLongDate(heading.text, Number(date.slice(0, 4))) : undefined
      if (!shown || seen.has(shown)) continue
      seen.add(shown)
      for (const col of root.querySelectorAll('.menuColumn')) {
        const title = col.querySelector('h3')?.text.toLowerCase() ?? ''
        const service: MenuDay['service'] | undefined = /lunch/.test(title) ? 'lunch' : /dinner/.test(title) ? 'dinner' : /brunch/.test(title) ? 'brunch' : /breakfast/.test(title) ? 'breakfast' : undefined
        if (!service) continue
        const items: Dish[] = []
        for (const block of col.querySelectorAll('.menuItem')) {
          const category = block.querySelector('strong')?.text.trim() ?? ''
          // Items are separated by <br/><br/>; within an item: name <br/><em>price</em> <img alt=tag/>...
          const chunks = block.innerHTML.split(/<br\s*\/?>\s*<br\s*\/?>/i)
          for (const chunk of chunks) {
            const frag = parse(chunk)
            frag.querySelectorAll('strong').forEach((s) => s.remove())
            const priceText = frag.querySelector('em')?.text ?? ''
            frag.querySelectorAll('em').forEach((e) => e.remove())
            const alts = frag.querySelectorAll('img').map((i) => i.getAttribute('alt') ?? '')
            frag.querySelectorAll('img').forEach((i) => i.remove())
            const name = cleanName(frag.text)
            if (!name || name.length < 3) continue
            const prices = [...priceText.replace(/&pound;/g, '£').matchAll(/£\s*(\d+(?:\.\d{1,2})?)/g)].map((m) => Number(m[1]))
            items.push({
              name,
              tags: tagsFromLabels(alts),
              price_gbp: prices[0],
              price_text: prices.length === 2 ? `£${prices[0].toFixed(2)} member / £${prices[1].toFixed(2)} non-member` : undefined,
              course: courseFromHeading(category),
            })
          }
        }
        if (items.length) days.push({ date: shown, service, items })
      }
    }
    return { days, note: 'First price is for Robinson members, second for non-members.' }
  },
}
