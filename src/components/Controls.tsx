import { useEffect, useRef, useState, type ReactNode, type SelectHTMLAttributes } from 'react'
import { Check, ChevronDown, Magnifier, type IconComponent } from 'reicon-react'
import { Icon } from './Icon.tsx'
import { useDrop } from '../lib/useDrop.ts'

// Form controls shared by the front page and Coverage, one height for a row of them: 44px on a phone, 40px
// above (`.btn`, `.chip`, `.field` in index.css).

/** Pick one of a few views or groups: the pressed one sits raised; `disabled` ones greyed. */
export function Segmented<T extends string>({ label, options, value, onChange, disabled = [] }: { label: string; options: [T, string][]; value: T; onChange: (v: T) => void; disabled?: T[] }) {
  return (
    <div role="group" aria-label={label} className="inline-flex h-11 shrink-0 items-center gap-1 rounded-lg bg-ink/6 p-1 sm:h-10">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === value}
          disabled={disabled.includes(v)}
          onClick={() => onChange(v)}
          className={`h-full cursor-pointer rounded-md px-3.5 text-sm whitespace-nowrap transition-colors disabled:cursor-default disabled:opacity-40 ${v === value ? 'raised font-medium text-ink' : 'text-muted enabled:hover:text-ink'}`}
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
      <Icon of={Magnifier} />
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

/**
 * A chip that opens a short list to pick one from, as Google Maps' "Hours ▾": its icon, the picked option's name (or
 * `text`), Cambridge Blue once it isn't the first (or as `on` says). The list is ours, as the colleges' picker is, so
 * every filter opens alike: under the chip (on a phone, the screen's width, `useDrop()`); `null` between options draws
 * a line. Picking closes it, as do Escape and a click outside. `off`: greyed and shut, saying why on hover, for a
 * filter that's always in its row but doesn't apply here.
 */
export function ChipSelect({ label, value, options, onChange, icon, text, on, off }: { label: string; value: string; options: ([value: string, text: string] | null)[]; onChange: (v: string) => void; icon?: IconComponent; text?: string; on?: boolean; off?: string }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])
  useDrop(box, open)
  const choices = options.filter((o): o is [string, string] => !!o)
  const current = choices.find(([v]) => v === value) ?? choices[0]
  return (
    <div ref={box} className="relative">
      <button type="button" disabled={!!off} title={off} aria-haspopup="menu" aria-expanded={open} aria-label={`${label}: ${text ?? current[1]}${off ? ` (${off})` : ''}`} data-on={(!off && (on ?? current[0] !== choices[0][0])) || undefined} onClick={() => setOpen(!open)} className="chip disabled:cursor-default disabled:opacity-40 disabled:hover:border-ink/15">
        {icon && <Icon of={icon} className="size-[1.125rem]" />}
        {text ?? current[1]}
        <Icon of={ChevronDown} className="size-4" />
      </button>
      {open && (
        <div role="menu" aria-label={label} className="raised z-[800] flex flex-col overflow-y-auto rounded-xl p-1.5 text-left max-md:fixed max-md:inset-x-2 max-md:top-(--drop) max-md:max-h-[calc(100svh-var(--drop)-0.5rem)] md:absolute md:top-full md:left-0 md:mt-2 md:max-h-[min(24rem,65svh)] md:min-w-52">
          {options.map((o, n) =>
            o ? (
              <button
                key={o[0]}
                type="button"
                role="menuitemradio"
                aria-checked={o[0] === current[0]}
                onClick={() => {
                  onChange(o[0])
                  setOpen(false)
                }}
                className={`flex cursor-pointer items-center justify-between gap-6 rounded-lg px-3 py-2.5 text-sm whitespace-nowrap hover:bg-ink/5 ${o[0] === current[0] ? 'font-semibold' : ''}`}
              >
                {o[1]}
                {o[0] === current[0] && <Icon of={Check} className="size-4" />}
              </button>
            ) : (
              <hr key={`line-${n}`} className="mx-2 my-1 border-ink/10" />
            ),
          )}
        </div>
      )}
    </div>
  )
}
