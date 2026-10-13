import { parse } from 'node-html-parser'
import type { DocRef, DocSource } from '../lib/docs.ts'
import { fetchText } from '../lib/http.ts'

export const CATZ_PAGE = 'https://www.caths.cam.ac.uk/students/college-facilities-and-forms/catering-for-our-community/cafeteria'

/** The page's cycle: "Week 1 Lunch Dinner Weekends", …, each a PDF dated inside ("(12.10/09.11)": the Mondays it's served). */
export function catzDocuments(html: string): DocRef[] {
  const refs: DocRef[] = []
  for (const a of parse(html).querySelectorAll('a')) {
    const href = a.getAttribute('href') ?? ''
    const meal = a.text.trim().toLowerCase()
    if (!/\.pdf(\?|$)/i.test(href) || !['lunch', 'dinner', 'weekends'].includes(meal)) continue
    const week = href.match(/(\d)[-_]?(?:lunch|dinner|menus)|(?:weekly|dinner)-(\d)/i)
    const n = week?.[1] ?? week?.[2]
    const url = new URL(href, CATZ_PAGE).href
    const what = meal === 'weekends' ? 'weekend brunch and dinner' : `weekday ${meal}`
    refs.push({ key: url, url, kind: 'pdf', label: `St Catharine's cafeteria menu, ${what}${n ? `, week ${n} of its four-week cycle` : ''}` })
  }
  return refs
}

/** A four-week cycle of lunch, dinner and weekend PDFs on the cafeteria page, read once a term (each dated inside). */
export const stCatharines: DocSource = {
  async documents() {
    return catzDocuments(await fetchText(CATZ_PAGE))
  },
  guide:
    'Its heading gives the Mondays of the weeks this menu is served, day and month ("(12.10/09.11)" is the weeks of 12 October and 9 November, this academic year): give every day for each of those weeks. Each day has three counters: write each counter\'s dish with its counter after it ("Pulled pork burger (Counter 1)"), then its sides, one a line, under "## Sides". Tag only what a dish\'s name says: there\'s no key to the codes.',
}
