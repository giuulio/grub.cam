import { dateNear, longDate } from '../lib/dates.ts'
import { pageText, type DocRef, type DocSource } from '../lib/docs.ts'
import { fetchText } from '../lib/http.ts'

export const PEMBROKE_PAGE = 'https://www.pem.cam.ac.uk/college/catering/information-students/servery-menu'

/**
 * The servery page's cycle: "Week 2", "Weeks commencing 12th October, 02nd November, 23rd November", and that week's
 * PDF once it's posted. Each PDF is read once, dated as its first week, and copied to the others.
 */
export function pembrokeDocuments(html: string, today: string): DocRef[] {
  const refs: DocRef[] = []
  for (const block of html.split(/(?=<p>\s*<strong>\s*Week\s*\d)/i).slice(1)) {
    const n = block.match(/Week\s*(\d+)/i)![1]
    const listed = pageText(block).match(/commencing\s+([^\n]+)/i)?.[1] ?? ''
    const mondays = [...new Set(listed.split(',').map((d) => dateNear(d, today)).filter((d): d is string => !!d))].sort()
    const pdf = block.match(/href="([^"]+\.pdf)"/i)?.[1]
    if (!pdf || !mondays.length) continue
    const url = new URL(pdf, PEMBROKE_PAGE).href
    refs.push({
      key: url,
      url,
      kind: 'pdf',
      label: `Pembroke's servery menu, week ${n} of its cycle`,
      hint: `Served the weeks of ${mondays.map(longDate).join(', ')}.`,
      week: mondays[0],
      repeats: mondays,
    })
  }
  return refs
}

/** A three-week cycle on the servery page, each week's PDF linked once posted (weekly). */
export const pembroke: DocSource = {
  async documents({ today }) {
    return pembrokeDocuments(await fetchText(PEMBROKE_PAGE), today)
  },
  guide:
    'Each day has lunch and dinner: a main, an alternative and an allergen-friendly dish, then pudding and sides. Write the allergen-friendly dish with "(allergen friendly)" after it, the pudding under "## Dessert" and the sides under "## Sides". Saturday and Sunday lunch are brunch when it says so.',
}
