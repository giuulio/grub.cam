import { renderedHtml } from '../lib/browser.ts'
import { between, type DocRef, type DocSource } from '../lib/docs.ts'

export const LUCY_CANVA = 'https://www.canva.com/design/DAFvirNLKtg/view'
/** The same design as Lucy's site embeds it: no cookie notice or viewer around it, lighter to draw */
const EMBED = `${LUCY_CANVA}?embed`

/**
 * The design's week menus and the page each is on. Its pages are a week's menu ("Lucy Cavendish Catering: 2nd
 * November- 8th November") or a newsletter; a new week can be added after the last instead of overwriting it (2 Nov
 * 2026: last week's menu on page 1, this week's on page 4). The viewer's data holds every page's text in order,
 * whichever page it draws, so one drawing numbers them all.
 */
export function menuPages(html: string): { page: number; week: string }[] {
  const data = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n')
  const titles = [...data.matchAll(/Lucy Cavendish Catering:\s*([^\\"]+)|Weekly Catering Newsletter/g)]
  return titles.flatMap((m, i) => (m[1] ? [{ page: i + 1, week: m[1].replace(/\s+/g, ' ').trim() }] : []))
}

/** The menu's part of a page's text, from its week's heading: Canva draws the pages beside it too. */
const weekMenu = (week: string) => (text: string) =>
  between(text, new RegExp(`lucy cavendish catering:\\s*${week.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s*')}`, 'i'), /^(weekly catering newsletter|toolbar)$/i)

const label = "Lucy Cavendish's weekly catering menu, a Canva design"

/**
 * A Canva design, a column a day, each week's menu a page of it: each drawn by Chrome at its page and read from a
 * screenshot (as text its columns come out scrambled), only when its text has changed. Canva puts a bot check in front
 * of GitHub's runners (13 Oct 2026: "Just a moment… Verification"), which isn't got round: the scheduled run reports it
 * in Source health, and it's read from a machine Canva doesn't challenge (`npm run ingest -- --only lucy-cavendish`)
 * or by hand.
 */
export const lucyCavendish: DocSource = {
  async documents() {
    const pages = menuPages(await renderedHtml(EMBED))
    // No pages read (a bot check, or Canva changed): the first page, whose fetch says why
    if (!pages.length) return [{ key: LUCY_CANVA, url: EMBED, site: 'lucy-cavendish', kind: 'browser', screenshot: true, label, extract: (text) => between(text, /lucy cavendish catering/i, /^(weekly catering newsletter|toolbar)$/i) }]
    return pages.map(({ page, week }): DocRef => ({
      key: `${LUCY_CANVA}#${week}`,
      url: `${EMBED}#${page}`,
      site: 'lucy-cavendish',
      kind: 'browser',
      screenshot: true,
      label: `${label}: ${week}`,
      extract: weekMenu(week),
    }))
  },
  guide:
    'Read the design itself, not a cookie notice over it. Its heading gives the week ("12th October – 18th October"); each column is a day of Warburton Hall: breakfast, lunch (brunch on Saturday, Sunday roast on Sunday) and supper, which is the dinner meal. Use the dated grid when the newsletter\'s relative wording ("tomorrow") disagrees, and flag the conflict as unsure. An explicit closure ("not open due to a graduation") is a cancellation of that column\'s meal, not a dish or a served brunch just because the heading has hours. Hours alone give no dishes: do not invent a breakfast menu. A supper named for an event ("Breast Cancer Awareness Supper") keeps its name as the meal\'s note. Street Food is dinner; put its published time range in that day\'s note. A formal ("Welcome Formal", "Matriculation Dinner") is that day\'s formal, not its dinner; keep a published start in the note without inventing an end. Here V means vegan and Vn vegetarian: write them out as "(vegan)" and "(vegetarian)"; GF stays (GF). Sections: "## Soup", "## Mains", "## Sides", "## Dessert". A breakfast list that\'s the same every day is still given for each day. A dated offer ("£3 Pasta Deal") belongs to that meal alone. Do not read Café Lucy or Nautilus Bar hours as Warburton Hall menus.',
}
