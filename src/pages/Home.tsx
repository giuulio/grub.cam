import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CloseCircle, Search } from 'reicon-react'
import { Icon } from '../components/Icon.tsx'
import { VenueCard } from '../components/VenueCard.tsx'
import { VenueMap } from '../components/VenueMap.tsx'
import { useReady } from '../lib/data.tsx'
import { DINING_MEALS, EXPLORE_ACCESS, EXPLORE_DIETS, EXPLORE_TYPES, hasLocation, readExploreFilters, resultDishes } from '../lib/explore.ts'
import { ACCESS_LABEL, applyFilters, DIET_LABEL, MEAL_LABEL, TYPE_LABEL, type Ranked } from '../lib/filters.ts'
import { TYPE_ICON } from '../lib/icons.ts'
import { SITE_NAME, venuePath } from '../lib/site.ts'
import { addDaysISO, formatISODate } from '../lib/time/clock.ts'
import { useNow } from '../lib/useNow.ts'

export function Home() {
  const { sites, venues, snapshot, menuFrom, menuTo } = useReady()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const [filtersShown, setFiltersShown] = useState(false)
  const [selectionGroup, setSelectionGroup] = useState<string[]>([])
  const page = useRef<HTMLDivElement>(null)
  const controls = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const update = () => {
      if (!page.current || !controls.current) return
      page.current.style.setProperty('--explore-top', `${Math.round(page.current.getBoundingClientRect().top + window.scrollY)}px`)
      page.current.style.setProperty('--explore-controls-height', `${controls.current.offsetHeight}px`)
    }
    const observer = new ResizeObserver(update)
    const header = document.querySelector('header')
    if (header) observer.observe(header)
    if (controls.current) observer.observe(controls.current)
    window.addEventListener('resize', update)
    update()
    return () => { observer.disconnect(); window.removeEventListener('resize', update) }
  }, [])
  const f = readExploreFilters(params, now.date, sites, menuFrom, menuTo)
  const results = applyFilters(venues, f, now)
  const list = params.get('view') === 'list'
  const selected = results.find((r) => r.venue.id === params.get('place'))
  const unmapped = results.filter((r) => !hasLocation(r.venue)).length
  const extras = Number(!!f.access) + f.diets.length + Number(f.date !== now.date) + Number(!!f.site)
  const filtered = !!(f.q || f.type || f.meal || f.openNow || extras)
  const update = (fn: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params)
    fn(next)
    setParams(next, { replace: true })
  }
  const set = (key: string, value?: string) => update((p) => { if (value) p.set(key, value); else p.delete(key) })
  const clear = () => update((p) => { for (const k of ['q', 'type', 'meal', 'diet', 'access', 'site', 'date', 'open', 'guests', 'card', 'more', 'place']) p.delete(k) })
  const select = (id: string, group?: string[]) => { if (group) setSelectionGroup(group); set('place', id) }

  return (
    <div ref={page} className={`explore-page ${!list ? 'is-map' : ''}`}>
      <title>{`${SITE_NAME}: Cambridge college and University menus`}</title>
      <h1 className="sr-only">Find food and drink in Cambridge</h1>
      <div ref={controls} className="explore-controls mb-5">
        <label className="flex items-center gap-3 rounded-2xl border border-ink/15 bg-ink/[0.025] px-4 py-3 text-muted focus-within:border-ink/40">
          <Icon of={Search} className="size-5" />
          <input type="search" value={f.q} onChange={(e) => set('q', e.target.value)} placeholder="Search places or dishes" aria-label="Search places or dishes" className="w-full bg-transparent text-ink outline-none placeholder:text-muted" />
        </label>
        <div className="explore-chips mt-3 flex flex-wrap items-center gap-2">
          <div className="explore-quick-chips contents">
          {EXPLORE_TYPES.map(([type, label]) => (
            <Chip key={type} active={f.type === type} onClick={() => update((p) => {
              if (f.type === type) p.delete('type'); else p.set('type', type)
              p.delete('meal')
            })}><Icon of={TYPE_ICON[type]} />{label}</Chip>
          ))}
          <span className="mx-1 hidden h-5 border-l border-ink/15 sm:block" aria-hidden="true" />
          <Chip active={f.openNow} onClick={() => update((p) => {
            if (f.openNow) p.delete('open'); else { p.set('open', '1'); p.delete('date') }
          })}>Open now</Chip>
          </div>
          <button type="button" aria-expanded={filtersShown} aria-controls="explore-filters" onClick={() => setFiltersShown(!filtersShown)} className={`${chipClass} ${filtersShown || extras ? 'border-ink/50 text-ink' : 'border-ink/15 text-muted'}`}>Filters{extras > 0 ? ` · ${extras}` : ''}</button>
          {filtered && <button type="button" aria-label="Clear filters" onClick={clear} className="explore-clear flex min-h-10 shrink-0 items-center gap-1 px-2 text-sm text-muted hover:text-ink"><Icon of={CloseCircle} /><span>Clear</span></button>}
        </div>
        {f.type === 'hall' && (
          <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Dining meal">
            <span className="mr-1 text-sm text-muted">Meal</span>
            {DINING_MEALS.map((m) => <Chip key={m} active={f.meal === m} onClick={() => set('meal', f.meal === m ? undefined : m)}>{MEAL_LABEL[m]}</Chip>)}
          </div>
        )}
        <div id="explore-filters" hidden={!filtersShown} className="mt-4 border-t border-ink/10 pt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm">Access
              <select value={f.access ?? ''} onChange={(e) => set('access', e.target.value)} className="filter-select mt-2">
                <option value="">Any access</option>
                {EXPLORE_ACCESS.map((a) => <option key={a} value={a}>{ACCESS_LABEL[a]}</option>)}
              </select>
            </label>
            <label className="text-sm">Menu date
              <input type="date" value={f.date} min={menuFrom} max={addDaysISO(menuTo, -1)} onChange={(e) => update((p) => { p.set('date', e.target.value); if (e.target.value !== now.date) p.delete('open') })} className="filter-select mt-2" />
              <span className="mt-1 block text-xs text-muted">Menus only; opening status is live.</span>
            </label>
            <label className="text-sm">College or site
              <select value={f.site ?? ''} onChange={(e) => set('site', e.target.value)} className="filter-select mt-2">
                <option value="">Everywhere</option>
                {(['college', 'university'] as const).map((kind) => <optgroup key={kind} label={kind === 'college' ? 'Colleges' : 'University'}>{sites.filter((s) => s.kind === kind).map((s) => <option key={s.slug} value={s.slug}>{s.short_name ?? s.name}</option>)}</optgroup>)}
              </select>
            </label>
          </div>
          <fieldset className="mt-4">
            <legend className="mb-2 text-sm">Dietary</legend>
            <div className="flex flex-wrap gap-2">{EXPLORE_DIETS.map((tag) => <Chip key={tag} active={f.diets.includes(tag)} onClick={() => set('diet', (f.diets.includes(tag) ? f.diets.filter((d) => d !== tag) : [...f.diets, tag]).join(','))}>{DIET_LABEL[tag]}</Chip>)}</div>
            <p className="mt-2 text-xs text-muted">Matches published dish tags, or a venue’s stated options when no menu is available.</p>
          </fieldset>
        </div>
        {!filtersShown && extras > 0 && <p className="mt-3 text-sm text-muted">{[f.access && ACCESS_LABEL[f.access], ...f.diets.map((d) => DIET_LABEL[d]), f.date !== now.date && formatISODate(f.date), f.site && (sites.find((s) => s.slug === f.site)?.short_name ?? sites.find((s) => s.slug === f.site)?.name)].filter(Boolean).join(' · ')}</p>}
      </div>

      <div className="explore-toolbar mb-3 flex flex-wrap items-center justify-between gap-2">
        <p role="status" className="text-sm text-muted"><span className="tabular-nums">{results.length}</span> {results.length === 1 ? 'place' : 'places'}{f.q.trim() ? ' found' : ''}{!list && unmapped > 0 ? ` · ${results.length - unmapped} on map` : ''} · {f.date === now.date ? 'Today’s menus' : `Menus for ${formatISODate(f.date)}`}</p>
        <div className="flex items-center gap-1 rounded-full bg-ink/5 p-1" aria-label="Explore view">
          <button type="button" aria-pressed={!list} onClick={() => set('view')} className={`view-button ${!list ? 'bg-canvas text-ink shadow-sm' : 'text-muted'}`}>Map</button>
          <button type="button" aria-pressed={list} onClick={() => set('view', 'list')} className={`view-button ${list ? 'bg-canvas text-ink shadow-sm' : 'text-muted'}`}>Results</button>
        </div>
      </div>
      {list ? (
        <section aria-label="Matching places">
          {results.length ? <ul className="divide-y divide-ink/10 border-t border-ink/10">{results.map((r) => <VenueCard key={r.venue.id} venue={r.venue} status={r.status} now={now} dishes={resultDishes(r, f)} showSite={!f.site} date={f.date} showAccess />)}</ul> : <Empty onClear={clear} />}
        </section>
      ) : (
        <>
          <section className="explore-map-shell relative isolate overflow-hidden bg-ink/5 sm:rounded-2xl sm:border sm:border-ink/10" aria-label="Map of matching places" onKeyDown={(e) => { if (e.key === 'Escape') set('place') }}>
            <VenueMap results={results} selected={selected?.venue.id} onSelect={select} snapshot={snapshot} filtered={filtered} />
            {!results.length && <div className="absolute inset-x-4 top-20 z-[500] mx-auto max-w-sm rounded-2xl bg-canvas p-5 shadow-sm"><Empty onClear={clear} /></div>}
            {results.length > 0 && unmapped === results.length && <div className="absolute inset-x-4 top-24 z-[500] mx-auto max-w-sm rounded-2xl bg-canvas p-5 text-center shadow-sm"><p className="font-medium">{results.length === 1 ? 'This place isn’t mapped yet.' : 'These places aren’t mapped yet.'}</p><button type="button" onClick={() => set('view', 'list')} className="mt-3 text-sm underline underline-offset-4">View {results.length === 1 ? 'result' : 'results'}</button></div>}
            {selected && <SelectedPlace r={selected} dishes={resultDishes(selected, f)} date={f.date} results={results} selectionGroup={selectionGroup} formalSelected={f.meal === 'formal'} onSelect={select} onClose={() => set('place')} />}
          </section>
          <div className="explore-map-note mt-3 flex flex-wrap justify-between gap-2 text-xs text-muted">
            <span>{snapshot ? 'Choose a pin to see a place.' : 'Filled pins include places open now. Choose a pin to explore.'}</span>
            {unmapped > 0 && <button type="button" onClick={() => set('view', 'list')} className="underline underline-offset-4">{unmapped} {unmapped === 1 ? 'place' : 'places'} awaiting a map location · See all results</button>}
          </div>
        </>
      )}
    </div>
  )
}

const chipClass = 'flex min-h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm transition-colors'
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`${chipClass} ${active ? 'border-ink bg-ink text-canvas' : 'border-ink/15 text-muted hover:border-ink/40 hover:text-ink'}`}>{children}</button>
}
function Empty({ onClear }: { onClear: () => void }) {
  return <div className="py-5 text-center"><p className="font-medium">No places match.</p><button type="button" onClick={onClear} className="mt-2 text-sm text-muted underline underline-offset-4">Clear filters</button></div>
}

function SelectedPlace({ r, dishes, date, results, selectionGroup, formalSelected, onSelect, onClose }: { r: Ranked; dishes: string[]; date: string; results: Ranked[]; selectionGroup: string[]; formalSelected: boolean; onSelect: (id: string) => void; onClose: () => void }) {
  const { snapshot } = useReady()
  const now = useNow()
  const v = r.venue
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => { close.current?.focus({ preventScroll: true }) }, [v.id])
  const others = results.filter((o) => o.venue.id !== v.id && (selectionGroup.includes(o.venue.id) || hasLocation(v) && hasLocation(o.venue) && Math.abs(v.latitude - o.venue.latitude) < 0.00001 && Math.abs(v.longitude - o.venue.longitude) < 0.00001))
  const formal = r.status.kind === 'open' && r.status.slot.meal === 'formal'
  const status = r.status.kind === 'open' ? `${formal ? 'Formal hall' : 'Open'} until ${r.status.slot.end}` : r.status.kind === 'opening' ? `Opens at ${r.status.slot.start}` : r.status.kind === 'unknown' ? 'Hours not published' : r.status.next ? `Opens ${r.status.next.date === now.date ? 'today' : formatISODate(r.status.next.date)} at ${r.status.next.slot.start}` : 'Closed'
  return (
    <div className="selected-place absolute right-3 bottom-12 left-3 z-[600] max-h-[75%] overflow-y-auto rounded-2xl bg-canvas p-5 text-ink shadow-lg sm:right-auto sm:bottom-6 sm:left-6 sm:max-h-[70%] sm:w-80" aria-label="Selected place">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-sm text-muted">{v.site.short_name ?? v.site.name}</p><h2 className="mt-1 text-xl font-semibold tracking-tight">{v.name}</h2></div>
        <button ref={close} type="button" aria-label="Close selected place" onClick={onClose} className="-mt-1 -mr-1 flex size-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-ink/5"><Icon of={CloseCircle} className="size-5" /></button>
      </div>
      <p className="mt-2 text-sm">{TYPE_LABEL[v.type]} · {ACCESS_LABEL[v.access.level]}</p>
      {!snapshot && <p className="mt-2 text-sm font-medium">{status}</p>}
      {(formalSelected || formal || v.formal && !v.slots.some((s) => s.meal !== 'formal')) && <p className="mt-1 text-xs text-muted">Booking required for formal hall.</p>}
      {dishes.length > 0 && <div className="mt-4 border-t border-ink/10 pt-3"><p className="text-xs text-muted">{formatISODate(date)}</p><p className="mt-1 text-sm">{dishes.slice(0, 3).join(' · ')}</p></div>}
      <Link to={`${venuePath(v)}?date=${date}`} className="mt-4 inline-flex min-h-10 items-center rounded-full bg-ink px-4 py-2 text-sm font-medium text-canvas">Menus & details <span className="ml-2" aria-hidden="true">→</span></Link>
      {others.length > 0 && <div className="mt-4 border-t border-ink/10 pt-3"><p className="mb-1 text-xs text-muted">Also at this pin</p>{others.map((o) => <button key={o.venue.id} type="button" onClick={() => onSelect(o.venue.id)} className="block min-h-10 w-full py-2 text-left text-sm underline underline-offset-4">{o.venue.site.slug !== v.site.slug ? `${o.venue.site.short_name ?? o.venue.site.name} · ` : ''}{o.venue.name}</button>)}</div>}
    </div>
  )
}
