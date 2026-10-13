import { parse } from 'node-html-parser'
import type { Dish, MenuDay } from '../../schema.ts'
import type { DocSource } from '../lib/docs.ts'
import { fetchText } from '../lib/http.ts'
import { cleanName, tagsFromName } from '../lib/tags.ts'

export const NEWNHAM_PAGE = 'https://newn.cam.ac.uk/weekly-menus'

/** A day's last dish is its pudding when it reads like one (the page lists no courses). */
const PUDDING = /\b(cake|pudding|crumble|brownie|tiramisu|sponge|tart|mousse|cheesecake|roulade|trifle|ice cream|custard|flapjack|crème|creme|panna cotta|cookie|muffin|pie with custard|fruit salad|blondie|eton mess|profiteroles|sundae|pavlova|bakewell)\b/i

/**
 * The week's "Lunch menu" and "Dinner menu", each a block a day: `<time datetime="2026-10-12…">Monday - 12 October</time>`
 * and a paragraph a dish, "(Vegan) …" or "(V) …" in front. A day whose only line is "BRUNCH" has no menu to give.
 */
export function parseNewnham(html: string): MenuDay[] {
  const days: MenuDay[] = []
  for (const menu of parse(html).querySelectorAll('.menu-week-container')) {
    const title = menu.querySelector('h1')?.text ?? ''
    const service = /lunch/i.test(title) ? 'lunch' : /dinner/i.test(title) ? 'dinner' : undefined
    if (!service) continue
    for (const day of menu.querySelectorAll('.paragraph--type--day-menu')) {
      const date = day.querySelector('time')?.getAttribute('datetime')?.slice(0, 10)
      if (!date) continue
      const lines = day.querySelectorAll('p').map((p) => cleanName(p.text)).filter((l) => l && !/^brunch$/i.test(l))
      const items: Dish[] = lines.map((l) => ({ ...tagsFromName(l), course: 'main' }))
      if (items.length > 2 && PUDDING.test(items.at(-1)!.name)) items.at(-1)!.course = 'dessert'
      if (items.length) days.push({ date, service, items })
    }
  }
  if (!days.length) throw new Error('no dated lunch or dinner menus on the page')
  return days
}

/** One page with the week's lunch and dinner menus (weekly; https://newn.cam.ac.uk/todays-menu has today's alone). */
export const newnham: DocSource = {
  async documents() {
    const html = await fetchText(NEWNHAM_PAGE)
    const menus = parse(html).querySelectorAll('.menu-week-container').map((m) => m.outerHTML).join('\n')
    return [{ key: NEWNHAM_PAGE, url: NEWNHAM_PAGE, kind: 'text', text: menus || html, label: "Newnham's weekly lunch and dinner menus" }]
  },
  parse: (doc) => parseNewnham(doc.body ?? ''),
}
