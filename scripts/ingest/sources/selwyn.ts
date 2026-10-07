import { parse } from 'node-html-parser'
import type { Dish, MenuDay } from '../../schema.ts'
import { parseLongDate } from '../lib/dates.ts'
import { fetchText } from '../lib/http.ts'
import { cleanName, tagsFromName } from '../lib/tags.ts'
import type { Adapter } from '../lib/source.ts'

export const selwyn: Adapter = {
  async fetch(ctx) {
    const days: MenuDay[] = []
    for (const date of ctx.dates) {
      const html = await fetchText(`https://www.sel.cam.ac.uk/current-members/hall-menu?menu_date=${date}`)
      const root = parse(html)
      const hdr = root.querySelector('#menuhdr')?.text ?? ''
      const shown = parseLongDate(hdr, Number(date.slice(0, 4)))
      if (shown !== date) continue
      for (const block of root.querySelectorAll('.hallmenu')) {
        const title = block.querySelector('.submenuhdr')?.text.trim().toLowerCase() ?? ''
        const service: MenuDay['service'] | undefined = /lunch/.test(title) ? 'lunch' : /dinner|supper/.test(title) ? 'dinner' : /brunch/.test(title) ? 'brunch' : /breakfast/.test(title) ? 'breakfast' : undefined
        if (!service) continue
        block.querySelector('.submenuhdr')?.remove()
        const lines = block.innerHTML
          .split(/<br\s*\/?>/i)
          .map((l) => cleanName(parse(l).text))
          .filter(Boolean)
        const items: Dish[] = []
        for (const line of lines) {
          const numbered = line.match(/^\d+\.\s*(.+)$/)
          if (numbered) {
            const { name, tags } = tagsFromName(numbered[1])
            items.push({ name, tags, course: 'main' })
          } else {
            // trailing comma-separated sides line
            for (const side of line.split(/,\s*/)) {
              const { name, tags } = tagsFromName(side)
              if (name) items.push({ name: name[0].toUpperCase() + name.slice(1), tags, course: 'side' })
            }
          }
        }
        if (items.length) days.push({ date, service, items })
      }
    }
    return { days, note: 'Menus are subject to change (College).' }
  },
}
