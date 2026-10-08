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
        <p className="text-sm font-medium">{formatISODate(`${month}-01`, { month: 'long', year: 'numeric' })}</p>
        <div className="flex">
          <ArrowButton dir="prev" label="Previous month" disabled={month <= first} onClick={() => setMonth(addMonthsYM(month, -1))} />
          <ArrowButton dir="next" label="Next month" disabled={month >= last} onClick={() => setMonth(addMonthsYM(month, 1))} />
        </div>
      </div>
      <div role="group" aria-label="Menu dates" className="grid grid-cols-7 gap-1 text-center text-sm tabular-nums">
        {WEEKDAYS.map((d, i) => (
          <span key={i} aria-hidden="true" className="pb-1 text-xs text-white/30">
            {d}
          </span>
        ))}
        {monthCells(month).map((d, i) => {
          if (!d) return <span key={i} />
          const has = dates.has(d)
          const picked = d === value
          const cls = picked ? 'bg-white font-medium text-charcoal' : has ? 'cursor-pointer bg-white/10 text-white hover:bg-white/20' : 'text-white/25'
          return (
            <button
              key={d}
              type="button"
              disabled={!has && d !== today}
              aria-pressed={picked}
              aria-label={`${formatISODate(d, { weekday: 'long', day: 'numeric', month: 'long' })}${d === today ? ', today' : ''}${has ? '' : ', no menu'}`}
              onClick={() => onChange(d)}
              className={`flex aspect-square items-center justify-center rounded-md transition-colors ${cls} ${d === today && !picked ? 'ring-1 ring-white/70 ring-inset' : ''}`}
            >
              {Number(d.slice(8))}
            </button>
          )
        })}
      </div>
      <p className="mt-3 flex gap-4 text-xs text-white/40">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-white/10" /> Menu
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm ring-1 ring-white/70 ring-inset" /> Today
        </span>
      </p>
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
      className="flex size-8 cursor-pointer items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-default disabled:text-white/15 disabled:hover:bg-transparent"
    >
      <Icon of={dir === 'prev' ? ChevronLeft : ChevronRight} />
    </button>
  )
}
