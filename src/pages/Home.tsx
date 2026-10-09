import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CloseCircle, List as ListIcon, Map as MapIcon, Search, Setting4 } from 'reicon-react'
import { Segmented, Select } from '../components/Controls.tsx'
import { Icon } from '../components/Icon.tsx'
import { VenueCard } from '../components/VenueCard.tsx'
import { VenueMap } from '../components/VenueMap.tsx'
import { PhotoImg } from '../components/VenuePhoto.tsx'
import { venuePhoto } from '../lib/photos.ts'
import { useReady } from '../lib/data.tsx'
import { DINING_MEALS, EXPLORE_ACCESS, EXPLORE_DIETS, EXPLORE_TYPES, hasLocation, readExploreFilters, resultDishes } from '../lib/explore.ts'
import { ACCESS_LABEL, applyFilters, DIET_LABEL, MEAL_LABEL, TYPE_LABEL, type Ranked } from '../lib/filters.ts'
import { TYPE_ICON } from '../lib/icons.ts'
import { SITE_NAME, venuePath } from '../lib/site.ts'
import { addDaysISO, formatISODate } from '../lib/time/clock.ts'
import { isFormalOnly, venueTypes } from '../lib/types.ts'
import { useNow } from '../lib/useNow.ts'

export function Home() {
  const { sites, venues, snapshot, menuFrom, menuTo } = useReady()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const [filtersShown, setFiltersShown] = useState(false)
  const page = useRef<HTMLDivElement>(null)
  const controls = useRef<HTMLDivElement>(null)
  const mapShell = useRef<HTMLElement>(null)
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
  // The filters panel sits over the map: a click outside it or Escape closes it
  useEffect(() => {
    if (!filtersShown) return
    const outside = (e: PointerEvent) => { if (controls.current && !controls.current.contains(e.target as Node)) setFiltersShown(false) }
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setFiltersShown(false) }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [filtersShown])
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
      <div ref={controls} className="explore-controls relative z-[800] mb-4">
        <div className="explore-bar flex flex-wrap items-center gap-2 lg:flex-nowrap">
          <label className="explore-search flex h-11 w-full items-center gap-3 rounded-full border border-ink/15 bg-canvas px-4 text-muted focus-within:border-ink/40 sm:h-10 lg:w-64 lg:shrink-0 xl:w-80">
            <Icon of={Search} />
            <input type="search" value={f.q} onChange={(e) => set('q', e.target.value)} placeholder="Search places or dishes" aria-label="Search places or dishes" className="w-full min-w-0 bg-transparent text-ink outline-none placeholder:text-muted" />
          </label>
          <div className="explore-chips flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
            <div className="explore-quick-chips contents">
              {EXPLORE_TYPES.map(([type, label]) => (
                <Chip key={type} active={f.type === type} onClick={() => update((p) => {
                  if (f.type === type) p.delete('type'); else p.set('type', type)
                  p.delete('meal')
                })}><span className="type-swatch" data-type={type}><Icon of={TYPE_ICON[type]} className="size-3" /></span>{label}</Chip>
              ))}
              <span className="mx-1 hidden h-5 border-l border-ink/15 sm:block" aria-hidden="true" />
              <Chip active={f.openNow} onClick={() => update((p) => {
                if (f.openNow) p.delete('open'); else { p.set('open', '1'); p.delete('date') }
              })}>Open now</Chip>
            </div>
            <button type="button" aria-expanded={filtersShown} aria-controls="explore-filters" onClick={() => setFiltersShown(!filtersShown)} className={`${chipClass} ${filtersShown || extras ? 'border-ink/50 text-ink' : 'border-ink/15 text-muted hover:border-ink/40 hover:text-ink'}`}>
              <Icon of={Setting4} />Filters{extras > 0 ? ` · ${extras}` : ''}
            </button>
            {filtered && <button type="button" aria-label="Clear filters" onClick={clear} className="explore-clear flex min-h-10 shrink-0 cursor-pointer items-center gap-1 px-2 text-sm text-muted hover:text-ink"><Icon of={CloseCircle} /><span>Clear</span></button>}
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
        <div id="explore-filters" hidden={!filtersShown} className="explore-filters mt-3 rounded-2xl border border-ink/10 bg-canvas p-4 sm:absolute sm:top-full sm:left-0 sm:mt-2 sm:w-[min(44rem,100%)] sm:p-5 sm:shadow-xl">
          <div className="grid gap-x-4 gap-y-5 sm:grid-cols-3">
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
            <p className="mt-0.5 text-xs text-muted">Dish labels where there’s a menu, else what the venue says it offers.</p>
            <div className="mt-3 flex flex-wrap gap-2">{EXPLORE_DIETS.map((tag) => <Chip key={tag} active={f.diets.includes(tag)} onClick={() => set('diet', (f.diets.includes(tag) ? f.diets.filter((d) => d !== tag) : [...f.diets, tag]).join(','))}>{DIET_LABEL[tag]}</Chip>)}</div>
          </fieldset>
          <div className="mt-6 flex items-center gap-2 border-t border-ink/10 pt-4">
            {extras > 0 && <button type="button" onClick={clearMore} className="-ml-3 h-10 cursor-pointer rounded-full px-3 text-sm text-muted underline-offset-4 hover:text-ink hover:underline">Reset filters</button>}
            <button type="button" onClick={() => setFiltersShown(false)} className="ml-auto h-10 cursor-pointer rounded-full bg-ink px-5 text-sm font-medium text-canvas">{results.length ? `Show ${results.length} ${results.length === 1 ? 'place' : 'places'}` : 'No places match'}</button>
          </div>
        </div>
        {!filtersShown && extras > 0 && <p className="mt-3 text-sm text-muted">{[f.access && ACCESS_LABEL[f.access], ...f.diets.map((d) => DIET_LABEL[d]), f.date !== now.date && `Menus for ${formatISODate(f.date)}`, f.site && siteName(f.site)].filter(Boolean).join(' · ')}</p>}
      </div>

      {list ? (
        <section aria-label="Matching places">
          <p className="mb-2 text-sm text-muted">{places}</p>
          {results.length ? <ul className="divide-y divide-ink/10 border-t border-ink/10">{results.map((r) => <VenueCard key={r.venue.id} venue={r.venue} status={r.status} now={now} dishes={resultDishes(r, f)} showSite={!f.site} date={f.date} showAccess />)}</ul> : <Empty onClear={clear} />}
        </section>
      ) : (
        <section ref={mapShell} className="explore-map-shell relative isolate overflow-hidden bg-ink/5 sm:rounded-2xl sm:border sm:border-ink/10" aria-label="Map of matching places" onKeyDown={(e) => { if (e.key === 'Escape') set('place') }}>
          <VenueMap results={results} selected={selected?.venue.id} onSelect={select} snapshot={snapshot} filtered={filtered} />
          {!results.length && <div className="absolute inset-x-4 top-20 z-[500] mx-auto max-w-sm rounded-2xl bg-canvas p-5 shadow-sm"><Empty onClear={clear} /></div>}
          {results.length > 0 && unmapped === results.length && <div className="absolute inset-x-4 top-24 z-[500] mx-auto max-w-sm rounded-2xl bg-canvas p-5 text-center shadow-sm"><p className="font-medium">{results.length === 1 ? 'This place isn’t mapped yet.' : 'These places aren’t mapped yet.'}</p><button type="button" onClick={() => set('view', 'list')} className="mt-3 text-sm underline underline-offset-4">Show the list</button></div>}
          {/* Key and count, in the corner the map leaves free */}
          <div className="map-key absolute bottom-4 left-4 z-[450] hidden items-center gap-3 rounded-full bg-canvas/95 px-3.5 py-2 text-xs text-muted shadow-sm sm:flex">
            {EXPLORE_TYPES.map(([type]) => <span key={type} className="flex items-center gap-1.5"><span aria-hidden="true" className="type-dot" data-type={type} />{TYPE_LABEL[type]}</span>)}
            {!snapshot && <span aria-hidden="true" className="h-3 border-l border-ink/20" />}
            {!snapshot && <span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-full bg-ink" />Open now</span>}
            {!snapshot && <span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-full border-2 border-ink" />Not open</span>}
            <span aria-hidden="true" className="h-3 border-l border-ink/20" />
            <span className="text-ink">{places}</span>
            {unmapped > 0 && <button type="button" onClick={() => set('view', 'list')} className="cursor-pointer underline underline-offset-4 hover:text-ink">{unmapped} not on the map</button>}
          </div>
          {selected && <SelectedPlace r={selected} dishes={resultDishes(selected, f)} date={f.date} results={results} formalSelected={f.meal === 'formal'} onSelect={select} onClose={() => set('place')} />}
        </section>
      )}
      {/* On a phone, one button switches between the map and the list */}
      {!(selected && !list) && !filtersShown && (
        <button type="button" onClick={() => set('view', list ? undefined : 'list')} className="fixed bottom-5 left-1/2 z-[900] flex h-11 -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-canvas shadow-lg sm:hidden">
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

const chipClass = 'flex min-h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm transition-colors'
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`${chipClass} ${active ? 'border-ink bg-ink text-canvas' : 'border-ink/15 text-muted hover:border-ink/40 hover:text-ink'}`}>{children}</button>
}
function Empty({ onClear }: { onClear: () => void }) {
  return <div className="py-5 text-center"><p className="font-medium">No places match.</p><button type="button" onClick={onClear} className="mt-2 text-sm text-muted underline underline-offset-4">Clear filters</button></div>
}

function SelectedPlace({ r, dishes, date, results, formalSelected, onSelect, onClose }: { r: Ranked; dishes: string[]; date: string; results: Ranked[]; formalSelected: boolean; onSelect: (id: string) => void; onClose: () => void }) {
  const { snapshot } = useReady()
  const now = useNow()
  const v = r.venue
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => { close.current?.focus({ preventScroll: true }) }, [v.id])
  // Places in the same building (same point), whose pins sit beside this one
  const others = results.filter((o) => o.venue.id !== v.id && hasLocation(v) && hasLocation(o.venue) && v.latitude === o.venue.latitude && v.longitude === o.venue.longitude)
  // The service the status is about; formal hall is booked, so it's "Formal hall", never "Opens"
  const slot = r.status.kind === 'open' || r.status.kind === 'opening' ? r.status.slot : r.status.kind === 'closed' ? r.status.next?.slot : undefined
  const formal = slot?.meal === 'formal'
  const verb = formal ? 'Formal hall' : 'Opens'
  const status = r.status.kind === 'open' ? `${formal ? 'Formal hall' : 'Open'} until ${r.status.slot.end}` : r.status.kind === 'opening' ? `${verb} at ${r.status.slot.start}` : r.status.kind === 'unknown' ? 'Hours not published' : r.status.next ? `${verb} ${r.status.next.date === now.date ? 'today' : formatISODate(r.status.next.date)} at ${r.status.next.slot.start}` : 'Closed'
  const photo = venuePhoto(v)
  return (
    <div className="selected-place absolute right-3 bottom-12 left-3 z-[600] max-h-[75%] overflow-y-auto rounded-2xl bg-canvas p-5 text-ink shadow-lg sm:right-auto sm:bottom-6 sm:left-6 sm:max-h-[70%] sm:w-80" aria-label="Selected place">
      {photo && <PhotoImg photo={photo} sizes="20rem" className="-mx-5 -mt-5 mb-4 w-[calc(100%+2.5rem)] max-w-none rounded-t-2xl" />}
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-sm text-muted">{v.site.short_name ?? v.site.name}</p><h2 className="mt-1 text-xl font-semibold tracking-tight">{v.name}</h2></div>
        <button ref={close} type="button" aria-label="Close selected place" onClick={onClose} className="-mt-1 -mr-1 flex size-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-ink/5"><Icon of={CloseCircle} className="size-5" /></button>
      </div>
      <p className="mt-2 text-sm">{[...venueTypes(v).map((t) => TYPE_LABEL[t]), v.access.level !== 'unknown' && ACCESS_LABEL[v.access.level]].filter(Boolean).join(' · ')}</p>
      {!snapshot && <p className="mt-2 text-sm font-medium">{status}</p>}
      {(formalSelected || formal || isFormalOnly(v)) && <p className="mt-1 text-xs text-muted">Booking required for formal hall.</p>}
      {dishes.length > 0 && <div className="mt-4 border-t border-ink/10 pt-3"><p className="text-xs text-muted">{formatISODate(date)}</p><p className="mt-1 text-sm">{dishes.slice(0, 3).join(' · ')}</p></div>}
      <Link to={`${venuePath(v)}?date=${date}`} className="mt-4 inline-flex min-h-10 items-center rounded-full bg-ink px-4 py-2 text-sm font-medium text-canvas">Menus & details <span className="ml-2" aria-hidden="true">→</span></Link>
      {others.length > 0 && <div className="mt-4 border-t border-ink/10 pt-3"><p className="mb-1 text-xs text-muted">Also here</p>{others.map((o) => <button key={o.venue.id} type="button" onClick={() => onSelect(o.venue.id)} className="block min-h-10 w-full py-2 text-left text-sm underline underline-offset-4">{o.venue.site.slug !== v.site.slug ? `${o.venue.site.short_name ?? o.venue.site.name} · ` : ''}{o.venue.name}</button>)}</div>}
    </div>
  )
}
