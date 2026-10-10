import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { Candle, ChevronLeft, ChevronRight, Home as HomeIcon, Search, type IconComponent } from 'reicon-react'
import { Icon } from '../components/Icon.tsx'
import { Status } from '../components/Status.tsx'
import { PhotoBadge, SiteThumb, TypeMark, VenueImage } from '../components/VenuePhoto.tsx'
import { coverage } from '../lib/coverage.ts'
import { useReady } from '../lib/data.tsx'
import { applyFilters, DEFAULT_FILTERS, MEAL_LABEL, nextService, TYPES, type Ranked } from '../lib/filters.ts'
import { TYPE_ICON } from '../lib/icons.ts'
import { venuePhoto } from '../lib/photos.ts'
import { SITE_NAME, sitePath, venuePath } from '../lib/site.ts'
import type { LocalNow } from '../lib/time/clock.ts'
import { openStatus } from '../lib/time/openNow.ts'
import { venueTypes, type Site, type Venue, type VenueType } from '../lib/types.ts'
import { useNow } from '../lib/useNow.ts'

/** What the front page's search looks in: every venue, one type, or formal hall (Dining's formal meal). */
type Scope = 'all' | VenueType | 'formal'
const SCOPES: { scope: Scope; label: string; icon: IconComponent; placeholder: string }[] = [
  { scope: 'all', label: 'All', icon: HomeIcon, placeholder: 'Colleges, cafés, bars, dishes…' },
  { scope: 'hall', label: 'Dining', icon: TYPE_ICON.hall, placeholder: 'A college, or a dish on the menu…' },
  { scope: 'cafe', label: 'Cafés', icon: TYPE_ICON.cafe, placeholder: 'A café or a college…' },
  { scope: 'bar', label: 'Bars', icon: TYPE_ICON.bar, placeholder: 'A bar or a college…' },
  { scope: 'formal', label: 'Formal hall', icon: Candle, placeholder: 'A college…' },
]

/** Explore's filters: a link made when Explore was the front page still lands on the map. */
const EXPLORE_KEYS = ['q', 'type', 'meal', 'diet', 'site', 'date', 'open', 'view', 'venue', 'place']

// The banners' photos, the first of each list that has one: a hall laid for a meal, and a café
const MENUS_PHOTO = ['gonville-and-caius/hall', 'magdalene/hall', 'christs/hall']
const SEND_PHOTO = ['kettles-yard/garden-kitchen', 'darwin/cafe', 'botanic-garden/garden-cafe']

/** A row's cards: most of a phone's width, so the next one shows; three across, then four. */
const CARD = 'w-[72%] shrink-0 snap-start sm:w-[calc((100%-2.5rem)/3)] lg:w-[calc((100%-3.75rem)/4)]'
const CARD_SIZES = '(min-width: 1024px) 19rem, (min-width: 640px) 33vw, 72vw'

function explorePath(scope: Scope, more: Record<string, string> = {}): string {
  const p = new URLSearchParams()
  if (scope === 'formal') {
    p.set('type', 'hall')
    p.set('meal', 'formal')
  } else if (scope !== 'all') p.set('type', scope)
  for (const [k, v] of Object.entries(more)) p.set(k, v)
  return `/explore${p.size ? `?${p}` : ''}`
}

/**
 * The front page, laid out as Tripadvisor's: what the site is, the kinds of venue as tabs, and one wide search box; then
 * what's on (a banner for the menus, what's open now, today's menus), a call to send in what's missing, and the
 * colleges and University sites. A search opens Explore, the map and the list.
 */
export function Home() {
  const [params] = useSearchParams()
  if (EXPLORE_KEYS.some((k) => params.has(k))) return <Navigate to={`/explore?${params}`} replace />
  return <Front />
}

function Front() {
  const { venues, snapshot } = useReady()
  const now = useNow()
  // Today's menus only: the front page never previews tomorrow's
  const ranked = applyFilters(venues, { ...DEFAULT_FILTERS, date: now.date, exactDate: true }, now)
  const pick = (ids: string[], type: VenueType) => ids.map((id) => venues.find((v) => v.id === id)).find((v) => v && venuePhoto(v)) ?? venues.find((v) => v.type === type && venuePhoto(v))
  return (
    <>
      <title>{`${SITE_NAME}: Cambridge college and University menus`}</title>
      <Hero />
      <MenusBanner venue={pick(MENUS_PHOTO, 'hall')} />
      {/* What's open and today's menus depend on the clock, so a prerendered page leaves them out */}
      {!snapshot && <OpenNow ranked={ranked} now={now} />}
      {!snapshot && <MenusToday ranked={ranked} now={now} />}
      <SendBanner venue={pick(SEND_PHOTO, 'cafe')} />
      <SiteRow kind="college" title="Colleges" more={['/directory?kind=college', 'All colleges']} now={now} />
      <SiteRow kind="university" title="University sites" more={['/directory?kind=university', 'All University sites']} now={now} />
    </>
  )
}

/** What the site is in five words, the tabs that set what to look in, and the search box (the header's search shows once it's scrolled away). */
function Hero() {
  const navigate = useNavigate()
  const [scope, setScope] = useState<Scope>('all')
  const [q, setQ] = useState('')
  const current = SCOPES.find((s) => s.scope === scope)!
  // Words find dishes as well as venues, which the list shows; without any, the map
  const submit = (e: FormEvent) => {
    e.preventDefault()
    navigate(explorePath(scope, q.trim() ? { q: q.trim(), view: 'list' } : {}))
  }
  return (
    <section className="text-center">
      <h1 className="title text-[2.5rem] leading-[1.1] sm:text-6xl">Cambridge University food and drink</h1>
      <div role="group" aria-label="Search in" className="card-row -mx-4 mt-8 flex gap-7 overflow-x-auto px-4 sm:mx-0 sm:justify-center sm:gap-9 sm:px-0">
        {SCOPES.map((s) => (
          <button
            key={s.scope}
            type="button"
            aria-pressed={s.scope === scope}
            onClick={() => setScope(s.scope)}
            className={`flex shrink-0 cursor-pointer items-center gap-2 border-b-2 pb-2 text-base font-medium whitespace-nowrap text-ink transition-colors sm:text-lg ${s.scope === scope ? 'border-ink' : 'border-transparent hover:border-ink/25'}`}
          >
            <Icon of={s.icon} className="size-5" />
            {s.label}
          </button>
        ))}
      </div>
      <form id="hero-search" role="search" onSubmit={submit} className="hero-search mx-auto mt-6 flex max-w-[50rem] items-center gap-2 rounded-full border border-ink/25 bg-canvas p-1.5 pl-5 text-left shadow-[0_4px_18px_rgb(19_56_68/0.08)]">
        <Icon of={Search} className="size-5 text-ink" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={current.placeholder}
          aria-label={scope === 'all' ? 'Search venues, colleges and dishes' : `Search ${current.label.toLowerCase()}`}
          className="h-11 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted"
        />
        <Link to={explorePath(scope, { open: '1' })} className="hidden h-11 shrink-0 items-center rounded-full border border-ink px-5 text-sm font-medium transition-colors hover:bg-ink/5 sm:flex">
          Open now
        </Link>
        <button type="submit" className="h-11 shrink-0 cursor-pointer rounded-full bg-accent px-6 text-sm font-semibold text-accent-ink transition-[filter] hover:brightness-95">
          Search
        </button>
      </form>
    </section>
  )
}

/** Cambridge Blue, as Tripadvisor's green: a hall laid for a meal, and what grub.cam is for. */
function MenusBanner({ venue }: { venue?: Venue }) {
  const data = useReady()
  const menus = coverage(data)[0]
  const photo = venue && venuePhoto(venue)
  return (
    <section aria-labelledby="menus-banner" className="mt-14 grid gap-6 rounded-xl bg-accent p-4 text-accent-ink sm:mt-16 sm:p-6 lg:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] lg:gap-10">
      {venue && photo && (
        <VenueImage venue={venue} sizes="(min-width: 1024px) 38rem, 100vw" eager className="block aspect-4/3 w-full rounded-lg lg:aspect-auto lg:h-full lg:min-h-[26rem]" overlay={<PhotoBadge photo={photo} />} />
      )}
      <span aria-hidden="true" className="hidden bg-accent-ink/70 lg:block" />
      <div className="flex flex-col items-center justify-center px-2 pt-2 pb-6 text-center lg:py-10">
        <h2 id="menus-banner" className="title text-4xl leading-[1.05] text-accent-ink sm:text-5xl xl:text-6xl">Today’s menus, dish by dish</h2>
        <p className="mt-4 max-w-md text-lg">
          From {menus.have} of {menus.of} colleges this week, checked again three times a day.
        </p>
        <Link to="/explore?type=hall" className="mt-7 inline-flex h-12 items-center rounded-full bg-accent-ink px-6 font-medium text-white transition-opacity hover:opacity-90">
          See what’s on
        </Link>
      </div>
    </section>
  )
}

/** Dark Blue, white on it: what's missing, and how to send it in. */
function SendBanner({ venue }: { venue?: Venue }) {
  const photo = venue && venuePhoto(venue)
  return (
    <section aria-labelledby="send-banner" className="mt-16 grid overflow-hidden rounded-xl bg-accent-ink text-white ring-1 ring-white/10 lg:grid-cols-2">
      <div className="flex flex-col items-start justify-center p-6 sm:p-10">
        <h2 id="send-banner" className="title text-3xl leading-tight text-white sm:text-4xl">Seen a menu that isn’t here?</h2>
        <p className="mt-3 max-w-md text-lg text-white/85">Send a photo of the board, the price list or the opening times, with your Cambridge account. It’s read, checked, and added for everyone.</p>
        <Link to="/send" className="mt-7 inline-flex h-12 items-center rounded-full bg-accent px-6 font-medium text-accent-ink transition-[filter] hover:brightness-95">
          Send a photo
        </Link>
      </div>
      {venue && photo && <VenueImage venue={venue} sizes="(min-width: 1024px) 40rem, 100vw" className="block aspect-video w-full lg:aspect-auto lg:h-full lg:min-h-80" overlay={<PhotoBadge photo={photo} />} />}
    </section>
  )
}

/** Venues open now, those with photos first; if nothing is, what opens later today. */
function OpenNow({ ranked, now }: { ranked: Ranked[]; now: LocalNow }) {
  const open = ranked.filter((r) => r.status.kind === 'open')
  const shown = open.length ? open : ranked.filter((r) => r.status.kind === 'opening')
  if (!shown.length) return null
  const withPhotos = [...shown].sort((a, b) => Number(!venuePhoto(a.venue)) - Number(!venuePhoto(b.venue)))
  return (
    <Row title={open.length ? 'Open now' : 'Opening later today'} more={open.length ? ['/explore?open=1', `All ${open.length} on the map`] : ['/explore', 'The map']}>
      {withPhotos.slice(0, 12).map((r) => <VenueTile key={r.venue.id} r={r} now={now} />)}
    </Row>
  )
}

/** Dining venues with a menu today, open ones first, each with the dishes of its next meal. */
function MenusToday({ ranked, now }: { ranked: Ranked[]; now: LocalNow }) {
  const withMenu = ranked.filter((r) => r.days.some((d) => d.items.length))
  if (!withMenu.length) return null
  return (
    <Row title="On the menu today" more={['/explore?type=hall', 'All menus']}>
      {withMenu.slice(0, 12).map((r) => {
        const d = nextService(r)
        return <VenueTile key={r.venue.id} r={r} now={now} dishes={d && `${MEAL_LABEL[d.service]}: ${d.items.map((i) => i.name).join(' · ')}`} />
      })}
    </Row>
  )
}

/** Every college, or every University site, A–Z: its photo, its venues' types and how many are open. */
function SiteRow({ kind, title, more, now }: { kind: Site['kind']; title: string; more: [string, string]; now: LocalNow }) {
  const { sites, venues, snapshot } = useReady()
  const name = (s: Site) => s.short_name ?? s.name
  const list = sites.filter((s) => s.kind === kind).sort((a, b) => name(a).localeCompare(name(b)))
  return (
    <Row title={title} more={more}>
      {list.map((s) => {
        const mine = venues.filter((v) => v.site.slug === s.slug)
        const open = snapshot ? 0 : mine.filter((v) => openStatus(v.slots, now).kind === 'open').length
        return (
          <li key={s.slug} className={CARD}>
            <Link to={sitePath(s)} className="group block">
              <SiteThumb site={s} sizes={CARD_SIZES} className="aspect-4/3 h-auto w-full rounded-lg" />
              <h3 className="title mt-3 truncate text-lg leading-snug group-hover:underline">{name(s)}</h3>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                <span className="flex gap-1">
                  {TYPES.filter((t) => mine.some((v) => venueTypes(v).includes(t))).map((t) => <TypeMark key={t} type={t} />)}
                </span>
                {mine.length} {mine.length === 1 ? 'venue' : 'venues'}
                {open > 0 && <span className="rounded bg-open px-1.5 py-0.5 font-medium text-open-ink">{open} open now</span>}
              </p>
            </Link>
          </li>
        )
      })}
    </Row>
  )
}

/** A venue as a card: its photo (or its type's tile) with its type's mark, its site, its name, whether it's open. */
function VenueTile({ r, now, dishes }: { r: Ranked; now: LocalNow; dishes?: string }) {
  const v = r.venue
  return (
    <li className={CARD}>
      <Link to={venuePath(v)} className="group block">
        <VenueImage venue={v} sizes={CARD_SIZES} decorative icon="size-12" className="block aspect-4/3 w-full rounded-lg" overlay={<TypeMark type={v.type} className="absolute top-3 left-3 size-7 ring-2 ring-white" />} />
        <p className="mt-3 truncate text-sm text-muted">{v.site.short_name ?? v.site.name}</p>
        <h3 className="title truncate text-lg leading-snug group-hover:underline">{v.name}</h3>
        <p className="mt-1 text-sm">
          <Status s={r.status} now={now} />
        </p>
        {dishes && <p className="mt-1.5 line-clamp-2 text-sm text-muted">{dishes}</p>}
      </Link>
    </li>
  )
}

/** A titled row of cards that scrolls sideways: swiped on a phone, with buttons above it on wider screens. */
function Row({ title, more, children }: { title: string; more: [to: string, label: string]; children: ReactNode }) {
  const list = useRef<HTMLUListElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)
  useEffect(() => {
    const l = list.current
    if (!l) return
    const measure = () => {
      setAtStart(l.scrollLeft < 4)
      setAtEnd(l.scrollLeft + l.clientWidth > l.scrollWidth - 4)
    }
    // Observing fires once straight away, which takes the first measure
    const observer = new ResizeObserver(measure)
    observer.observe(l)
    l.addEventListener('scroll', measure, { passive: true })
    return () => {
      observer.disconnect()
      l.removeEventListener('scroll', measure)
    }
  }, [])
  const scroll = (dir: 1 | -1) => list.current?.scrollBy({ left: dir * list.current.clientWidth, behavior: 'smooth' })
  return (
    <section className="mt-14 sm:mt-16">
      <div className="flex items-end justify-between gap-4">
        <h2 className="title text-2xl sm:text-3xl">{title}</h2>
        <div className="flex shrink-0 items-center gap-2">
          <Link to={more[0]} className="link text-sm">{more[1]}</Link>
          <button type="button" aria-label={`Back: ${title}`} disabled={atStart} onClick={() => scroll(-1)} className="icon-btn ml-2 hidden border border-ink/15 sm:flex">
            <Icon of={ChevronLeft} />
          </button>
          <button type="button" aria-label={`More: ${title}`} disabled={atEnd} onClick={() => scroll(1)} className="icon-btn hidden border border-ink/15 sm:flex">
            <Icon of={ChevronRight} />
          </button>
        </div>
      </div>
      {/* Relative, so it clips what's positioned inside it too (a type mark's screen-reader label) */}
      <ul ref={list} className="card-row relative -mx-4 mt-5 flex snap-x snap-mandatory scroll-px-4 gap-5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:scroll-px-0 sm:px-0">
        {children}
      </ul>
    </section>
  )
}
