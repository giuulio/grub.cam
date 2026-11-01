import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { Link, Navigate, NavLink, useSearchParams } from 'react-router'
import { Clock, CloseCircle, Gps, Leaf, List as ListIcon, Map as MapIcon, Plate } from 'reicon-react'
import { ChipSelect } from '../components/Controls.tsx'
import { FormalCompare } from '../components/FormalCompare.tsx'
import { HeaderSearch } from '../components/Header.tsx'
import { Icon } from '../components/Icon.tsx'
import { NoMenuLine, VenueRow } from '../components/Listing.tsx'
import { SitePicker } from '../components/SitePicker.tsx'
import { VenueMap } from '../components/VenueMap.tsx'
import { useReady } from '../lib/data.tsx'
import { tabCoverage } from '../lib/coverage.ts'
import { applyFilters, DIET_LABEL, MEAL_LABEL, type Ranked } from '../lib/filters.ts'
import { SCOPE_ICON } from '../lib/icons.ts'
import { FILTER_DIETS, FILTER_MEALS, hasLocation, legacyPath, readFilters, resultDishes, SCOPES, scopeInfo, SHARED_FILTERS, type Scope } from '../lib/finder.ts'
import { formatDistance, inCambridge, metresBetween, type Point } from '../lib/map.ts'
import { normalizeSearch } from '../lib/search.ts'
import { TAB_TITLES } from '../lib/seo.ts'
import { addDaysISO, formatISODate, relativeDay } from '../lib/time/clock.ts'
import { isFormalOnly, type Venue } from '../lib/types.ts'
import { useMedia } from '../lib/useMedia.ts'
import { useNow } from '../lib/useNow.ts'

/**
 * The front page, and the one place to find somewhere: what the site is, a tab per kind of venue (each its own address:
 * /, /dining, /cafes, /bars, /formal), one search box; then that tab's venues as Airbnb lists homes, a row each down
 * the left under the filters that matter for it, with the map beside them; on a phone, the map, full screen. The
 * heading and search are laid out as Tripadvisor's.
 */
export function Home({ scope }: { scope: Scope }) {
  const [params] = useSearchParams()
  // Links from before the tabs: Explore's ?type= and a picked ?venue=
  if (scope === 'all' && ['type', 'venue', 'place'].some((k) => params.has(k))) return <Navigate to={legacyPath(params)} replace />
  // One finder for every tab, so its map (and where it's looking) stays as the tabs change
  return <Finder scope={scope} />
}

/** /explore, from before the tabs, goes to the tab its filters name. */
export function FromExplore() {
  const [params] = useSearchParams()
  return <Navigate to={legacyPath(params)} replace />
}

/** Rows shown at a time, before "Show more" */
const PAGE = 24

function Finder({ scope }: { scope: Scope }) {
  const { venues, sites, snapshot, menuFrom, menuTo } = useReady()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const results = useRef<HTMLDivElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  // From a tablet up, the list and the map side by side; on a phone, the map (or, asked for, the list)
  const split = useMedia('(min-width: 768px)')
  // The venue whose pin was picked: beside the map, its row alone is the list; on a phone, its card shows over the map
  const [selected, setSelected] = useState<string>()
  // The row under the pointer, picked out on the map
  const [hover, setHover] = useState<string>()
  // Nearest first: where you are, asked for only on the click and kept in memory
  const [here, setHere] = useState<Point>()
  const [locating, setLocating] = useState(false)
  const [note, setNote] = useState('')
  // How many rows show: a page at a time, back to one whenever the tab or the filters change
  const [shown, setShown] = useState(PAGE)
  const view = `${scope}?${params}`
  const [shownFor, setShownFor] = useState(view)
  if (view !== shownFor) {
    setShownFor(view)
    setShown(PAGE)
  }
  // Another tab is another list: nothing picked or pointed at in it yet (where you are is kept)
  const [tab, setTab] = useState(scope)
  if (tab !== scope) {
    setTab(scope)
    setSelected(undefined)
    setHover(undefined)
    setNote('')
  }
  const side = useRef<HTMLDivElement>(null)
  useEffect(() => { side.current?.scrollTo({ top: 0 }) }, [scope])

  const info = scopeInfo(scope)
  const f = readFilters(params, scope, now.date, sites, menuFrom, menuTo)
  // Dining is the everyday meals: a Hall used only for formal hall is under Formal hall
  // The sites with venues in the tab whatever else is picked, so the site picker can grey the rest
  const inTab = new Set(applyFilters(venues, { ...f, q: '', sites: undefined, kind: undefined, openNow: false, diets: [], meal: scope === 'formal' ? f.meal : undefined }, now).filter((r) => scope !== 'hall' || !isFormalOnly(r.venue)).map((r) => r.venue.site.slug))
  const found = applyFilters(venues, f, now).filter((r) => scope !== 'hall' || !isFormalOnly(r.venue))
  const metres = (v: Venue) => (here && hasLocation(v) ? metresBetween(here, v) : undefined)
  const ranked = here ? [...found].sort((a, b) => (metres(a.venue) ?? Infinity) - (metres(b.venue) ?? Infinity)) : found
  const searching = !!normalizeSearch(f.q)
  // On a phone's map, a search shows its first result's card straight away, the others either side of it (and the map
  // names its pin); clearing the search puts the cards away
  const [searchedFor, setSearchedFor] = useState(f.q)
  if (f.q !== searchedFor) {
    setSearchedFor(f.q)
    if (!split) setSelected(searching ? ranked[0]?.venue.id : undefined)
  }

  const update = (fn: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params)
    fn(next)
    setParams(next, { replace: true })
  }
  const set = (key: string, value?: string) => update((p) => (value ? p.set(key, value) : p.delete(key)))
  // Narrowed past the tab: the map then frames every venue left, not just central Cambridge
  const narrowed = !!(f.q || f.openNow || f.sites?.length || f.kind || (scope === 'hall' && f.meal) || f.diets.length)
  const filtered = narrowed || f.date !== now.date || !!here
  const clear = () => {
    update((p) => { for (const k of ['q', 'open', 'site', 'kind', 'meal', 'diet', 'date']) p.delete(k) })
    setHere(undefined)
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
        // Say what to check: the site's permission, the computer's location services, or just time
        setNote(
          err.code === 1 ? 'Location is blocked for this site. Allow it in your browser’s settings for grub.cam, then try again.'
          : err.code === 2 ? 'Your device couldn’t tell where you are. Check Location Services is on for your browser (on a Mac: System Settings › Privacy & Security › Location Services).'
          : 'Finding you took too long. Try again.',
        )
      },
      { timeout: 10000, maximumAge: 60000 },
    )
  }
  const day = (d: string) => relativeDay(d, now.date) ?? formatISODate(d)
  const dates = Array.from({ length: Math.max(0, (Date.parse(menuTo) - Date.parse(menuFrom)) / 86400000) }, (_, i) => addDaysISO(menuFrom, i))
  const count = `${ranked.length} ${ranked.length === 1 ? info.noun[0] : info.noun[1]}`
  // A phone opens on the map; ?view=list shows the list instead
  const listView = params.get('view') === 'list'
  // The map is only made where it's shown (on a prerendered page, its frame holds the place)
  const showMap = !snapshot && (split || !listView)
  const picked = ranked.find((r) => r.venue.id === selected)
  // Beside the map, a picked pin's venue is the list, alone, until it's let go
  const alone = split && !snapshot ? picked : undefined
  // Dining leads with its menus: a venue without one for the date and meal picked is folded into a line at the foot
  // (unless a search or a diet asked for it by name or dish)
  const folds = scope === 'hall' && !searching && !f.diets.length
  const listed = folds ? ranked.filter((r) => r.next) : ranked
  const unlisted = folds ? ranked.filter((r) => !r.next) : []
  // A prerendered page lists every venue, for whoever reads it without the script
  const rows = alone ? [alone] : snapshot ? listed : listed.slice(0, shown)
  const pick = (id?: string) => {
    setSelected(id)
    // The row under the pointer may be about to go
    setHover(undefined)
  }
  // The list comes back where it was left: kept as a pin is picked, the venue alone shown from the top
  const listAt = useRef(0)
  const aloneId = alone?.venue.id
  useLayoutEffect(() => {
    const el = side.current
    if (!el) return
    if (aloneId) el.scrollTo({ top: 0 })
    else el.scrollTo({ top: listAt.current })
  }, [aloneId])
  const pickPin = (id?: string) => {
    if (split && !selected && side.current) listAt.current = side.current.scrollTop
    pick(id)
  }
  const rowProps = (r: Ranked) => {
    const m = metres(r.venue)
    return { r, now, dishes: searching || f.diets.length ? resultDishes(r, f) : undefined, distance: m != null ? formatDistance(m) : undefined, formal: scope === 'formal' }
  }
  const switchView = () => {
    set('view', listView ? undefined : 'list')
    if (listView) window.scrollTo({ top: 0 })
    else requestAnimationFrame(() => results.current?.scrollIntoView({ block: 'start' }))
  }

  // On a phone's map, what's over its foot (the picked venue's cards, the list button) rides above the keyboard while
  // it's up: the keyboard only shrinks what's visible (the visual viewport), not the page
  useEffect(() => {
    const el = results.current
    const vv = window.visualViewport
    if (split || listView || !el || !vv) return
    const place = () => {
      const covered = Math.max(0, Math.round(el.getBoundingClientRect().bottom - (vv.offsetTop + vv.height)))
      el.style.setProperty('--keyboard', `${covered}px`)
      el.toggleAttribute('data-keyboard', covered > 0)
    }
    place()
    vv.addEventListener('resize', place)
    vv.addEventListener('scroll', place)
    window.addEventListener('scroll', place, { passive: true })
    return () => {
      vv.removeEventListener('resize', place)
      vv.removeEventListener('scroll', place)
      window.removeEventListener('scroll', place)
      el.style.removeProperty('--keyboard')
      el.removeAttribute('data-keyboard')
    }
  }, [split, listView])

  // On a phone's map, the map fills the screen below the header: measured from the top of the page
  useLayoutEffect(() => {
    const el = results.current
    if (split || listView || !el) return
    const measure = () => el.style.setProperty('--finder-top', `${Math.round(el.getBoundingClientRect().top + window.scrollY)}px`)
    measure()
    const observer = new ResizeObserver(measure)
    const header = document.querySelector('header')
    if (header) observer.observe(header)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [split, listView])

  const toggle = (
    <button type="button" onClick={switchView} className="btn btn-primary pointer-events-auto rounded-full shadow-lg md:hidden">
      <Icon of={listView ? MapIcon : ListIcon} />
      {listView ? 'Map' : `List · ${ranked.length}`}
    </button>
  )

  return (
    <>
      <title>{TAB_TITLES[info.path]}</title>

      {/* The heading, the filters (staying at the top as it scrolls) and the list down the left, scrolling on their own,
          and a square map beside them; a picked pin's card over the map's foot. On a phone, the map fills the screen
          with the filters over its top and the picked venue's card over its foot (swipe for the next), or the list. */}
      <div ref={results} className={`finder ${listView ? 'is-list' : 'is-map'}`}>
        {/* On a phone, the search is the map's (or the list's), not the header's */}
        <HeaderSearch finder className="finder-search md:hidden" />
        <div ref={side} className="finder-side md:@container">
          {/* What this tab is, in the words people search for, read out; what's shown is the switch between tabs */}
          <h1 className="sr-only">{info.heading}</h1>
          <ScopeSwitch />
          <div className="finder-filters card-row flex items-center gap-2">
            {/* Hours, as Google Maps': open now first; on Dining, then which day's menus */}
            {(scope === 'hall' || !snapshot) && (
              <ChipSelect
                label="Hours"
                icon={Clock}
                value={f.openNow ? 'open' : scope === 'hall' ? f.date : ''}
                text={f.openNow ? 'Open now' : scope === 'hall' ? day(f.date) : 'Hours'}
                on={f.openNow || f.date !== now.date}
                options={[...(snapshot ? [] : [['open', 'Open now'] as [string, string], null]), ...(scope === 'hall' ? dates.map((d): [string, string] => [d, day(d)]) : [['', 'Any time'] as [string, string]])]}
                onChange={(v) => update((p) => {
                  if (v === 'open') p.set('open', '1')
                  else p.delete('open')
                  if (v === 'open' || !v || v === now.date) p.delete('date')
                  else p.set('date', v)
                })}
              />
            )}
            <SitePicker
              sites={sites}
              available={inTab}
              value={f.sites ?? []}
              kind={f.kind}
              onChange={(slugs, kind) => update((p) => {
                if (slugs.length) p.set('site', slugs.join(','))
                else p.delete('site')
                if (kind) p.set('kind', kind)
                else p.delete('kind')
              })}
            />
            {/* The same four on every tab, so the row doesn't change under you; the meal and diet are of Dining's menus */}
            <ChipSelect label="Meal" icon={Plate} value={f.meal ?? ''} off={scope === 'hall' ? undefined : 'For Dining halls’ menus'} onChange={(m) => set('meal', m)} options={[['', 'Any meal'], ...FILTER_MEALS.map((m): [string, string] => [m, MEAL_LABEL[m]])]} />
            <ChipSelect label="Diet" icon={Leaf} value={f.diets[0] ?? ''} off={scope === 'hall' ? undefined : 'For Dining halls’ menus'} onChange={(d) => set('diet', d)} options={[['', 'Any diet'], ...FILTER_DIETS.map((t): [string, string] => [t, DIET_LABEL[t]])]} />
          </div>
          {note && <p role="status" className="finder-note text-sm text-muted">{note}</p>}
          <section aria-label={`${info.label} venues`} className="finder-list">
            <div className="flex items-center justify-between gap-3 py-1 text-[0.9375rem]">
              {alone ? (
                <button type="button" onClick={() => pick(undefined)} className="flex cursor-pointer items-center gap-1.5 font-medium hover:underline">
                  <Icon of={CloseCircle} className="size-4.5" />
                  Show all {count}
                </button>
              ) : (
                <h2 className="font-medium">{count}</h2>
              )}
              {filtered && (
                <button type="button" onClick={clear} className="flex cursor-pointer items-center gap-1 text-sm text-muted hover:text-ink">
                  <Icon of={CloseCircle} />
                  Clear
                </button>
              )}
            </div>
            {ranked.length ? (
              rows.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {rows.map((r) => <VenueRow key={r.venue.id} {...rowProps(r)} selected={!alone && r.venue.id === selected} onHover={setHover} />)}
                </ul>
              )
            ) : (
              <Empty onClear={clear}>No {info.noun[1]} match.</Empty>
            )}
            {!alone && rows.length < listed.length && (
              <div className="flex justify-center py-6">
                <button type="button" onClick={() => setShown(shown + PAGE)} className="btn btn-secondary">
                  Show {Math.min(PAGE, listed.length - rows.length)} more
                </button>
              </div>
            )}
            {!alone && rows.length >= listed.length && <NoMenuLine rows={unlisted} onHover={setHover} />}
            {/* How much the tab has, at the foot of its list, where its rows are done */}
            {!alone && <CoverageLine scope={scope} />}
          </section>
          {scope === 'formal' && !alone && <FormalCompare venues={venues} />}
        </div>
        {(showMap || (snapshot && !listView)) && (
          <div className="finder-map">
            {showMap ? (
              <VenueMap
                results={ranked}
                selected={selected}
                highlight={hover ? [hover] : undefined}
                onSelect={pickPin}
                onBackground={() => pick(undefined)}
                filtered
                panel={sheet}
                inset={split ? { top: 0 } : { top: 112, bottom: picked ? 130 : 0 }}
                here={here}
                controls={false}
                core={!narrowed}
              />
            ) : (
              <div className="venue-map" />
            )}
            {/* Nearest first, as a map's own button: where you are, and the list by distance from it */}
            {!snapshot && (
              <button type="button" onClick={locate} aria-pressed={!!here} aria-label={locating ? 'Finding you…' : 'Nearest first'} title={here ? 'Nearest first: on' : 'Nearest first'} className={`finder-locate ${locating ? 'animate-pulse' : ''}`}>
                <Icon of={Gps} className="size-5" />
              </button>
            )}
            <div ref={sheet} className="finder-sheet">
              {!split && !listView && ranked.length > 0 && toggle}
              {/* Wider, the list beside the map is the picked venue's row alone: no card */}
              {picked && !split && <MapCards rows={ranked} selected={picked.venue.id} onSelect={pick} card={rowProps} />}
            </div>
          </div>
        )}
      </div>

      {/* On a phone's list, one button back to the map */}
      {!snapshot && !split && listView && ranked.length > 0 && <div className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-50 -translate-x-1/2">{toggle}</div>}
    </>
  )
}

/** Each tab's name after "The University of Cambridge's": the search's old tabs' names, as a sentence ends. */
const SWITCH_NAME: Record<Scope, string> = { all: 'Food & drink', hall: 'Dining halls', cafe: 'Cafés', bar: 'Bars', formal: 'Formal halls' }

/**
 * The tabs as the heading, with the icons the header search's tabs had: "The University of Cambridge's" on a line of
 * its own, then a tab each, the open one its icon and name in a Cambridge Blue pill ("[Cafés]"), the others their icon
 * alone, named on hover and to a screen reader; each its own address, keeping the filters they share and a phone's
 * list. On a phone, the tabs alone as chips under the search.
 */
function ScopeSwitch() {
  const [params] = useSearchParams()
  const keep = new URLSearchParams([...params].filter(([k]) => SHARED_FILTERS.includes(k) || k === 'view')).toString()
  return (
    <nav aria-label="Kinds of venue" className="scope-switch flex flex-wrap items-center gap-1">
      <span aria-hidden="true" className="scope-switch-lead title mb-2 w-full text-2xl leading-tight @[42rem]:text-[1.75rem]">The University of Cambridge’s</span>
      {SCOPES.map((s) => (
        <NavLink
          key={s.scope}
          to={`${s.path}${keep ? `?${keep}` : ''}`}
          end
          aria-label={SWITCH_NAME[s.scope]}
          title={SWITCH_NAME[s.scope]}
          className={({ isActive }) => `title flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-full text-lg whitespace-nowrap transition-colors ${isActive ? 'bg-accent pr-4.5 pl-3.5 text-accent-ink' : 'text-muted hover:bg-ink/5 hover:text-ink'}`}
        >
          {({ isActive }) => (
            <>
              <Icon of={SCOPE_ICON[s.scope]} className="size-6" />
              {isActive && SWITCH_NAME[s.scope]}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

/**
 * Over a phone's map, the picked venue's card, with the others in the list's order either side of it: swiping to one
 * picks it (the map follows), and picking a pin brings its card round.
 */
function MapCards({ rows, selected, onSelect, card }: { rows: Ranked[]; selected: string; onSelect: (id: string) => void; card: (r: Ranked) => ComponentProps<typeof VenueRow> }) {
  const track = useRef<HTMLUListElement>(null)
  const settle = useRef<number>(undefined)
  useLayoutEffect(() => {
    const t = track.current
    const el = t?.querySelector<HTMLElement>(`[data-venue="${CSS.escape(selected)}"]`)
    if (!t || !el) return
    const left = el.offsetLeft - (t.clientWidth - el.offsetWidth) / 2
    if (Math.abs(t.scrollLeft - left) > 2) t.scrollTo({ left, behavior: 'instant' })
  }, [selected])
  useEffect(() => () => clearTimeout(settle.current), [])
  // Once a swipe settles, the card in the middle is the one picked
  const scrolled = () => {
    clearTimeout(settle.current)
    settle.current = window.setTimeout(() => {
      const t = track.current
      if (!t) return
      const middle = t.scrollLeft + t.clientWidth / 2
      let best: HTMLElement | undefined
      for (const li of t.children as HTMLCollectionOf<HTMLElement>)
        if (!best || Math.abs(li.offsetLeft + li.offsetWidth / 2 - middle) < Math.abs(best.offsetLeft + best.offsetWidth / 2 - middle)) best = li
      if (best?.dataset.venue) onSelect(best.dataset.venue)
    }, 120)
  }
  return (
    <ul ref={track} onScroll={scrolled} className="map-cards card-row pointer-events-auto">
      {rows.map((r) => <VenueRow key={r.venue.id} {...card(r)} card />)}
    </ul>
  )
}

/** What this tab's venues are still missing, as a share, and where to help. */
function CoverageLine({ scope }: { scope: Scope }) {
  const { venues } = useReady()
  const c = tabCoverage(venues, scope)
  if (!c.of || c.have === c.of) return null
  return (
    <div className="mt-6 flex items-center gap-3 text-sm text-muted">
      <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-sm bg-ink/10" role="meter" aria-valuemin={0} aria-valuemax={c.of} aria-valuenow={c.have} aria-label={`${c.what}: ${c.have} of ${c.of} ${c.noun}`}>
        <div className="h-full bg-action" style={{ width: `${Math.round((c.have / c.of) * 100)}%` }} />
      </div>
      <p>
        {c.what}: {c.have} of {c.of} {c.noun}.{' '}
        <Link to="/contribute" className="link text-ink">Help fill the gaps</Link>
      </p>
    </div>
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
