import type { ReactNode, SelectHTMLAttributes } from 'react'
import { ChevronDown, Search } from 'reicon-react'
import { Icon } from './Icon.tsx'

// Form controls shared by Explore, the Directory and Coverage, one height for a row of them: 44px on a phone, 40px
// above (`.btn`, `.chip`, `.field` in index.css).

/** Pick one of a few views or groups: the pressed one sits raised. */
export function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="inline-flex h-11 shrink-0 items-center gap-1 rounded-lg bg-ink/6 p-1 sm:h-10">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === value}
          onClick={() => onChange(v)}
          className={`h-full cursor-pointer rounded-md px-3.5 text-sm whitespace-nowrap transition-colors ${v === value ? 'raised font-medium text-ink' : 'text-muted hover:text-ink'}`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

/** A filter that's on or off; on, it turns Cambridge Blue. */
export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className="chip">
      {children}
    </button>
  )
}

/** A search box, labelled by its placeholder. */
export function SearchField({ value, onChange, placeholder, className = '' }: { value: string; onChange: (q: string) => void; placeholder: string; className?: string }) {
  return (
    <label className={`field ${className}`}>
      <Icon of={Search} />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </label>
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
