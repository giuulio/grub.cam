import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { CloseCircle, List as ListIcon, Map as MapIcon, Setting4 } from 'reicon-react'
import { Chip, SearchField, Segmented, Select } from '../components/Controls.tsx'
import { Icon } from '../components/Icon.tsx'
import { VenueCard, VenuePanel } from '../components/VenueCard.tsx'
import { VenueMap } from '../components/VenueMap.tsx'
import { TypeMark } from '../components/VenuePhoto.tsx'
import { useReady } from '../lib/data.tsx'
import { DINING_MEALS, EXPLORE_ACCESS, EXPLORE_DIETS, EXPLORE_TYPES, hasLocation, readExploreFilters, resultDishes } from '../lib/explore.ts'
import { ACCESS_LABEL, applyFilters, DIET_LABEL, MEAL_LABEL, TYPE_LABEL } from '../lib/filters.ts'
import { SITE_NAME } from '../lib/site.ts'
import { addDaysISO, formatISODate } from '../lib/time/clock.ts'
import { useNow } from '../lib/useNow.ts'

export function Home() {
  const { sites, venues, snapshot, menuFrom, menuTo } = useReady()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const [filtersShown, setFiltersShown] = useState(false)
  const page = useRef<HTMLDivElement>(null)
  const controls = useRef<HTMLDivElement>(null)
  const mapShell = useRef<HTMLElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const list = params.get('view') === 'list'
  // Where the map starts, so it can fill the rest of the screen; on a phone, what the controls over it cover
  useEffect(() => {
    const update = () => {
      if (!page.current || !controls.current) return
      page.current.style.setProperty('--explore-top', `${Math.round(page.current.getBoundingClientRect().top + window.scrollY)}px`)
      page.current.style.setProperty('--explore-controls-height', `${controls.current.offsetHeight}px`)
      if (mapShell.current) page.current.style.setProperty('--map-top', `${Math.round(mapShell.current.getBoundingClientRect().top + window.scrollY)}px`)
    }
    const observer = new ResizeObserver(update)
    const header = document.querySelector('header')
    if (header) observer.observe(header)
    if (controls.current) observer.observe(controls.current)
    window.addEventListener('resize', update)
    update()
    return () => { observer.disconnect(); window.removeEventListener('resize', update) }
  }, [list])
  // Escape closes the filters; so does a click outside them, unless they're docked beside the map (above a phone),
  // where moving the map shouldn't
  useEffect(() => {
    if (!filtersShown) return
    const outside = (e: PointerEvent) => {
      if (!list && window.matchMedia('(min-width: 640px)').matches) return
      if (controls.current && !controls.current.contains(e.target as Node)) setFiltersShown(false)
    }
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setFiltersShown(false) }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [filtersShown, list])
  const f = readExploreFilters(params, now.date, sites, menuFrom, menuTo)
  const results = applyFilters(venues, f, now)
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
  const clearMore = () => update((p) => { for (const k of ['diet', 'access', 'site', 'date']) p.delete(k) })
  const select = (id: string) => set('place', id)
  const places = `${results.length} ${results.length === 1 ? 'place' : 'places'}${f.q.trim() ? ' found' : ''}`
  const siteName = (slug: string) => { const s = sites.find((x) => x.slug === slug); return s?.short_name ?? s?.name }

  return (
    <div ref={page} className={`explore-page ${!list ? 'is-map' : ''}`}>
      <title>{`${SITE_NAME}: Cambridge college and University menus`}</title>
      <h1 className="sr-only">Find food and drink in Cambridge</h1>
      <p role="status" className="sr-only">{places}</p>
      <div ref={controls} className="explore-controls relative z-800 mb-4">
        <div className="explore-bar flex flex-wrap items-center gap-2 lg:flex-nowrap">
          <SearchField value={f.q} onChange={(q) => set('q', q)} placeholder="Search places or dishes" className="explore-search lg:w-64 lg:shrink-0 xl:w-80" />
          <div className="explore-chips flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
            <div className="explore-quick-chips contents">
              {EXPLORE_TYPES.map(([type, label]) => (
                <Chip key={type} active={f.type === type} onClick={() => update((p) => {
                  if (f.type === type) p.delete('type'); else p.set('type', type)
                  p.delete('meal')
                })}><TypeMark type={type} label />{label}</Chip>
              ))}
              <span className="mx-1 hidden h-5 border-l border-ink/15 sm:block" aria-hidden="true" />
              <Chip active={f.openNow} onClick={() => update((p) => {
                if (f.openNow) p.delete('open'); else { p.set('open', '1'); p.delete('date') }
              })}>Open now</Chip>
            </div>
            <button type="button" aria-expanded={filtersShown} aria-controls="explore-filters" data-on={extras > 0 || undefined} onClick={() => setFiltersShown(!filtersShown)} className="chip">
              <Icon of={Setting4} />Filters{extras > 0 && <span className="min-w-5 rounded bg-accent-ink/12 px-1 text-center text-xs tabular-nums">{extras}</span>}
            </button>
            {filtered && <button type="button" aria-label="Clear filters" onClick={clear} className="explore-clear flex h-10 shrink-0 cursor-pointer items-center gap-1.5 px-2 text-sm text-muted hover:text-ink"><Icon of={CloseCircle} /><span>Clear</span></button>}
          </div>
          <div className="ml-auto hidden shrink-0 sm:block">
            <Segmented label="View" options={[['map', 'Map'], ['list', 'List']]} value={list ? 'list' : 'map'} onChange={(v) => set('view', v === 'list' ? 'list' : undefined)} />
          </div>
        </div>
        {f.type === 'hall' && (
          <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Dining meal">
            <span className="mr-1 text-sm text-muted">Meal</span>
            {DINING_MEALS.map((m) => <Chip key={m} active={f.meal === m} onClick={() => set('meal', f.meal === m ? undefined : m)}>{MEAL_LABEL[m]}</Chip>)}
          </div>
        )}
        {/* Over the map, the filters open down its left side, where a picked place opens: the pins stay in view as they change */}
        <div id="explore-filters" hidden={!filtersShown} className="explore-filters @container mt-3 rounded-xl p-4 sm:p-5">
          <div className="grid gap-x-4 gap-y-5 @xl:grid-cols-3">
            <Field label="Access">
              <Select value={f.access ?? ''} onChange={(e) => set('access', e.target.value)}>
                <option value="">Anyone</option>
                {EXPLORE_ACCESS.map((a) => <option key={a} value={a}>{ACCESS_LABEL[a]}</option>)}
              </Select>
            </Field>
            <Field label="Menu date" hint="For menus; open now stays live">
              <input type="date" value={f.date} min={menuFrom} max={addDaysISO(menuTo, -1)} onChange={(e) => update((p) => { p.set('date', e.target.value); if (e.target.value !== now.date) p.delete('open') })} className="filter-select" />
            </Field>
            <Field label="College or site">
              <Select value={f.site ?? ''} onChange={(e) => set('site', e.target.value)}>
                <option value="">Everywhere</option>
                {(['college', 'university'] as const).map((kind) => <optgroup key={kind} label={kind === 'college' ? 'Colleges' : 'University'}>{sites.filter((s) => s.kind === kind).map((s) => <option key={s.slug} value={s.slug}>{s.short_name ?? s.name}</option>)}</optgroup>)}
              </Select>
            </Field>
          </div>
          <fieldset className="mt-6">
            <legend className="text-sm font-semibold">Dietary</legend>
            <p className="mt-0.5 text-sm text-muted">Dish labels where there’s a menu, else what the venue says it offers.</p>
            <div className="mt-3 flex flex-wrap gap-2">{EXPLORE_DIETS.map((tag) => <Chip key={tag} active={f.diets.includes(tag)} onClick={() => set('diet', (f.diets.includes(tag) ? f.diets.filter((d) => d !== tag) : [...f.diets, tag]).join(','))}>{DIET_LABEL[tag]}</Chip>)}</div>
          </fieldset>
          <div className="mt-6 flex items-center gap-2 border-t border-ink/10 pt-4">
            {extras > 0 && <button type="button" onClick={clearMore} className="-ml-3 h-10 cursor-pointer rounded-lg px-3 text-sm text-muted underline-offset-4 hover:text-ink hover:underline">Reset filters</button>}
            <button type="button" onClick={() => setFiltersShown(false)} className="btn btn-primary ml-auto">{results.length ? `Show ${results.length} ${results.length === 1 ? 'place' : 'places'}` : 'No places match'}</button>
          </div>
        </div>
        {!filtersShown && extras > 0 && <p className="mt-3 text-sm text-muted">{[f.access && ACCESS_LABEL[f.access], ...f.diets.map((d) => DIET_LABEL[d]), f.date !== now.date && `menus for ${formatISODate(f.date)}`, f.site && siteName(f.site)].filter(Boolean).join(', ')}</p>}
      </div>

      {list ? (
        <section aria-label="Matching places">
          <p className="mb-1 text-sm text-muted">{places}</p>
          {results.length ? <ul className="grid gap-x-10 lg:grid-cols-2">{results.map((r) => <VenueCard key={r.venue.id} venue={r.venue} status={r.status} now={now} dishes={resultDishes(r, f)} showSite={!f.site} date={f.date} showAccess />)}</ul> : <Empty onClear={clear} />}
        </section>
      ) : (
        <section ref={mapShell} className={`explore-map-shell relative isolate overflow-hidden bg-ink/5 sm:rounded-xl sm:border sm:border-ink/10 ${selected || filtersShown ? 'has-panel' : ''}`} aria-label="Map of matching places" onKeyDown={(e) => { if (e.key === 'Escape') set('place') }}>
          <VenueMap results={results} selected={selected?.venue.id} onSelect={select} snapshot={snapshot} filtered={filtered} panel={panel} />
          {!results.length && <div className="raised absolute inset-x-4 top-20 z-500 mx-auto max-w-sm rounded-xl p-5"><Empty onClear={clear} /></div>}
          {results.length > 0 && unmapped === results.length && <div className="raised absolute inset-x-4 top-24 z-500 mx-auto max-w-sm rounded-xl p-5 text-center"><p className="font-medium">{results.length === 1 ? 'This place isn’t mapped yet.' : 'These places aren’t mapped yet.'}</p><button type="button" onClick={() => set('view', 'list')} className="link mt-3 cursor-pointer text-sm">Show the list</button></div>}
          {/* Key and count, in the corner the map leaves free */}
          <div className="map-key raised absolute bottom-4 left-4 z-450 hidden items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-muted sm:flex">
            {EXPLORE_TYPES.map(([type]) => <span key={type} className="flex items-center gap-1.5"><span aria-hidden="true" className="type-dot" data-type={type} />{TYPE_LABEL[type]}</span>)}
            {!snapshot && <span aria-hidden="true" className="h-3 border-l border-ink/20" />}
            {!snapshot && <span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-full bg-ink" />Open now</span>}
            {!snapshot && <span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-full border-2 border-ink" />Not open</span>}
            <span aria-hidden="true" className="h-3 border-l border-ink/20" />
            <span className="text-ink">{places}</span>
            {unmapped > 0 && <button type="button" onClick={() => set('view', 'list')} className="cursor-pointer underline underline-offset-4 hover:text-ink">{unmapped} not on the map</button>}
          </div>
          {selected && <VenuePanel ref={panel} r={selected} dishes={resultDishes(selected, f)} date={f.date} results={results} formalSelected={f.meal === 'formal'} onSelect={select} onClose={() => set('place')} />}
        </section>
      )}
      {/* On a phone, one button switches between the map and the list */}
      {!(selected && !list) && !filtersShown && (
        <button type="button" onClick={() => set('view', list ? undefined : 'list')} className="btn btn-primary fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-900 -translate-x-1/2 shadow-lg sm:hidden">
          <Icon of={list ? MapIcon : ListIcon} />
          {list ? 'Map' : `List · ${results.length}`}
        </button>
      )}
    </div>
  )
}

/** A labelled control in the filters panel, with an optional note under it. */
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold">{label}</span>
      <span className="mt-1.5 block">{children}</span>
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

function Empty({ onClear }: { onClear: () => void }) {
  return <div className="py-5 text-center"><p className="font-medium">No places match.</p><button type="button" onClick={onClear} className="link mt-2 cursor-pointer text-sm text-muted">Clear filters</button></div>
}
