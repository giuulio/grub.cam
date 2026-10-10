import { useSyncExternalStore, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { ChevronRight, Home } from 'reicon-react'
import { useReady } from '../lib/data.tsx'
import { MEAL_LABEL, MEALS, nextService, slotOrder, TYPE_LABEL, TYPES, type Ranked } from '../lib/filters.ts'
import { formatPrice, fromList } from '../lib/prices.ts'
import { siteName, sitePath, venuePath } from '../lib/site.ts'
import { statusWords } from '../lib/status.ts'
import { hhmmToMinutes, type LocalNow } from '../lib/time/clock.ts'
import { openStatus, slotApplies } from '../lib/time/openNow.ts'
import { venueTypes, type Site, type Slot, type Venue } from '../lib/types.ts'
import { Icon } from './Icon.tsx'
import { Status } from './Status.tsx'
import { VenueMap } from './VenueMap.tsx'
import { SiteThumb, TypeMark, VenueImage } from './VenuePhoto.tsx'

// Lists laid out as TheFork's: where you are, the page's name and how many there are, then a card per site or venue
// (its photo down the left, what to know beside it) with a map of the same venues beside the list on a wide screen.

/** Home › Directory › Christ's College: the last is the page itself. */
export function Breadcrumbs({ trail }: { trail: [to: string, label: string][] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5 text-sm">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <li>
          <Link to="/" aria-label="Home" title="Home" className="flex text-ink hover:text-muted">
            <Icon of={Home} className="size-4.5" />
          </Link>
        </li>
        {trail.map(([to, label], i) => (
          <li key={to} className="flex items-center gap-2">
            <Icon of={ChevronRight} className="size-3.5 text-muted" />
            {i === trail.length - 1 ? <span aria-current="page">{label}</span> : <Link to={to} className="hover:underline">{label}</Link>}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/** The page's name with how many it lists beside it, as TheFork's "Restaurants in London 2,146 restaurants". */
export function ListHeading({ title, count, children }: { title: string; count: string; children?: ReactNode }) {
  return (
    <header>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="title text-3xl leading-tight sm:text-4xl">{title}</h1>
        <span className="text-muted">{count}</span>
      </div>
      {children && <div className="mt-3 max-w-3xl text-muted">{children}</div>}
    </header>
  )
}

const WIDE = '(min-width: 1024px)'
const subscribe = (change: () => void) => {
  const media = window.matchMedia(WIDE)
  media.addEventListener('change', change)
  return () => media.removeEventListener('change', change)
}

/**
 * The list, with the map of its venues beside it (sticky, as TheFork's) on a wide screen; narrower, the list alone.
 * A pin opens its venue; `highlight` picks out the pins of the card under the pointer.
 */
export function ListWithMap({ list, results, highlight, children }: { list: ReactNode; results: Ranked[]; highlight?: string[]; children?: ReactNode }) {
  const { snapshot } = useReady()
  const navigate = useNavigate()
  // The map is only made where it's shown: a phone never loads it
  const wide = useSyncExternalStore(subscribe, () => window.matchMedia(WIDE).matches, () => false)
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        {children}
        <ul className="space-y-5">{list}</ul>
      </div>
      {wide && !snapshot && (
        <div className="listing-map sticky top-4 isolate self-start overflow-hidden rounded-xl border border-ink/10 bg-ink/5">
          <VenueMap
            results={results}
            highlight={highlight}
            filtered
            onSelect={(id) => {
              const v = results.find((r) => r.venue.id === id)?.venue
              if (v) navigate(venuePath(v))
            }}
          />
        </div>
      )}
    </div>
  )
}

/** A card's frame: the photo down its left side (across its top on a phone) with its badges, the rest beside it. Its name's link covers the card. */
function Card({ photo, badges, onHover, children }: { photo: ReactNode; badges: ReactNode; onHover?: (on: boolean) => void; children: ReactNode }) {
  return (
    <li
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      onFocus={() => onHover?.(true)}
      onBlur={() => onHover?.(false)}
      className="listing-card relative flex flex-col overflow-hidden rounded-xl border border-ink/12 bg-canvas transition-colors hover:border-ink/30 sm:min-h-56 sm:flex-row"
    >
      <div className="relative aspect-[2/1] shrink-0 sm:aspect-auto sm:w-60 lg:w-64">
        {photo}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">{badges}</div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">{children}</div>
    </li>
  )
}

/** A label on a card's photo, as TheFork's "Top Host". */
function Badge({ children }: { children: ReactNode }) {
  return <span className="flex items-center gap-1.5 rounded-full bg-canvas/95 px-2.5 py-1 text-xs font-medium text-ink shadow-sm">{children}</span>
}

/** The card's name: its link covers the whole card, so the card is one target (its own links sit above it). */
function CardTitle({ to, children }: { to: string; children: ReactNode }) {
  return (
    <h2 className="title text-xl leading-snug">
      <Link to={to} className="card-link after:absolute after:inset-0 hover:underline focus-visible:outline-none">
        {children}
      </Link>
    </h2>
  )
}

const endMinutes = (s: Slot) => hhmmToMinutes(s.end) + (hhmmToMinutes(s.end) <= hhmmToMinutes(s.start) ? 24 * 60 : 0)
const sentence = (words: string[]) => (words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`)

/**
 * A venue as a card, for the way it's used: a Dining venue leads with its meals today (as TheFork's time slots, "menu"
 * under those with a menu posted) and the next meal's dishes; a café or bar with what its price list says.
 */
export function VenueListing({ r, now, onHover }: { r: Ranked; now: LocalNow; onHover?: (id?: string) => void }) {
  const { snapshot } = useReady()
  const v = r.venue
  // Its meals in the day's order (a café's and a bar's hours are its types)
  const meals = MEALS.filter((m) => m !== 'snacks' && m !== 'bar' && v.slots.some((s) => s.meal === m)).map((m) => (m === 'formal' ? 'formal hall' : MEAL_LABEL[m].toLowerCase()))
  const kinds = venueTypes(v).map((t) => TYPE_LABEL[t])
  const next = nextService(r)
  const prices = (v.prices ?? []).filter((p) => p.price_gbp != null).slice(0, 3)
  // What's left of today: the meals still to come or being served
  const today = v.slots.filter((s) => slotApplies(s, now.date) && endMinutes(s) > now.minutes).sort(slotOrder)
  const menus = new Set(v.menu.filter((d) => d.date === now.date && d.items.length).map((d) => d.service))
  return (
    <Card
      onHover={(on) => onHover?.(on ? v.id : undefined)}
      photo={<VenueImage venue={v} sizes="(min-width: 640px) 16rem, 100vw" decorative icon="size-14" className="absolute inset-0 size-full" />}
      badges={
        <>
          <Badge>
            <TypeMark type={v.type} className="size-4" label />
            {TYPE_LABEL[v.type]}
          </Badge>
          {v.formal && v.slots.some((s) => s.meal !== 'formal') && <Badge>Formal hall</Badge>}
        </>
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <CardTitle to={venuePath(v)}>{v.name}</CardTitle>
          <p className="mt-1 text-muted">{[kinds.join(' and '), meals.length ? sentence(meals).replace(/^./, (c) => c.toUpperCase()) : ''].filter(Boolean).join(' · ')}</p>
        </div>
        <p className="shrink-0 pt-1 text-right text-sm">
          <Status s={r.status} now={now} />
        </p>
      </div>
      {next ? (
        <p className="mt-3 line-clamp-2">
          <span className="font-medium">{MEAL_LABEL[next.service]}:</span> {next.items.map((i) => i.name).join(' · ')}
        </p>
      ) : (
        prices.length > 0 && <p className="mt-3 line-clamp-2">{prices.map((p) => `${p.name} ${formatPrice(fromList(p))}`).join(' · ')}</p>
      )}
      {!snapshot && today.length > 0 && (
        <ul aria-label="Today" className="mt-auto flex flex-wrap gap-x-2 gap-y-3 pt-4">
          {today.map((s) => (
            <li key={`${s.meal}${s.start}`} className="flex flex-col items-center gap-1">
              <span className="rounded-md bg-accent-ink px-3 py-2 text-sm font-semibold text-white tabular-nums">
                {s.start}–{s.end}
              </span>
              <span className={`rounded px-1.5 text-xs ${menus.has(s.meal) ? 'bg-open font-medium text-open-ink' : 'text-muted'}`}>
                {MEAL_LABEL[s.meal]}
                {menus.has(s.meal) && ' menu'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/** A college or University site as a card: its photo, its kinds of venue, how many are open, and its venues as buttons with whether each is open. */
export function SiteListing({ site, venues, now, onHover }: { site: Site; venues: Venue[]; now: LocalNow; onHover?: (ids?: string[]) => void }) {
  const { snapshot } = useReady()
  const statuses = venues.map((v) => ({ v, s: openStatus(v.slots, now) }))
  const open = snapshot ? 0 : statuses.filter((x) => x.s.kind === 'open').length
  const menuToday = !snapshot && venues.some((v) => v.menu.some((d) => d.date === now.date && d.items.length))
  const shown = statuses.slice(0, 4)
  return (
    <Card
      onHover={(on) => onHover?.(on ? venues.map((v) => v.id) : undefined)}
      photo={<SiteThumb site={site} sizes="(min-width: 640px) 16rem, 100vw" className="absolute inset-0 size-full" />}
      badges={<Badge>{site.kind === 'college' ? 'College' : 'University'}</Badge>}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <CardTitle to={sitePath(site)}>{siteName(site)}</CardTitle>
          <p className="mt-1 text-muted">
            {venues.length} {venues.length === 1 ? 'venue' : 'venues'}
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            {TYPES.filter((t) => venues.some((v) => venueTypes(v).includes(t))).map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <TypeMark type={t} className="size-4.5" label />
                {TYPE_LABEL[t]}
              </span>
            ))}
          </p>
        </div>
        {open > 0 && <span className="shrink-0 rounded bg-open px-2 py-1 text-sm font-medium text-open-ink">{open} open now</span>}
      </div>
      {menuToday && (
        <p className="mt-3">
          <span className="rounded-full bg-ink/6 px-2.5 py-1 text-xs font-medium">Menu today</span>
        </p>
      )}
      <ul aria-label="Venues" className="relative z-10 mt-auto flex flex-wrap gap-x-2 gap-y-3 pt-4">
        {shown.map(({ v, s }) => {
          const w = statusWords(s, now.date)
          return (
            <li key={v.id} className="flex max-w-full flex-col items-center gap-1">
              <Link to={venuePath(v)} className="max-w-full truncate rounded-md bg-accent-ink px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90">
                {v.name}
              </Link>
              {!snapshot && <span className={`rounded px-1.5 text-xs ${w.kind === 'open' ? 'bg-open font-medium text-open-ink' : 'text-muted'}`}>{w.text}</span>}
            </li>
          )
        })}
        {venues.length > shown.length && (
          <li className="self-start py-2 text-sm text-muted">+{venues.length - shown.length} more</li>
        )}
      </ul>
    </Card>
  )
}
