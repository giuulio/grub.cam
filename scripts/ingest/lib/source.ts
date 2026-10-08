import type { MenuDay } from '../../schema.ts'

export type SourceContext = {
  /** ISO week being fetched, e.g. 2026-W41 */
  week: string
  /** Mon..Sun ISO dates of that week */
  dates: string[]
  today: string
}

/** Scrapes one venue's menu. Dates must come from the source, never from the requested week. */
export type Adapter = {
  /** Return menu days for the requested week (days outside it are dropped). */
  fetch(ctx: SourceContext): Promise<{ days: MenuDay[]; note?: string }>
}

export type Channel = 'html' | 'json' | 'pdf' | 'sway' | 'canva' | 'app' | 'email' | 'intranet' | 'none' | 'unknown'

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
