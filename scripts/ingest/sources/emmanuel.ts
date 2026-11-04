import { parse } from 'node-html-parser'
import { MenuDay, type Dish } from '../../schema.ts'
import { allergensFromLabels, cleanName, courseFromHeading, parsePrice, tagsFromName } from '../lib/tags.ts'
import { parseLongDate } from '../lib/dates.ts'
import { fetchText } from '../lib/http.ts'
import type { Adapter } from '../lib/source.ts'

export const EMMANUEL_MENU = 'https://catering.emma.cam.ac.uk/'

/** The public display repeats its sections for responsive layouts: read only the first menu grid. */
export function emmanuelMenu(html: string): MenuDay[] {
  const main = parse(html).querySelector('main')
  if (!main) throw new Error('Emmanuel menu has no main content')
  const dateText = main.querySelector('p')?.text.trim() ?? ''
  const date = parseLongDate(dateText.replace(/^\w+,\s*/, ''), Number(dateText.match(/\b\d{4}\b/)?.[0]))
  const heading = main.querySelector('h1')?.text.toLowerCase() ?? ''
  const service = /breakfast/.test(heading) ? 'breakfast' : /brunch/.test(heading) ? 'brunch'
    : /lunch|midday/.test(heading) ? 'lunch' : /evening|dinner|supper/.test(heading) ? 'dinner' : undefined
  const grid = main.querySelector('.grid')
  if (!grid?.querySelector('section li')) return [] // a display between meals can legitimately have no menu
  if (!date || !service) throw new Error('Emmanuel published dishes without a recognised date and meal')
  const items: Dish[] = []
  for (const section of grid.querySelectorAll('section')) {
    const course = courseFromHeading(section.querySelector('h2')?.text ?? '')
    for (const li of section.querySelectorAll(':scope > ul > li')) {
      const line = li.querySelector(':scope > p')
      const spans = line?.querySelectorAll(':scope > span') ?? []
      const { name, tags } = tagsFromName(cleanName(spans[0]?.text ?? ''))
      if (!name) continue
      const price = parsePrice(spans[1]?.text)
      const allergens = allergensFromLabels(li.querySelectorAll('ul[aria-label="Allergens"] > li').map((a) => a.text))
      items.push({ name, tags, course, ...(price === undefined ? {} : { price_gbp: price }), ...(allergens.length ? { allergens } : {}) })
    }
  }
  if (!items.length) return []
  const serving = main.querySelector('h1')?.parentNode?.text.match(/Serving\s+(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})\s*(am|pm)/i)
  const time = (s: string) => { const [h, m] = s.split(':'); return `${String(Number(h) % 12 + (serving?.[3].toLowerCase() === 'pm' ? 12 : 0)).padStart(2, '0')}:${m}` }
  const note = serving ? `${service === 'dinner' ? 'Dinner' : service[0].toUpperCase() + service.slice(1)} ${time(serving[1])}–${time(serving[2])}` : undefined
  return [MenuDay.parse({ date, service, items, ...(note ? { note } : {}) })]
}

export const emmanuel: Adapter = {
  async fetch() { return { days: emmanuelMenu(await fetchText(EMMANUEL_MENU)) } },
}
