import { Fragment, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { ChevronRight, Home } from 'reicon-react'
import { useReady } from '../lib/data.tsx'
import { mainDishes, MEAL_LABEL, MEALS, nextService, slotOrder, type Ranked } from '../lib/filters.ts'
import { formalBooking, formalDress, formalPrice, formalWhen } from '../lib/formal.ts'
import { formatPrice, fromList, headlinePrices, priceGroups } from '../lib/prices.ts'
import { sendPath, siteName, sitePath, venuePath } from '../lib/site.ts'
import { addDaysISO, dayLabel, dayOfISO, hhmmToMinutes, type LocalNow } from '../lib/time/clock.ts'
import { slotApplies } from '../lib/time/openNow.ts'
import { isFormalOnly, venueTypes, type MenuDay, type Slot, type Venue, type VenuePrice, type VenueType } from '../lib/types.ts'
import { useMedia } from '../lib/useMedia.ts'
import { Icon } from './Icon.tsx'
import { Status } from './Status.tsx'
import { VenueMap } from './VenueMap.tsx'
import { TypeLabel, VenueImage, VenueThumb } from './VenuePhoto.tsx'

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
 * A site's list, with the map of its venues beside it on a wide screen (sticky under the header, as TheFork's, but a
 * landscape card rather than the height of the screen: a site has a few venues, and its map is zoomed to them); on a
 * narrower one, the list alone. A pin opens its venue; `highlight` picks out the pins of the card under the pointer.
 */
export function ListWithMap({ list, results, highlight }: { list: ReactNode; results: Ranked[]; highlight?: string[] }) {
  const { snapshot } = useReady()
  const navigate = useNavigate()
  // The map is only made where it's shown
  const wide = useMedia('(min-width: 1024px)')
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <ul className="min-w-0 space-y-5">{list}</ul>
      {wide && !snapshot && (
        <div className="listing-map sticky isolate self-start overflow-hidden rounded-xl border border-ink/10 bg-ink/5">
          <VenueMap
            results={results}
            highlight={highlight}
            filtered
            maxZoom={17}
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
 * What a venue's card or row says under the tab it's in: what it is (`types`) and its `meals`; under Formal hall,
 * when, the price, dress and booking (`facts`); otherwise a `preview`: what a search matched, else the next meal's
 * main dishes, else the prices of what people usually order there; and today's meals still to come (`today`), with
 * those whose menu is posted (`menus`).
 */
function venueFacts(r: Ranked, now: LocalNow, formal: boolean, dishes?: string[]) {
  const v = r.venue
  const types = venueTypes(v)
  // Its meals in the day's order (a café's and a bar's hours are its types)
  const served = MEALS.filter((m) => m !== 'snacks' && m !== 'bar' && v.slots.some((s) => s.meal === m)).map((m) => (m === 'formal' ? 'formal hall' : MEAL_LABEL[m].toLowerCase()))
  const meals = !formal && served.length ? sentence(served).replace(/^./, (c) => c.toUpperCase()) : ''
  const next = nextService(r)
  const booking = v.formal && formalBooking(v.formal)
  const facts = formal ? [formalWhen(v, v.formal).join('; '), v.formal && formalPrice(v.formal), v.formal && formalDress(v.formal), booking && `Booking: ${booking}`].filter((t): t is string => !!t) : []
  const preview: ReactNode = formal ? undefined : dishes?.length ? <p className="line-clamp-2">{dishes.join(' · ')}</p> : next ? <MenuPreview day={next} today={now.date} /> : <PricePreview venue={v} types={types} />
  // What's left of today: the meals still to come or being served (under Formal hall, only formal hall)
  const today = v.slots.filter((s) => slotApplies(s, now.date) && endMinutes(s) > now.minutes && (!formal || s.meal === 'formal')).sort(slotOrder)
  const menus = new Set(v.menu.filter((d) => d.date === now.date && d.items.length).map((d) => d.service))
  return { types, meals, facts, preview, today, menus }
}

/** The next meal's main dishes, one to a line, and how many more there are: a Dining card's menu at a glance. */
function MenuPreview({ day, today, max = 3 }: { day: MenuDay; today: string; max?: number }) {
  const { snapshot } = useReady()
  const mains = mainDishes(day.items)
  // A prerendered page can't say which day is tomorrow
  const when = snapshot || day.date === today ? '' : day.date === addDaysISO(today, 1) ? ' tomorrow' : ` ${dayLabel(dayOfISO(day.date))}`
  return (
    <div>
      <p className="font-medium">
        {MEAL_LABEL[day.service]}
        {when}
      </p>
      <ul>
        {mains.slice(0, max).map((i, n) => (
          <li key={n} className="truncate">{i.name}</li>
        ))}
      </ul>
      {mains.length > max && <p className="text-muted">+{mains.length - max} more</p>}
    </div>
  )
}

/** The prices of what people usually order at a venue of its kind (`headlinePrices`), its own kind's list first. */
function headlineLines(venue: Venue, types: VenueType[], max = 3): VenuePrice[] {
  const groups = priceGroups(venue.prices, types)
  const lines: VenuePrice[] = []
  for (const t of types) if (lines.length < max) lines.push(...headlinePrices(groups[t] ?? [], t, max - lines.length))
  return lines
}

/** `headlineLines`, as a card's line. */
function PricePreview({ venue, types, max = 3 }: { venue: Venue; types: VenueType[]; max?: number }) {
  const lines = headlineLines(venue, types, max)
  if (!lines.length) return null
  return <p className="line-clamp-2">{lines.map((p) => `${p.name} ${formatPrice(fromList(p))}`).join(' · ')}</p>
}

/**
 * A venue in the front page's list, as Airbnb's rows: its photo with what kind of venue it is on it; its college
 * (linked to its page) and name (its link covers the row); whether it's open, the next meal today and how far (nearest
 * first); then one thing to know: what a search matched, the next meal's main dishes, the prices of what people
 * usually order, or, under the Formal hall tab, when it is, its price, dress and booking. What isn't known yet is said
 * there instead, linked to sending it in. `card`: the same, smaller, as the card over a phone's map for the venue
 * picked on it. `selected` when its pin was picked.
 */
export function VenueRow({ r, now, selected = false, onHover, dishes, distance, formal = false, card = false }: { r: Ranked; now: LocalNow; selected?: boolean; onHover?: (id?: string) => void; dishes?: string[]; distance?: string; formal?: boolean; card?: boolean }) {
  const { snapshot } = useReady()
  const v = r.venue
  const types = venueTypes(v)
  const then = !snapshot && !formal ? nextToday(r, now) : undefined
  return (
    <li
      id={card ? undefined : `venue-${v.id}`}
      data-venue={v.id}
      onMouseEnter={() => onHover?.(v.id)}
      onMouseLeave={() => onHover?.(undefined)}
      onFocus={() => onHover?.(v.id)}
      onBlur={() => onHover?.(undefined)}
      className={`venue-row relative flex text-[15px] leading-snug transition-colors ${card ? 'raised gap-3 rounded-[20px] p-3' : `-mx-3 flex-col gap-3 rounded-[28px] p-3 sm:flex-row sm:gap-5 ${selected ? 'bg-accent/20' : 'hover:bg-ink/4'}`}`}
    >
      {card ? (
        <VenueThumb venue={v} className="size-24 rounded-xl" />
      ) : (
        // Airbnb's photo: 4:3, 20px corners, its label 14px in; across the top on a phone, as Airbnb's there
        <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-[20px] max-sm:aspect-[16/9] sm:w-[42%] sm:max-w-80">
          <VenueImage venue={v} sizes="(min-width: 640px) 20rem, 100vw" decorative icon="size-12" className="absolute inset-0 size-full" />
          <div className="absolute top-3.5 left-3.5 flex flex-wrap gap-1.5">
            {types.map((t) => (
              <span key={t} className="flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1 text-sm font-semibold text-ink shadow-[0_1px_4px_#0003]">
                <TypeLabel type={t} mark="size-4" />
              </span>
            ))}
          </div>
        </div>
      )}
      <div className={`min-w-0 flex-1 ${card ? '' : 'sm:pt-1'}`}>
        <Link to={sitePath(v.site)} className="relative z-10 text-sm text-muted hover:text-ink hover:underline">
          {siteName(v.site)}
        </Link>
        <h3 className={`title leading-snug ${card ? 'text-base' : 'text-lg sm:text-xl'}`}>
          <Link to={venuePath(v)} className="card-link after:absolute after:inset-0 hover:underline focus-visible:outline-none">
            {v.name}
          </Link>
        </h3>
        <p className="mt-1">
          <Status s={r.status} now={now} meal={v.type === 'hall' || types.length > 1} />
          {then && <span className="text-muted"> · {then}</span>}
          {distance && <span className="text-muted"> · {distance}</span>}
          {!snapshot && r.status.kind === 'unknown' && (
            <>
              {' · '}
              <Link to={sendPath(v, 'hours')} className="link relative z-10 text-muted hover:text-ink">Send them</Link>
            </>
          )}
        </p>
        <div className={`mt-2 ${card ? 'line-clamp-2' : ''}`}>
          <RowPreview r={r} now={now} types={types} dishes={dishes} formal={formal} compact={card} />
        </div>
      </div>
    </li>
  )
}

/** The meal after the one a venue's status names, still to come today: "Dinner 17:30", "Formal hall 19:30". */
function nextToday(r: Ranked, now: LocalNow): string | undefined {
  const s = r.status
  const named = s.kind === 'open' || s.kind === 'opening' ? s.slot : undefined
  const next = r.venue.slots
    .filter((x) => slotApplies(x, now.date) && hhmmToMinutes(x.start) > now.minutes && !(named && x.meal === named.meal && x.start === named.start))
    .sort(slotOrder)[0]
  if (!next || !named || next.meal === named.meal) return undefined
  return `${next.meal === 'formal' ? 'Formal hall' : MEAL_LABEL[next.meal]} ${next.start}`
}

/**
 * A row's one thing to know (see VenueRow), as a list that fills the space beside its photo: a meal's main dishes, the
 * usual prices lined up, formal hall's facts; or what's missing, linked to sending it in. `compact`: one or two lines,
 * for the card over a phone's map.
 */
function RowPreview({ r, now, types, dishes, formal, compact }: { r: Ranked; now: LocalNow; types: VenueType[]; dishes?: string[]; formal: boolean; compact: boolean }) {
  const { snapshot } = useReady()
  const v = r.venue
  const max = compact ? 3 : 5
  if (formal) {
    const facts: [string, string | undefined][] = [['When', formalWhen(v, v.formal).join('; ')], ['Price', v.formal && formalPrice(v.formal)], ['Dress', v.formal && formalDress(v.formal)], ['Booking', v.formal && formalBooking(v.formal)]]
    const known = facts.filter((f): f is [string, string] => !!f[1])
    if (!known.length) return <Gap to={sendPath(v, 'other')} send="Tell us">Times and price not known yet.</Gap>
    if (compact) return <p>{known.map((f) => f[1]).join(' · ')}</p>
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {known.map(([k, t]) => (
          <Fragment key={k}>
            <dt className="text-muted">{k}</dt>
            <dd>{t}</dd>
          </Fragment>
        ))}
      </dl>
    )
  }
  if (dishes?.length) return <Lines items={dishes} max={max} compact={compact} />
  const day = nextService(r)
  if (day) {
    const mains = mainDishes(day.items).filter((i) => i.name.toLowerCase() !== MEAL_LABEL[day.service].toLowerCase())
    // Today's meal unless it's another day's (a prerendered page can't say which day is today)
    const when = snapshot || day.date === now.date ? '' : day.date === addDaysISO(now.date, 1) ? ' tomorrow' : ` ${dayLabel(dayOfISO(day.date))}`
    return <Lines title={`${MEAL_LABEL[day.service]}${when}`} items={mains.map((i) => i.name)} max={max} compact={compact} />
  }
  const prices = headlineLines(v, types, max)
  if (prices.length)
    return compact ? (
      <p>{prices.map((p) => `${p.name} ${formatPrice(fromList(p))}`).join(' · ')}</p>
    ) : (
      <ul className="max-w-sm space-y-1">
        {prices.map((p, n) => (
          <li key={n} className="flex items-baseline justify-between gap-4">
            <span className="truncate">{p.name}</span>
            <span className="shrink-0 tabular-nums">{formatPrice(fromList(p))}</span>
          </li>
        ))}
      </ul>
    )
  if (v.type === 'hall' && !isFormalOnly(v)) return <Gap to={sendPath(v, 'menu')} send="Send a photo of the board">No menu here yet.</Gap>
  return <Gap to={sendPath(v, 'prices')} send="Send a photo of the list">No prices here yet.</Gap>
}

/** Dishes as a list, one to a line, with how many more; or, `compact`, on one line. */
function Lines({ title, items, max, compact }: { title?: string; items: string[]; max: number; compact: boolean }) {
  if (compact)
    return (
      <p>
        {title && <span className="font-medium">{title}: </span>}
        {items.join(' · ')}
      </p>
    )
  return (
    <div>
      {title && <p className="mb-1 font-semibold">{title}</p>}
      <ul className="space-y-1">
        {items.slice(0, max).map((t, n) => (
          <li key={n} className="flex gap-2.5">
            <span aria-hidden="true" className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-ink/30" />
            <span className="truncate">{t}</span>
          </li>
        ))}
      </ul>
      {items.length > max && <p className="mt-1 text-muted">+{items.length - max} more</p>}
    </div>
  )
}

/** What a row doesn't know yet, and how to send it in. */
function Gap({ to, send, children }: { to: string; send: string; children: ReactNode }) {
  return (
    <p className="text-muted">
      {children}{' '}
      <Link to={to} className="link relative z-10 text-ink">{send}</Link>
    </p>
  )
}

/**
 * A venue as a card, for the way it's used: its type as a badge on its photo (a second type beside its meals), then
 * a Dining venue leads with its meals today (as TheFork's time slots, "menu" under those with a menu posted) and the
 * next meal's main dishes; a café or bar with the prices of what people usually order; under the Formal hall tab
 * (`formal`), when it is, its price, dress and how to book. `showSite` names its college first, linked to its page
 * (many venues share a name); `dishes`, what a search matched; `distance`, how far it is, nearest first.
 */
export function VenueListing({ r, now, onHover, showSite = false, dishes, distance, formal = false }: { r: Ranked; now: LocalNow; onHover?: (id?: string) => void; showSite?: boolean; dishes?: string[]; distance?: string; formal?: boolean }) {
  const { snapshot } = useReady()
  const v = r.venue
  const { types, meals, facts, preview, today, menus } = venueFacts(r, now, formal, dishes)
  return (
    <Card
      onHover={(on) => onHover?.(on ? v.id : undefined)}
      photo={<VenueImage venue={v} sizes="(min-width: 640px) 16rem, 100vw" decorative icon="size-14" className="absolute inset-0 size-full" />}
      badges={
        <>
          <Badge>
            <TypeLabel type={v.type} mark="size-4" />
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
          {(types.length > 1 || meals) && (
            <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              {types.slice(1).map((t) => <TypeLabel key={t} type={t} mark="size-4" className="font-medium" />)}
              {meals && <span className="text-muted">{meals}</span>}
            </p>
          )}
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
      {preview && <div className="mt-3">{preview}</div>}
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
