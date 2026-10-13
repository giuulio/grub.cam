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

Rules: the first line is the date (YYYY-MM-DD) and the meal, one of breakfast, brunch, lunch, dinner, formal. One dish per line, as printed, in its order (a board in capitals in sentence case: "Roast chicken", names such as "Americano" kept capitalised); keep diet codes in brackets after the name as printed (V, VG, VE, PB, H, GF, DF); a price at the end of the line as "£3.60". Course headings "## Soup", "## Mains", "## Sides", "## Desserts" only when the board groups dishes that way. If the board shows several meals or days, start a new "date meal" line for each. An explicit cancellation belongs on that line as a note starting "No <meal> –", with no dishes, however the board words it ("CLOSED FOR FORMAL HALL" is "2026-10-14 dinner | No dinner – closed for formal hall"): "2026-10-13 dinner | No dinner – UG freshers formal hall". A blank meal with no dishes is not a cancellation; omit it. Nothing else: no commentary, no blank header, no markdown fences.`,
  prices: `A price list, in this format (body only):

columns: Members | Non-members
## Drinks
Latte | £2.80
Tea | £1.50
## Lunch | lunch, dinner
Main course | £3.75 | £5.65 | main
Soup | £1.75 | | soup
Hummus wrap (VE) | £4.00
Shakshuka | £7.15 | | | Tomato sauce, poached eggs and feta

Rules: one item per line, "name | price" (a board in capitals in sentence case: "Flat white", names such as "Americano" kept capitalised) with the price as "£2.80", "2.80" or "95p" (a range as "£3.24-£3.96"). When the board shows two prices per item for different people (members and non-members, students and staff), give both: "name | first price | second price", in the board's order, and start the list with a "columns: first | second" line naming each column as the board heads it ("columns: Members | Non-members"; a column headed only by "£" is "Full price"). Leave the columns line out when the board doesn't say whose each price is, and when every item has one price. Prices for sizes or versions of an item (single and double, small and large, half and pint, hot and iced) are separate items, never a second price or a columns line: "Single espresso | £2.20", "Double espresso | £2.60". Leave out a note that prices nothing ("Decaf/oat milk available"). "## Heading" starts a section named as the board names it; add "| lunch, dinner" after a heading only when the board says those prices apply at particular meals. Add a fourth field only when a line prices a whole course of the day's menu (soup, main, side, dessert) or the whole meal ("meal"), e.g. "Main course | £3.75 | | main". Keep diet codes in brackets after the name as printed. When ingredients, a description or choices are printed beneath an item, put them in an optional fifth field, leaving unused price/course fields empty: "Shakshuka | £7.15 | | | Tomato sauce, poached eggs and feta". Preserve all choices and printed details; do not infer ingredients or diet tags. Nothing else: no commentary, no markdown fences.`,
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

/**
 * `current`: what the site lists now for a price list or hours, in the same format: hours come back whole, a correction
 * made; a price list comes back as what was sent alone, since publishing merges it by section (0041), a correction as
 * the whole section it changes. A menu's `date` and `service`: what the sender says it's for; with `asBoard`, only
 * where the board doesn't say (`today`, London's date, places a board's weekdays). `photos`: how many came together.
 */
export type Context = {
  kind: Transcribable
  venue: { name: string; type: 'hall' | 'cafe' | 'bar'; site: string }
  date?: string
  service?: string
  asBoard?: boolean
  today?: string
  note?: string
  current?: string
  photos?: number
  /** Ingest reading the venue's own document (scripts/ingest/lib/model.ts): what it is, and how to read it */
  source?: string
  /** With `asBoard`: the Monday of the week its undated weekdays are (a repeating cycle's week), instead of this week */
  week?: string
}

const TYPE_WORD = { hall: 'dining hall', cafe: 'café', bar: 'bar' } as const

/**
 * The instruction given with the photo (and/or the sender's text). `structured`: asked through the API, whose answer's
 * shape (openai.ts, TRANSCRIPTION) says when there's nothing to read; else, pasted into a chat, it's told to say NOTHING.
 */
export function prompt(c: Context, structured = false): string {
  const what = c.kind === 'menu' ? 'the menu' : c.kind === 'prices' ? 'the price list' : 'the opening hours'
  const lines = [
    `You transcribe what a photo of a board or notice, or a document (a PDF menu), says, exactly as printed, for a database of Cambridge college dining.`,
    `This is ${what} at ${c.venue.name}, a ${TYPE_WORD[c.venue.type]} at ${c.venue.site}.`,
  ]
  if (c.source) lines.push(`It is the venue's own published document, not a member's photo: ${c.source}`)
  if (c.kind === 'menu' && c.asBoard && c.today) {
    const monday = c.week ?? addDays(c.today, -((weekday(c.today) + 6) % 7))
    const which = c.week ? `the week of ${longDate(monday)} to ${longDate(addDays(monday, 6))}, whatever the board says` : `this week's (${longDate(monday)} to ${longDate(addDays(monday, 6))}) unless the board says which week`
    lines.push(
      `Today is ${longDate(c.today)}. Take the days and meals from the board. Weekdays without dates are ${which}.${c.date ? ` Where the board says neither day nor meal, it is for ${c.date}${c.service ? ` ${c.service}` : ''}.` : ''}`,
    )
  } else if (c.kind === 'menu' && c.date) lines.push(`The sender says it is for ${c.date}${c.service ? ` ${c.service}` : ''}; use that date and meal unless the board clearly shows another.`)
  if ((c.photos ?? 0) > 1) lines.push(`There are ${c.photos} photos or documents, in order: parts of one board or several. Read them all into one answer, without repeating what two of them both show.`)
  if (c.note) lines.push(`The sender also wrote: "${c.note.replace(/"/g, "'")}" — it may be the text itself, typed, or a note about the photo.`)
  if (c.current)
    lines.push(
      `What the site lists now, in the same format:\n"""\n${c.current}\n"""\n` +
        (c.kind === 'prices'
          ? `Each section you answer replaces the site's section under the same heading; the site's other sections stay as they are. So answer with what was sent alone, under the board's own headings: a board the site doesn't list yet (specials, a food menu beside the drinks) is new sections, added. Lines under no heading replace the site's lines under no heading, so when the board has no headings and those lines aren't on it, head it with the board's title ("## Specials"). A correction to part of it ("the latte is now £3"): that whole section, under its heading as listed, the change made and the rest of it kept.`
          : `If the photo or the text gives only part of it, or a correction to it ("Monday closes at 2"), answer with the whole list: the change made, everything else kept as it is. If they give a whole new list, answer with theirs alone.`),
    )
  lines.push('', BODY_SPEC[c.kind])
  if (structured)
    lines.push(
      '',
      `Then decide whether it goes on the venue's page as it is, with no one checking it (verdict). publish only when what was sent clearly is ${what} and everything in your answer is read, not guessed: every date, meal, item and price. A small doubt about a description or an allergen note is fine; say it in unsure. retry when it is something else, or blurred, cut off, too far away or too dark to read, or when a price, a date or a name would be a guess; then say in retry, in one short sentence to the sender, what to do.`,
    )
  else lines.push('', 'If the image shows none of this, reply with exactly: NOTHING')
  return lines.join('\n')
}

const DAY = 86400000
const utc = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
const addDays = (iso: string, n: number) => new Date(utc(iso) + n * DAY).toISOString().slice(0, 10)
/** 0 for Sunday, as Date's getUTCDay */
const weekday = (iso: string) => new Date(utc(iso)).getUTCDay()
const longDate = (iso: string) => new Date(utc(iso)).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ` (${iso})`

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
