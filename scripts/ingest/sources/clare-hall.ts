import { between, type DocSource } from '../lib/docs.ts'

export const CLARE_HALL_SWAY = 'https://sway.cloud.microsoft/b7Zz74Q2g96EIhE9'

/** A Microsoft Sway, one page the Kitchen Manager rewrites each week: drawn by Chrome, read as its text. */
export const clareHall: DocSource = {
  async documents() {
    return [{
      key: CLARE_HALL_SWAY,
      url: CLARE_HALL_SWAY,
      kind: 'browser',
      label: "Clare Hall's weekly menu, a Microsoft Sway",
      // From the menu's own words to its sustainability notes: not Sway's buttons around it
      extract: (text) => between(text, /administered by|^(mon|tues|wednes|thurs|fri|satur|sun)day \d/i, /sustainability initiatives/i),
    }]
  },
  guide:
    'Each day has lunch and dinner: a soup, two mains and a dessert, under "## Soup", "## Mains" and "## Dessert". Its codes go in brackets after the dish as printed: PB is plant-based, V vegetarian, GF gluten-free ("GF Available" stays as "GF available" in the name, not a code). A meal it says is closed ("CLOSED FOR FORMAL HALL") is cancelled: "2026-10-14 dinner | No dinner – closed for formal hall", with no dishes.',
}
