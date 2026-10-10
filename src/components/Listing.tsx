import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { ChevronRight, Home } from 'reicon-react'
import { useReady } from '../lib/data.tsx'
import { MEAL_LABEL, MEALS, nextService, slotOrder, TYPE_LABEL, type Ranked } from '../lib/filters.ts'
import { formalBooking, formalDress, formalPrice, formalWhen } from '../lib/formal.ts'
import { formatPrice, fromList } from '../lib/prices.ts'
import { siteName, sitePath, venuePath } from '../lib/site.ts'
import { hhmmToMinutes, type LocalNow } from '../lib/time/clock.ts'
import { slotApplies } from '../lib/time/openNow.ts'
import { venueTypes, type Slot } from '../lib/types.ts'
import { useMedia } from '../lib/useMedia.ts'
import { Icon } from './Icon.tsx'
import { Status } from './Status.tsx'
import { VenueMap } from './VenueMap.tsx'
import { TypeMark, VenueImage } from './VenuePhoto.tsx'

// Lists laid out as TheFork's: where you are, the page's name and how many there are, then a card per venue (its photo
// down the left, what to know beside it) with a map of the same venues beside the list on a wide screen.

/** Home › Jesus College: the last is the page itself. */
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

/**
 * The list, with the map of its venues beside it (sticky under the header, as TheFork's) on a wide screen; narrower,
 * the list alone, or the map alone when `phoneMap`. A pin opens its venue; `highlight` picks out the pins of the card
 * under the pointer. `empty` stands in for the list when nothing matches.
 */
export function ListWithMap({ list, results, highlight, phoneMap = false, empty, children }: { list: ReactNode; results: Ranked[]; highlight?: string[]; phoneMap?: boolean; empty?: ReactNode; children?: ReactNode }) {
  const { snapshot } = useReady()
  const navigate = useNavigate()
  // The map is only made where it's shown: a phone loads it only when asked for
  const wide = useMedia('(min-width: 1024px)')
  const map = (
    <VenueMap
      results={results}
      highlight={highlight}
      filtered
      onSelect={(id) => {
        const v = results.find((r) => r.venue.id === id)?.venue
        if (v) navigate(venuePath(v))
      }}
    />
  )
  if (!wide && phoneMap && !snapshot) return <div className="listing-map relative isolate -mx-4 overflow-hidden sm:mx-0 sm:rounded-xl">{map}</div>
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        {children}
        {empty ?? <ul className="space-y-5">{list}</ul>}
      </div>
      {wide && !snapshot && <div className="listing-map sticky isolate self-start overflow-hidden rounded-xl border border-ink/10 bg-ink/5">{map}</div>}
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
 * What a venue's card or row says under the tab it's in: what it is and its meals; under Formal hall, when, the price,
 * dress and booking (`facts`); otherwise one `line`: what a search matched, else the next meal's dishes today, else the
 * first lines of its price list; and today's meals still to come (`today`), with those whose menu is posted (`menus`).
 */
function venueFacts(r: Ranked, now: LocalNow, formal: boolean, dishes?: string[]) {
  const v = r.venue
  // Its meals in the day's order (a café's and a bar's hours are its types)
  const meals = MEALS.filter((m) => m !== 'snacks' && m !== 'bar' && v.slots.some((s) => s.meal === m)).map((m) => (m === 'formal' ? 'formal hall' : MEAL_LABEL[m].toLowerCase()))
  const summary = [venueTypes(v).map((t) => TYPE_LABEL[t]).join(' and '), !formal && meals.length ? sentence(meals).replace(/^./, (c) => c.toUpperCase()) : ''].filter(Boolean).join(' · ')
  const next = nextService(r)
  const prices = (v.prices ?? []).filter((p) => p.price_gbp != null).slice(0, 3)
  const booking = v.formal && formalBooking(v.formal)
  const facts = formal ? [formalWhen(v, v.formal).join('; '), v.formal && formalPrice(v.formal), v.formal && formalDress(v.formal), booking && `Booking: ${booking}`].filter((t): t is string => !!t) : []
  const line: ReactNode = formal ? undefined : dishes?.length ? dishes.join(' · ') : next ? (
    <>
      <span className="font-medium">{MEAL_LABEL[next.service]}:</span> {next.items.map((i) => i.name).join(' · ')}
    </>
  ) : prices.length ? prices.map((p) => `${p.name} ${formatPrice(fromList(p))}`).join(' · ') : undefined
  // What's left of today: the meals still to come or being served (under Formal hall, only formal hall)
  const today = v.slots.filter((s) => slotApplies(s, now.date) && endMinutes(s) > now.minutes && (!formal || s.meal === 'formal')).sort(slotOrder)
  const menus = new Set(v.menu.filter((d) => d.date === now.date && d.items.length).map((d) => d.service))
  return { summary, facts, line, today, menus }
}

/**
 * A venue as a row of the list down the map's side, as Google Maps lists places: its college (linked to its page),
 * its name (its link covers the row), what it is, whether it's open and how far (nearest first), then the dishes,
 * prices or formal hall, and today's times; its photo to the left. `selected` when its pin was picked.
 */
export function VenueRow({ r, now, selected = false, onHover, dishes, distance, formal = false }: { r: Ranked; now: LocalNow; selected?: boolean; onHover?: (id?: string) => void; dishes?: string[]; distance?: string; formal?: boolean }) {
  const { snapshot } = useReady()
  const v = r.venue
  const { summary, facts, line, today } = venueFacts(r, now, formal, dishes)
  return (
    <li
      id={`venue-${v.id}`}
      onMouseEnter={() => onHover?.(v.id)}
      onMouseLeave={() => onHover?.(undefined)}
      onFocus={() => onHover?.(v.id)}
      onBlur={() => onHover?.(undefined)}
      className={`venue-row relative border-b border-ink/10 px-4 py-4 transition-colors ${selected ? 'bg-accent/20' : 'hover:bg-ink/4'}`}
    >
      <div className="flex gap-3.5">
        <VenueImage venue={v} sizes="5.5rem" decorative icon="size-8" className="size-22 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <Link to={sitePath(v.site)} className="relative z-10 text-sm text-muted hover:text-ink hover:underline">
            {siteName(v.site)}
          </Link>
          <h3 className="title text-lg leading-snug">
            <Link to={venuePath(v)} className="card-link after:absolute after:inset-0 hover:underline focus-visible:outline-none">
              {v.name}
            </Link>
          </h3>
          <p className="text-sm text-muted">{summary}</p>
          <p className="mt-1 text-sm">
            <Status s={r.status} now={now} />
            {distance && <span className="text-muted"> · {distance}</span>}
          </p>
          {facts.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-sm">
              {facts.map((t) => <li key={t}>{t}</li>)}
            </ul>
          )}
          {line && <p className="mt-2 line-clamp-2 text-sm">{line}</p>}
          {!snapshot && today.length > 0 && (
            <ul aria-label="Today" className="mt-2.5 flex flex-wrap gap-1.5">
              {today.map((s) => (
                <li key={`${s.meal}${s.start}`} className="rounded-md bg-accent-ink px-2 py-1 text-xs font-medium text-white tabular-nums">
                  {s.meal === 'formal' ? `Formal hall ${s.start}` : `${MEAL_LABEL[s.meal]} ${s.start}–${s.end}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  )
}

/**
 * A venue as a card, for the way it's used: a Dining venue leads with its meals today (as TheFork's time slots, "menu"
 * under those with a menu posted) and the next meal's dishes; a café or bar with what its price list says; under the
 * Formal hall tab (`formal`), when it is, its price, dress and how to book. `showSite` names its college first, linked
 * to its page (many venues share a name); `dishes`, what a search matched; `distance`, how far it is, nearest first.
 */
export function VenueListing({ r, now, onHover, showSite = false, dishes, distance, formal = false }: { r: Ranked; now: LocalNow; onHover?: (id?: string) => void; showSite?: boolean; dishes?: string[]; distance?: string; formal?: boolean }) {
  const { snapshot } = useReady()
  const v = r.venue
  const { summary, facts, line, today, menus } = venueFacts(r, now, formal, dishes)
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
          {!formal && v.formal && v.slots.some((s) => s.meal !== 'formal') && <Badge>Formal hall</Badge>}
        </>
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {showSite && (
            <Link to={sitePath(v.site)} className="relative z-10 text-sm text-muted hover:text-ink hover:underline">
              {siteName(v.site)}
            </Link>
          )}
          <CardTitle to={venuePath(v)}>{v.name}</CardTitle>
          <p className="mt-1 text-muted">{summary}</p>
        </div>
        <p className="shrink-0 pt-1 text-right text-sm">
          <Status s={r.status} now={now} />
          {distance && <span className="mt-1 block text-muted">{distance}</span>}
        </p>
      </div>
      {facts.length > 0 && (
        <ul className="mt-3 space-y-0.5">
          {facts.map((t) => <li key={t}>{t}</li>)}
        </ul>
      )}
      {line && <p className="mt-3 line-clamp-2">{line}</p>}
      {!snapshot && today.length > 0 && (
        <ul aria-label="Today" className="mt-auto flex flex-wrap gap-x-2 gap-y-3 pt-4">
          {today.map((s) => (
            <li key={`${s.meal}${s.start}`} className="flex flex-col items-center gap-1">
              <span className="rounded-md bg-accent-ink px-3 py-2 text-sm font-semibold text-white tabular-nums">{s.meal === 'formal' ? s.start : `${s.start}–${s.end}`}</span>
              <span className={`rounded px-1.5 text-xs ${menus.has(s.meal) ? 'bg-open font-medium text-open-ink' : 'text-muted'}`}>
                {s.meal === 'formal' ? 'Formal hall' : MEAL_LABEL[s.meal]}
                {menus.has(s.meal) && ' menu'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
