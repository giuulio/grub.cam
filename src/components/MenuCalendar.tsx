import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'reicon-react'
import { addMonthsYM, formatISODate, monthCells } from '../lib/time/clock.ts'
import { Icon } from './Icon.tsx'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** Month grid of menu days: dates with a published menu are filled, today is ringed. Other dates can't be picked. */
export function MenuCalendar({ value, today, dates, onChange }: { value: string; today: string; dates: Set<string>; onChange: (date: string) => void }) {
  const [month, setMonth] = useState(value.slice(0, 7))
  // Follow the picked date when it moves to another month (prev/next, "Today")
  const [shown, setShown] = useState(value)
  if (shown !== value) {
    setShown(value)
    setMonth(value.slice(0, 7))
  }

  const sorted = [...dates, today].sort()
  const first = sorted[0].slice(0, 7)
  const last = sorted.at(-1)!.slice(0, 7)

  return (
    <div className="w-full max-w-72">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">{formatISODate(`${month}-01`, { month: 'long', year: 'numeric' })}</p>
        <div className="flex">
          <ArrowButton dir="prev" label="Previous month" disabled={month <= first} onClick={() => setMonth(addMonthsYM(month, -1))} />
          <ArrowButton dir="next" label="Next month" disabled={month >= last} onClick={() => setMonth(addMonthsYM(month, 1))} />
        </div>
      </div>
      <div role="group" aria-label="Menu dates" className="grid grid-cols-7 gap-1 text-center text-sm tabular-nums">
        {WEEKDAYS.map((d, i) => (
          <span key={i} aria-hidden="true" className="pb-1 text-xs text-muted">
            {d}
          </span>
        ))}
        {monthCells(month).map((d, i) => {
          if (!d) return <span key={i} />
          const has = dates.has(d)
          const picked = d === value
          const cls = picked ? 'bg-accent font-medium text-accent-ink' : has ? 'cursor-pointer bg-ink/5 text-ink hover:bg-ink/10' : 'text-ink/30'
          return (
            <button
              key={d}
              type="button"
              disabled={!has && d !== today}
              aria-pressed={picked}
              aria-label={`${formatISODate(d, { weekday: 'long', day: 'numeric', month: 'long' })}${d === today ? ', today' : ''}${has ? '' : ', no menu'}`}
              onClick={() => onChange(d)}
              className={`flex aspect-square items-center justify-center rounded-md transition-colors ${cls} ${d === today && !picked ? 'ring-1 ring-ink/70 ring-inset' : ''}`}
            >
              {Number(d.slice(8))}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Steps between dates with a menu; disabled at either end. */
export function DayStepper({ value, dates, onChange }: { value: string; dates: string[]; onChange: (date: string) => void }) {
  const prev = dates.findLast((d) => d < value)
  const next = dates.find((d) => d > value)
  return (
    <div className="flex">
      <ArrowButton dir="prev" label={prev ? `Previous menu: ${formatISODate(prev)}` : 'No earlier menu'} disabled={!prev} onClick={() => prev && onChange(prev)} />
      <ArrowButton dir="next" label={next ? `Next menu: ${formatISODate(next)}` : 'No later menu'} disabled={!next} onClick={() => next && onChange(next)} />
    </div>
  )
}

function ArrowButton({ dir, label, disabled, onClick }: { dir: 'prev' | 'next'; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="icon-btn size-8 rounded-md"
    >
      <Icon of={dir === 'prev' ? ChevronLeft : ChevronRight} />
    </button>
  )
}
