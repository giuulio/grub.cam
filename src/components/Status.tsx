import { useReady } from '../lib/data.tsx'
import { statusWords } from '../lib/status.ts'
import type { LocalNow } from '../lib/time/clock.ts'
import type { OpenStatus } from '../lib/time/openNow.ts'

/**
 * Open now, in Dark Green after a Green dot, and until when, led by the meal for a venue serving more than one
 * ("● Dinner until 19:30"); otherwise when it next opens. Nothing on a prerendered page,
 * which can't know when it's read. `meal` names the meal, for a venue that serves more than one.
 */
export function Status({ s, now, meal = false, className = '' }: { s: OpenStatus; now: LocalNow; meal?: boolean; className?: string }) {
  if (useReady().snapshot) return null
  const w = statusWords(s, now.date, { meal })
  return (
    <span className={`tabular-nums ${className}`}>
      {w.kind === 'open' ? (
        <span className="text-open-ink">
          <span aria-hidden="true" className="mr-1.5 inline-block size-2 -translate-y-px rounded-full bg-open align-middle" />
          {w.text !== 'Open' && <span className="sr-only">Open: </span>}
          <span className="font-semibold">{w.text}</span> {w.detail}
        </span>
      ) : (
        <span className={w.kind === 'unknown' ? 'text-muted' : ''}>{w.text}</span>
      )}
    </span>
  )
}
