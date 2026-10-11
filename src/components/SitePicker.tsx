import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'reicon-react'
import type { Site } from '../lib/types.ts'
import { SearchField, Segmented } from './Controls.tsx'
import { Icon } from './Icon.tsx'

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/[’']/g, '').toLowerCase()
const nameOf = (s: Site) => s.short_name ?? s.name

type Kind = Site['kind']
const KINDS: ['' | Kind, string][] = [['', 'All'], ['college', 'Colleges'], ['university', 'University']]

/**
 * Pick any number of colleges and University sites, or every college (or every University site) at once: a chip naming
 * what's picked ("Jesus, Trinity", "3 colleges and sites", "Colleges"), opening a box with a choice of all, colleges or
 * University, a search over the names (and nicknames), then every college and site to tick, grouped. Picking a kind
 * clears the ticks and a tick clears the kind. Ticks apply as they're made; Escape, a click outside or Done closes it.
 * On a phone the box rises from the foot of the screen, so a row of chips that scrolls sideways can't clip it.
 */
export function SitePicker({ sites, value, kind, onChange }: { sites: Site[]; value: string[]; kind?: Kind; onChange: (slugs: string[], kind?: Kind) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const box = useRef<HTMLDivElement>(null)
  // Ticks show at once; what's picked then follows `value` (the URL, which the router updates a moment later)
  const [ticked, setTicked] = useState(value)
  const [seen, setSeen] = useState(value.join(','))
  if (value.join(',') !== seen) {
    setSeen(value.join(','))
    setTicked(value)
  }
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
  const picked = sites.filter((s) => ticked.includes(s.slug))
  const label = kind === 'college' ? 'Colleges' : kind === 'university' ? 'University sites' : !picked.length ? 'Colleges and sites' : picked.length <= 2 ? picked.map(nameOf).join(', ') : `${picked.length} colleges and sites`
  const pick = (slugs: string[]) => {
    setTicked(slugs)
    onChange(slugs)
  }
  const toggle = (slug: string) => pick(ticked.includes(slug) ? ticked.filter((v) => v !== slug) : [...ticked, slug])
  const shown = sites.filter((s) => !q.trim() || [s.name, s.short_name ?? '', ...(s.aliases ?? [])].some((n) => fold(n).includes(fold(q.trim()))))
  return (
    <div ref={box} className="relative">
      <button type="button" aria-expanded={open} aria-haspopup="dialog" data-on={picked.length > 0 || !!kind || undefined} onClick={() => setOpen(!open)} className="chip max-w-64">
        <span className="truncate">{label}</span>
        <Icon of={ChevronDown} className="size-4" />
      </button>
      {open && (
        <div role="dialog" aria-label="Colleges and sites" className="raised z-[800] flex flex-col overflow-hidden rounded-xl text-left max-md:fixed max-md:inset-x-2 max-md:bottom-2 max-md:max-h-[70svh] md:absolute md:top-full md:left-0 md:mt-2 md:max-h-[min(30rem,65svh)] md:w-80">
          <div className="space-y-3 border-b border-ink/10 p-3">
            <Segmented label="Which" options={KINDS} value={kind ?? ''} onChange={(k) => { setTicked([]); onChange([], k || undefined) }} />
            <SearchField value={q} onChange={setQ} placeholder="Find a college or site" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {(['college', 'university'] as const).map((kind) => {
              const list = shown.filter((s) => s.kind === kind)
              return (
                list.length > 0 && (
                  <fieldset key={kind}>
                    <legend className="px-2 pt-2 pb-1 text-sm font-semibold text-muted">{kind === 'college' ? 'Colleges' : 'University'}</legend>
                    {list.map((s) => (
                      <label key={s.slug} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-ink/5">
                        <input type="checkbox" checked={ticked.includes(s.slug)} onChange={() => toggle(s.slug)} className="size-4 shrink-0 accent-[var(--action)]" />
                        {nameOf(s)}
                      </label>
                    ))}
                  </fieldset>
                )
              )
            })}
            {!shown.length && <p className="px-2 py-4 text-sm text-muted">Nothing matches “{q}”.</p>}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-ink/10 p-3">
            <button type="button" disabled={!ticked.length && !kind} onClick={() => pick([])} className="cursor-pointer text-sm text-muted hover:text-ink disabled:cursor-default disabled:opacity-50">
              Clear
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn btn-primary">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
