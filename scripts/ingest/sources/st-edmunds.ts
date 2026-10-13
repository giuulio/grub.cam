import { parse } from 'node-html-parser'
import { addDays, dateNear, longDate } from '../lib/dates.ts'
import { pageText, type DocRef, type DocSource } from '../lib/docs.ts'
import { fetchText } from '../lib/http.ts'

export const EDDIES_PAGE = 'https://my.st-edmunds.cam.ac.uk/category/menus/'

/** Each "Weekly Menus – Week Commencing 12th October" post still current: its text (the week's time changes) and its PDFs. */
export function eddiesDocuments(html: string, today: string): DocRef[] {
  const refs: DocRef[] = []
  for (const post of parse(html).querySelectorAll('article')) {
    const content = post.querySelector('.entry-content') ?? post
    const text = pageText(content.innerHTML)
    const week = text.match(/week\s+commencing\s+([^\n]+)/i)
    const monday = week ? dateNear(week[1], today) : undefined
    const pdfs = [...new Set(content.querySelectorAll('a').map((a) => a.getAttribute('href') ?? '').filter((h) => /\.pdf(\?|$)/i.test(h)))].map((h) => new URL(h, EDDIES_PAGE).href)
    if (!monday || !pdfs.length || addDays(monday, 6) < today) continue
    refs.push({
      key: `week-${monday}`,
      url: pdfs[0],
      attachments: pdfs.slice(1),
      kind: 'pdf',
      text,
      label: `St Edmund's menus for the week commencing ${longDate(monday)}`,
      hint: "The post's text comes first, then its PDFs (lunch and supper).",
      week: monday,
    })
  }
  return refs
}

/** A weekly post linking that week's lunch and supper PDFs, with any change to the week's meal times (weekly). */
export const stEdmunds: DocSource = {
  async documents({ today }) {
    return eddiesDocuments(await fetchText(EDDIES_PAGE), today)
  },
  guide:
    'Supper is the dinner meal. A time change the post gives for a meal ("Monday 12th October, Dinner service: 18:00 – 18:45") goes on that day\'s meal line as its note, the times as "Dinner 18:00–18:45 this Monday". Leave out the calories printed beside dishes. Sections: "## Soup", "## Main", "## Sides", "## Dessert".',
}
