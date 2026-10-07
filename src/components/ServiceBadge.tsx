import { MEAL_LABEL } from '../lib/filters.ts'
import { formatISODate, type LocalNow } from '../lib/time/clock.ts'
import type { OpenStatus } from '../lib/time/openNow.ts'

function rel(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`
  return ''
}

export function ServiceBadge({ status, now }: { status: OpenStatus; now: LocalNow }) {
  switch (status.kind) {
    case 'open':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/50 dark:text-green-200">
          <span className="size-1.5 rounded-full bg-green-500" />
          Open · {MEAL_LABEL[status.slot.meal]} until {status.slot.end}
          <span className="font-normal opacity-75">({rel(status.closesInMin)} left)</span>
        </span>
      )
    case 'opening':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
          {MEAL_LABEL[status.slot.meal]} at {status.slot.start}
          <span className="font-normal opacity-75">(in {rel(status.opensInMin)})</span>
        </span>
      )
    case 'closed': {
      const n = status.next
      const when = n ? (n.date === now.date ? 'today' : formatISODate(n.date)) : undefined
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-200 px-2.5 py-1 text-xs font-medium text-stone-700 dark:bg-stone-800 dark:text-stone-300">
          Closed{n ? ` · next ${MEAL_LABEL[n.slot.meal].toLowerCase()} ${when} ${n.slot.start}` : ''}
        </span>
      )
    }
    case 'unknown':
      return <span className="inline-flex rounded-full border border-dashed border-stone-300 px-2.5 py-1 text-xs text-stone-500 dark:border-stone-700">Hours not published</span>
  }
}
