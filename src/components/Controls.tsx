import type { SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'reicon-react'
import { Icon } from './Icon.tsx'

// Form controls shared by Explore, the Directory and Coverage, one height for a row of them: 44px on a phone, 40px above.

/** Pick one of a few views or groups: the pressed one sits raised. */
export function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="inline-flex h-11 shrink-0 items-center gap-1 rounded-full bg-ink/5 p-1 sm:h-10">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === value}
          onClick={() => onChange(v)}
          className={`h-full cursor-pointer rounded-full px-3.5 text-sm whitespace-nowrap transition-colors ${v === value ? 'bg-canvas text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

/** A native select, drawn like the other controls (browsers' own selects ignore their height). */
export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={`relative block ${className}`}>
      <select {...props} className="filter-select cursor-pointer appearance-none pr-10" />
      <Icon of={ChevronDown} className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted" />
    </span>
  )
}
