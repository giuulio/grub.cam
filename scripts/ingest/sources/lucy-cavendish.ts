import { between, type DocSource } from '../lib/docs.ts'

export const LUCY_CANVA = 'https://www.canva.com/design/DAFvirNLKtg/view'
/** The same design as Lucy's site embeds it: no cookie notice or viewer around it, lighter to draw */
const EMBED = `${LUCY_CANVA}?embed`

/**
 * A Canva design overwritten each week, a column a day: drawn by Chrome and read from a screenshot (as text its
 * columns come out scrambled), only when its text has changed. Canva puts a bot check in front of GitHub's runners
 * (13 Oct 2026: "Just a moment… Verification"), which isn't got round: the scheduled run reports it in Source health,
 * and it's read from a machine Canva doesn't challenge (`npm run ingest -- --only lucy-cavendish`) or by hand.
 */
export const lucyCavendish: DocSource = {
  async documents() {
    return [{
      key: LUCY_CANVA,
      url: EMBED,
      site: 'lucy-cavendish',
      kind: 'browser',
      screenshot: true,
      label: "Lucy Cavendish's weekly catering menu, a Canva design",
      // The menu page's text, from its title to the newsletter page after it: not the cookie notice (which differs by
      // country) or Canva's controls
      extract: (text) => between(text, /lucy cavendish catering/i, /^(weekly catering newsletter|toolbar)$/i),
    }]
  },
  guide:
    'Read the design itself, not a cookie notice over it. Its heading gives the week ("12th October – 18th October"); each column is a day of Warburton Hall: breakfast, lunch (brunch on Saturday, Sunday roast on Sunday) and supper, which is the dinner meal. A supper named for an event ("Breast Cancer Awareness Supper") keeps its name as the meal\'s note. A formal ("Welcome Formal", "Matriculation Dinner") is that day\'s formal, not its dinner. Here V means vegan and Vn vegetarian: write them out as "(vegan)" and "(vegetarian)"; GF stays (GF). Sections: "## Soup", "## Mains", "## Sides", "## Dessert". A breakfast list that\'s the same every day is still given for each day.',
}
