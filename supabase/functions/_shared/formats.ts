// The text formats a submission is transcribed into: the same ones the ingest scripts read (scripts/ingest/manual.ts,
// prices.ts, hours.ts), so a transcription is a file those scripts can parse. Shared by the `submit` Edge Function
// (which asks a model for the body) and the CLI (which prints the same prompt to paste into any chat model).
// No imports: this runs in Deno and in Node.

export type Kind = 'menu' | 'prices' | 'hours' | 'photo' | 'other'
export type Transcribable = 'menu' | 'prices' | 'hours'

/** What the body of each format looks like, as told to the model. */
export const BODY_SPEC: Record<Transcribable, string> = {
  menu: `A menu, in this format (body only):

2026-10-09 lunch
## Soup
Carrot & coconut soup (VG)
## Mains
Roast pork £3.60
Spinach & ricotta cannelloni (V)
## Sides
Chips
## Desserts
Apple crumble £1.85

Rules: the first line is the date (YYYY-MM-DD) and the meal, one of breakfast, brunch, lunch, dinner, formal. One dish per line, as printed, in its order; keep diet codes in brackets after the name as printed (V, VG, VE, PB, H, GF, DF); a price at the end of the line as "£3.60". Course headings "## Soup", "## Mains", "## Sides", "## Desserts" only when the board groups dishes that way. If the board shows several meals or days, start a new "date meal" line for each. Nothing else: no commentary, no blank header, no markdown fences.`,
  prices: `A price list, in this format (body only):

## Drinks
Latte | £2.80
Tea | £1.50
## Lunch | lunch, dinner
Main course | £3.75 | £5.65 | main
Soup | £1.75 | | soup
Hummus wrap (VE) | £4.00

Rules: one item per line, "name | price" with the price as "£2.80", "2.80" or "95p" (a range as "£3.24-£3.96"). When the board shows two prices per item (members and non-members, students and staff), give both: "name | first price | second price", in the board's order. "## Heading" starts a section named as the board names it; add "| lunch, dinner" after a heading only when the board says those prices apply at particular meals. Add a fourth field only when a line prices a whole course of the day's menu (soup, main, side, dessert) or the whole meal ("meal"), e.g. "Main course | £3.75 | | main". Keep diet codes in brackets after the name as printed. Nothing else: no commentary, no markdown fences.`,
  hours: `Opening hours, in this format (body only):

breakfast | Mon-Fri | 08:00-09:30
lunch | Mon-Fri | 12:00-13:45
brunch | Sat, Sun | 10:30-12:00
dinner | daily | 17:50-19:00
formal | Tue, Thu, Sun | 19:30 | term
snacks | Mon-Fri | 08:00-17:00
bar | Fri, Sat | 19:00-00:00

Rules: one line per meal and set of days, "meal | days | times", with an optional fourth field "term", "vacation" or "all" when the board says which, and an optional fifth field for a short note printed on the board. Meals: breakfast, brunch, lunch, dinner, formal (formal hall), snacks (a café's opening hours), bar. Days as ranges or lists ("Mon-Fri", "Sat, Sun", "daily"). Times as 24-hour "HH:MM-HH:MM"; a start alone (e.g. "19:30") when only a start is printed. Nothing else: no commentary, no markdown fences.`,
}

export type Context = { kind: Transcribable; venue: { name: string; type: 'hall' | 'cafe' | 'bar'; site: string }; date?: string; service?: string; note?: string }

const TYPE_WORD = { hall: 'dining hall', cafe: 'café', bar: 'bar' } as const

/** The instruction given with the photo (and/or the sender's text). */
export function prompt(c: Context): string {
  const what = c.kind === 'menu' ? 'the menu' : c.kind === 'prices' ? 'the price list' : 'the opening hours'
  const lines = [
    `You transcribe what a photo of a board or notice says, exactly as printed, for a database of Cambridge college dining.`,
    `This is ${what} at ${c.venue.name}, a ${TYPE_WORD[c.venue.type]} at ${c.venue.site}.`,
  ]
  if (c.kind === 'menu' && c.date) lines.push(`The sender says it is for ${c.date}${c.service ? ` ${c.service}` : ''}; use that date and meal unless the board clearly shows another.`)
  if (c.note) lines.push(`The sender also wrote: "${c.note.replace(/"/g, "'")}" — it may be the text itself, typed, or a note about the photo.`)
  lines.push('', BODY_SPEC[c.kind], '', 'If the image shows none of this, reply with exactly: NOTHING')
  return lines.join('\n')
}

/** The header that makes a transcription a complete file for ingest:manual / ingest:prices / ingest:hours. */
export function header(kind: Transcribable, h: { site: string; venue: string; source: string; observed: string }): string {
  const lines = [`site: ${h.site}`, `venue: ${h.venue}`, `source: ${h.source}`]
  // manual.ts reads `fetched:` (when it was read), the other two `observed:` (the day it was seen)
  lines.push(kind === 'menu' ? `fetched: ${h.observed}T12:00:00Z` : `observed: ${h.observed}`)
  return lines.join('\n') + '\n---\n'
}

/** Strips a model's wrapping (fences, a leading "Here is") so the body parses. */
export function cleanBody(text: string): string {
  return text
    .replace(/^\s*```[a-z]*\s*\n?/i, '')
    .replace(/\n?```\s*$/, '')
    .replace(/^(here (is|are)[^\n]*\n)/i, '')
    .trim()
}
