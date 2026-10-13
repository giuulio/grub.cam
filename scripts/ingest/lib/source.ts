import type { Channel, MenuDay } from '../../schema.ts'
import type { DocSource, PriceSource } from './docs.ts'

export type SourceContext = {
  /** ISO week being fetched, e.g. 2026-W41 */
  week: string
  /** The dates wanted from that week: Mon..Sun, or (when a run checks only the next days) those from today on. Never index it by weekday. */
  dates: string[]
  today: string
}

/** Scrapes one venue's menu. Dates must come from the source, never from the requested week. */
export type Adapter = {
  /** Return published menu days for the requested week, or all available days. Every returned date is kept. */
  fetch(ctx: SourceContext): Promise<{ days: MenuDay[]; note?: string }>
}

/** How a venue's menu is published. */
export type MenuSource = {
  /** venues.id in Supabase: "<site>/<venue>" */
  venue: string
  channel: Channel
  url?: string
  cadence?: string
  notes?: string
  /** Scripted sources only; the rest are transcribed (`npm run ingest:manual`) or need a collaborator. */
  adapter?: Adapter
  /** Instead of an adapter: menus published as documents (PDFs, a page, a Sway), read by a parser or the model (lib/docs.ts) */
  documents?: DocSource
  /** A posted price list published as a document, checked once a day and read by the model when it changes */
  prices?: PriceSource
  /** With an adapter: when it breaks on the page (not when the page can't be fetched), the model reads `url`'s text instead */
  fallback?: boolean
}

export function mergeDays(days: MenuDay[]): MenuDay[] {
  const byKey = new Map<string, MenuDay>()
  for (const d of days) {
    const k = `${d.date}|${d.service}`
    const prev = byKey.get(k)
    if (prev) prev.items.push(...d.items)
    else byKey.set(k, { ...d, items: [...d.items] })
  }
  return [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date) || a.service.localeCompare(b.service))
}
