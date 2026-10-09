import { useReady } from '../lib/data.tsx'
import { statusWords } from '../lib/status.ts'
import type { LocalNow } from '../lib/time/clock.ts'
import type { OpenStatus } from '../lib/time/openNow.ts'

/**
 * Open now, on Cambridge Light Blue, and until when; otherwise when it next opens. Nothing on a prerendered page,
 * which can't know when it's read. `meal` names the meal, for a venue that serves more than one.
 */
export function Status({ s, now, meal = false, className = '' }: { s: OpenStatus; now: LocalNow; meal?: boolean; className?: string }) {
  if (useReady().snapshot) return null
  const w = statusWords(s, now.date, { meal })
  return (
    <span className={`tabular-nums ${className}`}>
      {w.kind === 'open' ? <span className="-mx-0.5 rounded bg-open px-1.5 py-0.5 font-medium text-open-ink">{w.text}</span> : <span className={w.kind === 'unknown' ? 'text-muted' : ''}>{w.text}</span>}
      {w.detail && <span className="text-muted"> {w.detail}</span>}
    </span>
  )
}
