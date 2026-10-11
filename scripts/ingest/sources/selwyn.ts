import { parse } from 'node-html-parser'
import type { Dish, MenuDay } from '../../schema.ts'
import { parseLongDate } from '../lib/dates.ts'
import { fetchText } from '../lib/http.ts'
import { cleanName, tagsFromName } from '../lib/tags.ts'
import type { Adapter } from '../lib/source.ts'

/** "Brunch 11.00am – 1.00pm": the block's first line at weekends names the meal and its hours. */
const MEAL_HOURS = /^(breakfast|brunch|lunch|dinner|supper)\b.*\d/i

/** One day's page: a block per meal, numbered mains then a line of sides; at weekends the "Lunch" block is brunch. */
export function parseSelwynDay(html: string, date: string): MenuDay[] {
  const root = parse(html)
  const hdr = root.querySelector('#menuhdr')?.text ?? ''
  if (parseLongDate(hdr, Number(date.slice(0, 4))) !== date) return []
  const days: MenuDay[] = []
  for (const block of root.querySelectorAll('.hallmenu')) {
    const title = block.querySelector('.submenuhdr')?.text.trim().toLowerCase() ?? ''
    let service: MenuDay['service'] | undefined = /lunch/.test(title) ? 'lunch' : /dinner|supper/.test(title) ? 'dinner' : /brunch/.test(title) ? 'brunch' : /breakfast/.test(title) ? 'breakfast' : undefined
    if (!service) continue
    block.querySelector('.submenuhdr')?.remove()
    const lines = block.innerHTML
      .split(/<br\s*\/?>/i)
      .map((l) => cleanName(parse(l).text))
      .filter(Boolean)
    const hours = lines[0]?.match(MEAL_HOURS)
    if (hours) {
      lines.shift()
      if (/brunch/i.test(hours[1])) service = 'brunch'
    }
    const items: Dish[] = []
    for (const line of lines) {
      const main = line.match(/^(?:\d+\.|special:)\s*(.+)$/i)
      if (main) {
        const { name, tags } = tagsFromName(main[1])
        items.push({ name, tags, course: 'main' })
      } else {
        // trailing comma-separated line: sides to the mains, or the brunch counter
        for (const side of line.split(/,\s*/)) {
          const { name, tags } = tagsFromName(side)
          if (name) items.push({ name: name[0].toUpperCase() + name.slice(1), tags, course: service === 'brunch' ? 'other' : 'side' })
        }
      }
    }
    if (items.length) days.push({ date, service, items })
  }
  return days
}

export const selwyn: Adapter = {
  async fetch(ctx) {
    const days: MenuDay[] = []
    for (const date of ctx.dates) days.push(...parseSelwynDay(await fetchText(`https://www.sel.cam.ac.uk/current-members/hall-menu?menu_date=${date}`), date))
    return { days, note: 'Menus are subject to change (College).' }
  },
}
