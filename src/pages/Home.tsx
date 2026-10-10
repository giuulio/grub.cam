import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, NavLink, useSearchParams } from 'react-router'
import { CloseCircle, List as ListIcon, Map as MapIcon, Search } from 'reicon-react'
import { Chip, Select } from '../components/Controls.tsx'
import { Icon } from '../components/Icon.tsx'
import { ListWithMap, VenueListing } from '../components/Listing.tsx'
import { useReady } from '../lib/data.tsx'
import { applyFilters, DIET_LABEL, MEAL_LABEL } from '../lib/filters.ts'
import { FILTER_DIETS, FILTER_MEALS, hasLocation, legacyPath, readFilters, resultDishes, SCOPES, scopeInfo, type Scope } from '../lib/finder.ts'
import { SCOPE_ICON } from '../lib/icons.ts'
import { formatDistance, inCambridge, metresBetween, type Point } from '../lib/map.ts'
import { normalizeSearch } from '../lib/search.ts'
import { SITE_NAME } from '../lib/site.ts'
import { addDaysISO, formatISODate, relativeDay } from '../lib/time/clock.ts'
import { isFormalOnly, type Venue } from '../lib/types.ts'
import { useNow } from '../lib/useNow.ts'

/** What a tab keeps when another is picked: the search, the college and open now (the rest is Dining's own). */
const SHARED = ['q', 'site', 'open']

/**
 * The front page, and the one place to find somewhere: what the site is, a tab per kind of venue (each its own address:
 * /, /dining, /cafes, /bars, /formal), one search box; then that tab's venues as cards beside the map, with the
 * filters that matter for it. The heading and search are laid out as Tripadvisor's; the list as TheFork's.
 */
export function Home({ scope }: { scope: Scope }) {
  const [params] = useSearchParams()
  // Links from before the tabs: Explore's ?type= and a picked ?venue=
  if (scope === 'all' && ['type', 'venue', 'place'].some((k) => params.has(k))) return <Navigate to={legacyPath(params)} replace />
  return <Finder key={scope} scope={scope} />
}

/** /explore, from before the tabs, goes to the tab its filters name. */
export function FromExplore() {
  const [params] = useSearchParams()
  return <Navigate to={legacyPath(params)} replace />
}

function Finder({ scope }: { scope: Scope }) {
  const { venues, sites, snapshot, menuFrom, menuTo } = useReady()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const results = useRef<HTMLDivElement>(null)
  // The card under the pointer, picked out on the map
  const [hover, setHover] = useState<string>()
  // Nearest first: where you are, asked for only on the click and kept in memory
  const [here, setHere] = useState<Point>()
  const [locating, setLocating] = useState(false)
  const [note, setNote] = useState('')

  const info = scopeInfo(scope)
  const f = readFilters(params, scope, now.date, sites, menuFrom, menuTo)
  // Dining is the everyday meals: a Hall used only for formal hall is under Formal hall
  const found = applyFilters(venues, f, now).filter((r) => scope !== 'hall' || !isFormalOnly(r.venue))
  const metres = (v: Venue) => (here && hasLocation(v) ? metresBetween(here, v) : undefined)
  const ranked = here ? [...found].sort((a, b) => (metres(a.venue) ?? Infinity) - (metres(b.venue) ?? Infinity)) : found
  const searching = !!normalizeSearch(f.q)

  const update = (fn: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params)
    fn(next)
    setParams(next, { replace: true })
  }
  const set = (key: string, value?: string) => update((p) => (value ? p.set(key, value) : p.delete(key)))
  const filtered = !!(f.q || f.openNow || f.site || (scope === 'hall' && f.meal) || f.diets.length || f.date !== now.date || here)
  const clear = () => {
    update((p) => { for (const k of ['q', 'open', 'site', 'meal', 'diet', 'date']) p.delete(k) })
    setHere(undefined)
  }
  const tabSearch = () => {
    const keep = new URLSearchParams()
    for (const k of SHARED) if (params.get(k) != null) keep.set(k, params.get(k)!)
    return keep.toString() ? `?${keep}` : ''
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    ;(document.activeElement as HTMLElement | null)?.blur()
    results.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const locate = () => {
    if (here) return setHere(undefined)
    if (!navigator.geolocation) return setNote('Your browser doesn’t share its location.')
    setLocating(true)
    setNote('')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false)
        const p = { latitude: coords.latitude, longitude: coords.longitude }
        if (inCambridge(p)) setHere(p)
        else setNote('You’re outside Cambridge, so the list stays as it is.')
      },
      (err) => {
        setLocating(false)
        setNote(err.code === 1 ? 'Location access was denied.' : 'Couldn’t find your location. Try again.')
      },
      { timeout: 10000, maximumAge: 60000 },
    )
  }
  const dates = Array.from({ length: Math.max(0, (Date.parse(menuTo) - Date.parse(menuFrom)) / 86400000) }, (_, i) => addDaysISO(menuFrom, i))
  const count = `${ranked.length} ${ranked.length === 1 ? info.noun[0] : info.noun[1]}`
  const mapView = params.get('view') === 'map'

  return (
    <>
      <title>{scope === 'all' ? `${SITE_NAME}: Cambridge college and University menus` : `${info.heading} · ${SITE_NAME}`}</title>
      <section className="text-center">
        {/* As tall as the longest heading at each width, so the tabs under it never move when one is picked */}
        <h1 className="title min-h-[3.3em] text-[2.5rem] leading-[1.1] sm:min-h-[2.2em] sm:text-6xl xl:min-h-0">{info.heading}</h1>
        <nav aria-label="Kinds of venue" className="card-row -mx-4 mt-8 flex gap-7 overflow-x-auto px-4 sm:mx-0 sm:justify-center sm:gap-9 sm:px-0">
          {SCOPES.map((s) => (
            <NavLink
              key={s.scope}
              to={`${s.path}${tabSearch()}`}
              end
              className={({ isActive }) => `flex shrink-0 items-center gap-2 border-b-2 pb-2 text-base font-medium whitespace-nowrap text-ink transition-colors sm:text-lg ${isActive ? 'border-ink' : 'border-transparent hover:border-ink/25'}`}
            >
              <Icon of={SCOPE_ICON[s.scope]} className="size-5" />
              {s.label}
            </NavLink>
          ))}
        </nav>
        <form id="hero-search" role="search" onSubmit={submit} className="hero-search mx-auto mt-6 flex max-w-200 items-center gap-2 rounded-full border border-ink/25 bg-canvas p-1.5 pl-5 text-left shadow-[0_4px_18px_rgb(19_56_68/0.08)]">
          <Icon of={Search} className="size-5 text-ink" />
          <input
            type="search"
            value={f.q}
            onChange={(e) => set('q', e.target.value)}
            placeholder={info.placeholder}
            aria-label={scope === 'all' ? 'Search venues, colleges and dishes' : `Search ${info.label.toLowerCase()}`}
            className="h-11 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted"
          />
          <button type="submit" className="h-11 shrink-0 cursor-pointer rounded-full bg-accent px-6 text-sm font-semibold text-accent-ink transition-[filter] hover:brightness-95">
            Search
          </button>
        </form>
      </section>

      {/* The filters that matter for this tab, as TheFork's row of them above its list */}
      <div ref={results} className="mt-12 scroll-mt-32 border-t border-ink/10 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          {f.date === now.date && !snapshot && <Chip active={f.openNow} onClick={() => set('open', f.openNow ? undefined : '1')}>Open now</Chip>}
          {!snapshot && <Chip active={!!here} onClick={locate}>{locating ? 'Finding you…' : 'Nearest first'}</Chip>}
          <Select value={f.site ?? ''} onChange={(e) => set('site', e.target.value)} aria-label="College or site" className="w-56">
            <option value="">Every college and site</option>
            {(['college', 'university'] as const).map((kind) => (
              <optgroup key={kind} label={kind === 'college' ? 'Colleges' : 'University'}>
                {sites.filter((s) => s.kind === kind).map((s) => <option key={s.slug} value={s.slug}>{s.short_name ?? s.name}</option>)}
              </optgroup>
            ))}
          </Select>
          {scope === 'hall' && (
            <>
              <Select value={f.date} onChange={(e) => set('date', e.target.value === now.date ? undefined : e.target.value)} aria-label="Menus for" className="w-40">
                {dates.map((d) => <option key={d} value={d}>{relativeDay(d, now.date) ?? formatISODate(d)}</option>)}
              </Select>
              <Select value={f.meal ?? ''} onChange={(e) => set('meal', e.target.value)} aria-label="Meal" className="w-36">
                <option value="">Any meal</option>
                {FILTER_MEALS.map((m) => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}
              </Select>
              <Select value={f.diets[0] ?? ''} onChange={(e) => set('diet', e.target.value)} aria-label="Diet" className="w-40">
                <option value="">Any diet</option>
                {FILTER_DIETS.map((t) => <option key={t} value={t}>{DIET_LABEL[t]}</option>)}
              </Select>
            </>
          )}
          <span className="ml-auto flex items-center gap-3 text-sm text-muted">
            {count}
            {filtered && (
              <button type="button" onClick={clear} className="flex cursor-pointer items-center gap-1 hover:text-ink">
                <Icon of={CloseCircle} />
                Clear
              </button>
            )}
          </span>
        </div>
        {note && <p role="status" className="mt-2 text-sm text-muted">{note}</p>}
      </div>

      <div className="mt-6">
        <ListWithMap
          results={ranked}
          highlight={hover ? [hover] : undefined}
          phoneMap={mapView}
          empty={ranked.length ? undefined : <Empty onClear={clear}>No {info.noun[1]} match.</Empty>}
          list={ranked.map((r) => {
            const m = metres(r.venue)
            return <VenueListing key={r.venue.id} r={r} now={now} onHover={setHover} showSite dishes={searching || f.diets.length ? resultDishes(r, f) : undefined} distance={m != null ? formatDistance(m) : undefined} formal={scope === 'formal'} />
          })}
        />
      </div>

      {/* On a phone, one button switches between the list and the map */}
      {!snapshot && ranked.length > 0 && (
        <button
          type="button"
          onClick={() => {
            set('view', mapView ? undefined : 'map')
            results.current?.scrollIntoView({ block: 'start' })
          }}
          className="btn btn-primary fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-50 -translate-x-1/2 rounded-full shadow-lg lg:hidden">
          <Icon of={mapView ? ListIcon : MapIcon} />
          {mapView ? `List · ${ranked.length}` : 'Map'}
        </button>
      )}
    </>
  )
}

function Empty({ onClear, children }: { onClear: () => void; children: ReactNode }) {
  return (
    <div className="py-10 text-center">
      <p className="font-medium">{children}</p>
      <button type="button" onClick={onClear} className="link mt-2 cursor-pointer text-sm text-muted">
        Clear filters
      </button>
    </div>
  )
}
