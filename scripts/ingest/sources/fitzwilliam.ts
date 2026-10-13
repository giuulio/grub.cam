import { parse } from 'node-html-parser'
import { addDays, dateNear, longDate } from '../lib/dates.ts'
import type { DocRef, DocSource } from '../lib/docs.ts'
import { fetchText } from '../lib/http.ts'

export const FITZ_PAGE = 'https://www.fitz.cam.ac.uk/cafe-bar-and-buttery'

/** The page's menu PDFs ("Menu from 12 October", "…the menu for the Formal 14 October…") that aren't over yet. */
export function fitzDocuments(html: string, today: string): DocRef[] {
  const refs = new Map<string, DocRef>()
  for (const a of parse(html).querySelectorAll('a')) {
    const href = a.getAttribute('href')
    const text = a.text.replace(/\s+/g, ' ').trim()
    if (!href || !/\.pdf(\?|$)/i.test(href) || !/menu/i.test(text)) continue
    const date = dateNear(text, today)
    if (!date) continue
    const formal = /formal/i.test(text)
    if ((formal ? date : addDays(date, 6)) < today) continue
    const url = new URL(href, FITZ_PAGE).href
    if (refs.has(url)) continue
    refs.set(url, formal
      ? { key: url, url, kind: 'pdf', label: `Fitzwilliam's Formal Hall menu for ${longDate(date)}`, hint: `Give it as "${date} formal", the courses under "## Starter", "## Main course" and "## Dessert"; a pre-ordered alternative keeps its note ("| pre-ordered vegetarian alternative"). If it lists more formal nights, give each.` }
      : { key: url, url, kind: 'pdf', label: `Fitzwilliam's buttery menu for the week commencing ${longDate(date)}` })
  }
  return [...refs.values()]
}

/** The buttery's weekly menu, and Formal Hall's, as PDFs on the College's page (weekly; filenames aren't dated, the link text is). */
export const fitzwilliam: DocSource = {
  async documents({ today }) {
    return fitzDocuments(await fetchText(FITZ_PAGE), today)
  },
  guide:
    'Each weekday has a lunch and a dinner list. A meal whose whole entry is a word like "Brunch" or "Pie night" goes on that meal\'s line as a note, with what it says beneath as one dish ("2026-10-17 brunch | Brunch" then "Brunch"); Saturday and Sunday lunch saying "Brunch" are that day\'s brunch. (v) is vegetarian, written (V); "(vegan)" stays as it is.',
}
