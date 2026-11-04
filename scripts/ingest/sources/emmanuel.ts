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
  // One am/pm for the range ("11:45 – 1:30 pm"): it's the end's, and the start is the same half of the day only when
  // that doesn't put it after the end
  const minutes = (s: string, pm: boolean) => { const [h, m] = s.split(':').map(Number); return (h % 12 + (pm ? 12 : 0)) * 60 + m }
  const hhmm = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
  const pm = serving?.[3].toLowerCase() === 'pm'
  const end = serving ? minutes(serving[2], pm) : 0
  const start = serving ? (minutes(serving[1], pm) <= end ? minutes(serving[1], pm) : minutes(serving[1], false)) : 0
  const note = serving ? `${service === 'dinner' ? 'Dinner' : service[0].toUpperCase() + service.slice(1)} ${hhmm(start)}–${hhmm(end)}` : undefined
  return [MenuDay.parse({ date, service, items, ...(note ? { note } : {}) })]
}

export const emmanuel: Adapter = {
  async fetch() { return { days: emmanuelMenu(await fetchText(EMMANUEL_MENU)) } },
}
