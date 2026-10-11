import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { CloseCircle, List as ListIcon, Map as MapIcon } from 'reicon-react'
import { Chip, ChipSelect } from '../components/Controls.tsx'
import { HeaderSearch } from '../components/Header.tsx'
import { Icon } from '../components/Icon.tsx'
import { VenueRow } from '../components/Listing.tsx'
import { SitePicker } from '../components/SitePicker.tsx'
import { VenueMap } from '../components/VenueMap.tsx'
import { useReady } from '../lib/data.tsx'
import { tabCoverage } from '../lib/coverage.ts'
import { applyFilters, DIET_LABEL, MEAL_LABEL, type Ranked } from '../lib/filters.ts'
import { FILTER_DIETS, FILTER_MEALS, hasLocation, legacyPath, readFilters, resultDishes, scopeInfo, type Scope } from '../lib/finder.ts'
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
  const dates = Array.from({ length: Math.max(0, (Date.parse(menuTo) - Date.parse(menuFrom)) / 86400000) }, (_, i) => addDaysISO(menuFrom, i))
  const count = `${ranked.length} ${ranked.length === 1 ? info.noun[0] : info.noun[1]}`
  // A phone opens on the map; ?view=list shows the list instead
  const listView = params.get('view') === 'list'
  // The map is only made where it's shown (on a prerendered page, its frame holds the place)
  const showMap = !snapshot && (split || !listView)
  const picked = ranked.find((r) => r.venue.id === selected)
  // Beside the map, a picked pin's venue is the list, alone, until it's let go
  const alone = split && !snapshot ? picked : undefined
  // A prerendered page lists every venue, for whoever reads it without the script
  const rows = alone ? [alone] : snapshot ? ranked : ranked.slice(0, shown)
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

      {/* As Airbnb's: the heading and the list down the left, scrolling on their own, and the map beside them, the
          filters over its top; a picked pin's card over the map's foot. On a phone, the map fills the screen with the filters
          over its top and the picked venue's card over its foot (swipe for the next), or the list. */}
      <div ref={results} className={`finder ${listView ? 'is-list' : 'is-map'}`}>
        {/* On a phone, the search is the map's (or the list's), not the header's */}
        <HeaderSearch finder className="finder-search md:hidden" />
        <div className="finder-filters card-row flex items-center gap-2">
          {f.date === now.date && !snapshot && <Chip active={f.openNow} onClick={() => set('open', f.openNow ? undefined : '1')}>Open now</Chip>}
          {!snapshot && <Chip active={!!here} onClick={locate}>{locating ? 'Finding you…' : 'Nearest first'}</Chip>}
          <SitePicker
            sites={sites}
            value={f.sites ?? []}
            kind={f.kind}
            onChange={(slugs, kind) => update((p) => {
              if (slugs.length) p.set('site', slugs.join(','))
              else p.delete('site')
              if (kind) p.set('kind', kind)
              else p.delete('kind')
            })}
          />
          {scope === 'hall' && (
            <>
              <ChipSelect label="Menus for" value={f.date} onChange={(d) => set('date', d === now.date ? undefined : d)} options={dates.map((d) => [d, relativeDay(d, now.date) ?? formatISODate(d)])} />
              <ChipSelect label="Meal" value={f.meal ?? ''} onChange={(m) => set('meal', m)} options={[['', 'Any meal'], ...FILTER_MEALS.map((m): [string, string] => [m, MEAL_LABEL[m]])]} />
              <ChipSelect label="Diet" value={f.diets[0] ?? ''} onChange={(d) => set('diet', d)} options={[['', 'Any diet'], ...FILTER_DIETS.map((t): [string, string] => [t, DIET_LABEL[t]])]} />
            </>
          )}
        </div>
        {note && <p role="status" className="finder-note text-sm text-muted">{note}</p>}
        <div ref={side} className="finder-side">
          {/* What the site is for this tab, at the top of its list (it scrolls away with it); over a phone's map, read
              out but not shown, so the map has the screen */}
          <h1 className={`finder-title title text-3xl leading-[1.1] md:text-[2.5rem] ${listView ? 'max-md:mt-4' : 'max-md:sr-only'}`}>{info.heading}</h1>
          <section aria-label={`${info.label} venues`} className="finder-list">
            <div className="flex items-center justify-between gap-3 py-1 text-[15px]">
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
            {!alone && <CoverageLine scope={scope} />}
            {ranked.length ? (
              <ul className="mt-3 space-y-3">
                {rows.map((r) => <VenueRow key={r.venue.id} {...rowProps(r)} selected={!alone && r.venue.id === selected} onHover={setHover} />)}
              </ul>
            ) : (
              <Empty onClear={clear}>No {info.noun[1]} match.</Empty>
            )}
            {!alone && rows.length < ranked.length && (
              <div className="flex justify-center py-6">
                <button type="button" onClick={() => setShown(shown + PAGE)} className="btn btn-secondary">
                  Show {Math.min(PAGE, ranked.length - rows.length)} more
                </button>
              </div>
            )}
          </section>
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
                inset={split ? { top: 52 } : { top: 58, bottom: picked ? 130 : 0 }}
                here={here}
                controls={false}
                core={!narrowed}
              />
            ) : (
              <div className="venue-map" />
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
    <div className="flex items-center gap-3 text-sm text-muted">
      <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-sm bg-ink/10" role="meter" aria-valuemin={0} aria-valuemax={c.of} aria-valuenow={c.have} aria-label={`${c.what}: ${c.have} of ${c.of} ${c.noun}`}>
        <div className="h-full bg-action" style={{ width: `${Math.round((c.have / c.of) * 100)}%` }} />
      </div>
      <p>
        {c.what}: {c.have} of {c.of} {c.noun}.{' '}
        <Link to="/coverage" className="link text-ink">Help fill the gaps</Link>
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
