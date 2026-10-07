import type { MenuDay, MenuFile } from '../../schema.ts'

export type SourceContext = {
  /** ISO week being ingested, e.g. 2026-W41 */
  week: string
  /** Mon..Sun ISO dates of that week */
  dates: string[]
  today: string
}

export type Source = {
  college: string
  venue: string
  source_url: string
  /** Return menu days for the requested week (may include days outside it; they're filtered). */
  fetch(ctx: SourceContext): Promise<{ days: MenuDay[]; note?: string }>
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

export function toMenuFile(src: Source, ctx: SourceContext, days: MenuDay[], note?: string): MenuFile {
  const inWeek = new Set(ctx.dates)
  return {
    college: src.college,
    venue: src.venue,
    week: ctx.week,
    source_url: src.source_url,
    fetched_at: new Date().toISOString(),
    method: 'script',
    note,
    days: mergeDays(days.filter((d) => inWeek.has(d.date) && d.items.length)),
  }
}
