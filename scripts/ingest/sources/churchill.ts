import { parse } from 'node-html-parser'
import type { Dish, MenuDay } from '../../schema.ts'
import { dateNear } from '../lib/dates.ts'
import type { DocSource } from '../lib/docs.ts'
import { fetchText } from '../lib/http.ts'
import { cleanName, tagsFromName } from '../lib/tags.ts'

export const CHURCHILL_PAGE = 'https://www.chu.cam.ac.uk/about/campus/dining-at-college/lunch-and-dinner-menu/'

/** The page's menu: "Week commencing: 12th October 2026", then a table a day; what's around it (news, links) isn't. */
export function churchillMenu(html: string): string {
  const start = html.search(/Week commencing/i)
  const end = html.lastIndexOf('</table>')
  if (start < 0 || end < start) throw new Error('no "Week commencing" and menu tables on the page')
  return html.slice(start, end + '</table>'.length)
}

/**
 * One table a day: "Tuesday 13th Oct" | Lunch | Dinner, then the Dining Hall's hours and each meal's dishes, a
 * "* " line each. "Today's Special: Churchill Trattoria" is a dish, "(today's special)". Later days stay empty
 * until they're posted; the day before can stay too, as the last table.
 */
export function parseChurchill(menu: string, today: string): MenuDay[] {
  const root = parse(menu)
  const week = dateNear(root.text.match(/Week commencing:?\s*([^\n<]+)/i)?.[1] ?? '', today)
  if (!week) throw new Error('no week commencing date')
  const days: MenuDay[] = []
  let tables = 0
  for (const table of root.querySelectorAll('table')) {
    const [head, body] = table.querySelectorAll('tr')
    const heads = head?.querySelectorAll('td') ?? []
    const date = heads.length ? dateNear(heads[0].text, week) : undefined
    if (!date || !body) continue
    tables++
    const cells = body.querySelectorAll('td')
    heads.forEach((h, i) => {
      const service = /lunch/i.test(h.text) ? 'lunch' : /dinner/i.test(h.text) ? 'dinner' : undefined
      if (!service || !cells[i]) return
      const items: Dish[] = []
      for (const line of cells[i].innerHTML.split(/<br\s*\/?>/i)) {
        const text = cleanName(parse(line).text.replace(/^\s*\*\s*/, ''))
        if (!text) continue
        const special = text.match(/^today.s special:\s*(.+)$/i)
        const { name, tags } = tagsFromName(special ? `${special[1]} (today's special)` : text)
        items.push({ name, tags })
      }
      // A cell that only says "Brunch" (Saturday's) names the meal without its dishes
      if (items.length && !(items.length === 1 && /^brunch$/i.test(items[0].name))) days.push({ date, service, items })
    })
  }
  if (!tables) throw new Error('no dated day tables')
  return days
}

/** One page, a table a day for the week, filled in day by day (Cloudflare in front, plain fetches answered). */
export const churchill: DocSource = {
  async documents() {
    return [{ key: CHURCHILL_PAGE, url: CHURCHILL_PAGE, kind: 'text', text: churchillMenu(await fetchText(CHURCHILL_PAGE)), label: "Churchill's lunch and dinner menu page" }]
  },
  parse: (doc, { today }) => parseChurchill(doc.body ?? '', today),
}
