import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRight, Home } from 'reicon-react'
import { useReady } from '../lib/data.tsx'
import { mainDishes, MEAL_LABEL, nextService, slotOrder, type Ranked } from '../lib/filters.ts'
import { formalBooking, formalDress, formalPrice, formalWhen } from '../lib/formal.ts'
import { formatPrice, fromList, headlinePrices, priceGroups } from '../lib/prices.ts'
import { sendPath, siteName, sitePath, venuePath } from '../lib/site.ts'
import { addDaysISO, dayLabel, dayOfISO, hhmmToMinutes, type LocalNow } from '../lib/time/clock.ts'
import { slotApplies } from '../lib/time/openNow.ts'
import { isFormalOnly, venueTypes, type Venue, type VenuePrice, type VenueType } from '../lib/types.ts'
import { Icon } from './Icon.tsx'
import { Status } from './Status.tsx'
import { TypeLabel, VenueImage, VenueThumb } from './VenuePhoto.tsx'

// The venues as Airbnb lists homes, a row each (its photo down the left, what to know beside it), beside a map of them:
// the front page's and a site's.

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

/** The prices of what people usually order at a venue of its kind (`headlinePrices`), its own kind's list first. */
function headlineLines(venue: Venue, types: VenueType[], max = 3): VenuePrice[] {
  const groups = priceGroups(venue.prices, types)
  const lines: VenuePrice[] = []
  for (const t of types) if (lines.length < max) lines.push(...headlinePrices(groups[t] ?? [], t, max - lines.length))
  return lines
}

/**
 * A venue in the front page's list, as Airbnb's rows: its photo with what kind of venue it is on it; its college
 * (linked to its page) and name (its link covers the row); whether it's open, the next meal today and how far (nearest
 * first); then one thing to know: what a search matched, the next meal's main dishes, the prices of what people
 * usually order, or, under the Formal hall tab, when it is, its price, dress and booking. What isn't known yet is said
 * there instead, linked to sending it in. `card`: the same, smaller, as the card over a phone's map for the venue
 * picked on it. `selected` when its pin was picked. `showSite: false` on its site's own page.
 */
export function VenueRow({ r, now, selected = false, onHover, dishes, distance, formal = false, card = false, showSite = true }: { r: Ranked; now: LocalNow; selected?: boolean; onHover?: (id?: string) => void; dishes?: string[]; distance?: string; formal?: boolean; card?: boolean; showSite?: boolean }) {
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
        {showSite && (
          <Link to={sitePath(v.site)} className="relative z-10 text-sm text-muted hover:text-ink hover:underline">
            {siteName(v.site)}
          </Link>
        )}
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
