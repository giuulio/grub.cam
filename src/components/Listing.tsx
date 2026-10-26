import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router'
import { NoteAdd, type IconComponent } from 'reicon-react'
import { useReady } from '../lib/data.tsx'
import { mainDishes, MEAL_LABEL, slotOrder, type Ranked } from '../lib/filters.ts'
import { formalBooking, formalDress, formalPrice, formalWhen } from '../lib/formal.ts'
import { formatPrice, fromList, headlinePrices, priceGroups } from '../lib/prices.ts'
import { sendPath, sitePath, venuePath } from '../lib/site.ts'
import { leadsWithMeal } from '../lib/status.ts'
import { addDaysISO, dayLabel, dayOfISO, hhmmToMinutes, type LocalNow } from '../lib/time/clock.ts'
import { slotApplies, withDayTimes } from '../lib/time/openNow.ts'
import { isFormalOnly, venueTypes, type Venue, type VenuePrice, type VenueType } from '../lib/types.ts'
import { Icon } from './Icon.tsx'
import { PinMark } from './MapParts.tsx'
import { Status } from './Status.tsx'
import { RatingSummary } from './Reviews.tsx'
import { VenueImage, VenueThumb } from './VenuePhoto.tsx'

// The venues as Airbnb lists homes, a row each (its photo down the left, what to know beside it), beside a map of them:
// the front page's and a site's.

/** The prices of what people usually order at a venue of its kind (`headlinePrices`), its own kind's list first. */
function headlineLines(venue: Venue, types: VenueType[], max = 3): VenuePrice[] {
  const groups = priceGroups(venue.prices, types)
  const lines: VenuePrice[] = []
  for (const t of types) if (lines.length < max) lines.push(...headlinePrices(groups[t] ?? [], t, max - lines.length))
  return lines
}

/** The lines a row's preview fills beside its photo, its heading and "+N more" among them; a card's, on one line. */
const LINES = 4

/**
 * A venue in the front page's list, as Airbnb's rows: its photo, with its map pin's mark in the corner for what kind
 * of venue it is, the same on every tab; its college by the name people use (linked to its page) and its name (its
 * link covers the row); whether it's open, the next meal today and how far (nearest first); then one thing to know: what a search
 * matched, the next meal's main dishes, the prices of what people usually order, or, under the Formal hall tab, when it
 * is, its price, dress and booking. What isn't known yet is said there instead, linked to sending it in. The photo
 * runs the row's height, so nothing hangs below it. `card`: the same, smaller, as the card over a phone's map for the
 * venue picked on it. `selected` when its pin was picked. `showSite: false` on its site's own page.
 */
export function VenueRow({ r, now, selected = false, onHover, dishes, distance, formal = false, card = false, showSite = true }: { r: Ranked; now: LocalNow; selected?: boolean; onHover?: (id?: string) => void; dishes?: string[]; distance?: string; formal?: boolean; card?: boolean; showSite?: boolean }) {
  const { snapshot } = useReady()
  const v = r.venue
  const types = venueTypes(v)
  const then = !snapshot && !formal ? nextToday(r, now) : undefined
  // The status leads with the meal for a venue serving more than one (`leadsWithMeal()`); its preview then needn't again
  const named = v.type === 'hall' || types.length > 1
  return (
    <li
      id={card ? undefined : `venue-${v.id}`}
      data-venue={v.id}
      onMouseEnter={() => onHover?.(v.id)}
      onMouseLeave={() => onHover?.(undefined)}
      onFocus={() => onHover?.(v.id)}
      onBlur={() => onHover?.(undefined)}
      className={`venue-row relative flex leading-snug transition-colors ${card ? 'raised gap-3 rounded-[1.25rem] p-3 text-[0.9375rem]' : `-mx-3 flex-col gap-3 rounded-[1.75rem] p-3 text-base sm:flex-row sm:gap-5 ${selected ? 'bg-accent/20' : 'hover:bg-ink/4'}`}`}
    >
      {card ? (
        <VenueThumb venue={v} className="size-24 rounded-xl" />
      ) : (
        // Airbnb's photo: 4:3 at least, 20px corners, its label 14px in; as tall as the row beside it, which can run
        // past 4:3; across the top on a phone, 16:9, as Airbnb's there
        <div className="relative w-full shrink-0 overflow-hidden rounded-[1.25rem] sm:w-[38%] sm:max-w-72">
          <div aria-hidden="true" className="aspect-[16/9] sm:aspect-[4/3]" />
          <VenueImage venue={v} sizes="(min-width: 640px) 18rem, 100vw" decorative icon="size-12" className="absolute inset-0 size-full" />
          <PinMark types={types} className="on-photo" label />
        </div>
      )}
      <div className={`min-w-0 flex-1 ${card ? '' : 'sm:py-1'}`}>
        {showSite && (
          <Link to={sitePath(v.site)} className={`relative z-10 font-semibold text-site-ink hover:underline ${card ? 'text-sm' : ''}`}>
            {v.site.short_name ?? v.site.name}
          </Link>
        )}
        {/* Its rating beside its name, as Airbnb's, once 5 members have rated it */}
        <div className="flex items-baseline justify-between gap-3">
          <h3 className={`title min-w-0 leading-tight ${card ? 'text-base' : 'text-xl sm:text-2xl'}`}>
            <Link to={venuePath(v)} className="card-link after:absolute after:inset-0 hover:underline focus-visible:outline-none">
              {v.name}
            </Link>
          </h3>
          <RatingSummary venue={v} compact className={`shrink-0 ${card ? 'text-sm' : 'text-base'}`} />
        </div>
        <p className={card ? 'mt-1' : 'mt-1.5'}>
          <Status s={r.status} now={now} meal={named} />
          {then && <span className="text-muted"> · {then}</span>}
          {distance && <span className="text-muted"> · {distance}</span>}
          {!snapshot && r.status.kind === 'unknown' && (
            <>
              {' · '}
              <Link to={sendPath(v, 'hours')} className="relative z-10 font-semibold text-cta hover:underline">Send them</Link>
            </>
          )}
        </p>
        <div className={card ? 'mt-2 line-clamp-2' : 'mt-3'}>
          <RowPreview r={r} now={now} types={types} dishes={dishes} formal={formal} named={named} compact={card} />
        </div>
      </div>
    </li>
  )
}

/** The meal after the one a venue's status names, still to come today: "Dinner 17:30", "Formal hall 19:30". */
function nextToday(r: Ranked, now: LocalNow): string | undefined {
  const s = r.status
  const named = s.kind === 'open' || s.kind === 'opening' ? s.slot : undefined
  const next = withDayTimes(r.venue.slots, r.venue.menu)
    .filter((x) => slotApplies(x, now.date) && hhmmToMinutes(x.start) > now.minutes && !(named && x.meal === named.meal && x.start === named.start))
    .sort(slotOrder)[0]
  if (!next || !named || next.meal === named.meal) return undefined
  return `${next.meal === 'formal' ? 'Formal hall' : MEAL_LABEL[next.meal]} ${next.start}`
}

/**
 * A row's one thing to know (see VenueRow), as a list that fills the space beside its photo: a meal's main dishes, the
 * usual prices lined up, formal hall's facts; or what's missing, linked to sending it in. A meal's name heads its dishes
 * only when the status line above doesn't already say it (`named`): another meal's, or another day's. `compact`: one or
 * two lines, for the card over a phone's map.
 */
function RowPreview({ r, now, types, dishes, formal, named, compact }: { r: Ranked; now: LocalNow; types: VenueType[]; dishes?: string[]; formal: boolean; named: boolean; compact: boolean }) {
  const { snapshot } = useReady()
  const v = r.venue
  if (formal) {
    const facts: [string, string | undefined][] = [['When', formalWhen(v, v.formal).join('; ')], ['Price', v.formal && formalPrice(v.formal)], ['Dress', v.formal && formalDress(v.formal)], ['Booking', v.formal && formalBooking(v.formal)]]
    const known = facts.filter((f): f is [string, string] => !!f[1])
    if (!known.length) return <Gap to={sendPath(v, 'other', { topic: 'formal' })} send="Tell us" icon={NoteAdd} compact={compact}>Times and price not known yet.</Gap>
    if (compact) return <p>{known.map((f) => f[1]).join(' · ')}</p>
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        {known.map(([k, t]) => (
          <Fragment key={k}>
            <dt className="text-muted">{k}</dt>
            <dd className="truncate">{t}</dd>
          </Fragment>
        ))}
      </dl>
    )
  }
  if (dishes?.length) return <Lines items={dishes} compact={compact} />
  const s = r.status
  const at = s.kind === 'open' || s.kind === 'opening' ? s : s.kind === 'closed' ? s.next : undefined
  const day = r.next
  if (day) {
    const mains = mainDishes(day.items).filter((i) => i.name.toLowerCase() !== MEAL_LABEL[day.service].toLowerCase())
    // Today's meal unless it's another day's (a prerendered page can't say which day is today)
    const when = snapshot || day.date === now.date ? '' : day.date === addDaysISO(now.date, 1) ? ' tomorrow' : ` ${dayLabel(dayOfISO(day.date))}`
    // The status names a meal it leads with; a café's or bar's hours are its own, with nothing more to name
    const said = !snapshot && at?.date === day.date && at.slot.meal === day.service && (named || !leadsWithMeal(day.service))
    // A meal posted elsewhere says so ("European Night, see posters for details")
    return <Lines title={said ? undefined : `${MEAL_LABEL[day.service]}${when}`} items={day.items.length ? mains.map((i) => i.name) : [day.note ?? '']} compact={compact} />
  }
  const prices = headlineLines(v, types, compact ? 3 : LINES)
  if (prices.length)
    return compact ? (
      <p>{prices.map((p) => `${p.name} ${formatPrice(fromList(p))}`).join(' · ')}</p>
    ) : (
      <ul className="max-w-md space-y-1.5">
        {prices.map((p, n) => (
          <li key={n} className="flex items-baseline justify-between gap-4">
            <span className="truncate">{p.name}</span>
            <span className="shrink-0 tabular-nums">{formatPrice(fromList(p))}</span>
          </li>
        ))}
      </ul>
    )
  if (v.type === 'hall' && !isFormalOnly(v)) {
    // Today's meal it's serving or opening for by name ("No dinner menu yet"), another day's by the day; a scripted menu
    // isn't ours to ask for
    const today = !at || snapshot || at.date === now.date
    const meal = !today ? '' : at && ['breakfast', 'brunch', 'lunch', 'dinner'].includes(at.slot.meal) ? `${MEAL_LABEL[at.slot.meal].toLowerCase()} ` : ''
    const on = today ? '' : at.date === addDaysISO(now.date, 1) ? ' for tomorrow' : ` for ${dayLabel(dayOfISO(at.date))}`
    if (v.menu_scripted) return <p className="text-muted">No {meal}menu posted{on} yet.</p>
    return <Gap to={sendPath(v, 'menu', at && !snapshot ? { date: at.date, ...(meal && { meal: at.slot.meal }) } : {})} send="Send it in" compact={compact}>No {meal}menu{on} yet.</Gap>
  }
  return <Gap to={sendPath(v, 'prices')} send={types[0] === 'bar' ? 'Send the drinks list' : 'Send the price list'} compact={compact}>No prices yet.</Gap>
}

/**
 * Dishes as a list, one to a line, under their meal's name when it's given, within `LINES`: the last says how many
 * more there are when they don't fit. `compact`: on one line.
 */
function Lines({ title, items, compact }: { title?: string; items: string[]; compact: boolean }) {
  if (compact)
    return (
      <p>
        {title && <span className="font-medium">{title}: </span>}
        {items.join(' · ')}
      </p>
    )
  const room = LINES - (title ? 1 : 0)
  const shown = items.length > room ? room - 1 : room
  return (
    <div>
      {title && <p className="mb-1.5 font-semibold">{title}</p>}
      <ul className="space-y-1.5">
        {items.slice(0, shown).map((t, n) => (
          <li key={n} className="flex gap-2.5">
            <span aria-hidden="true" className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-ink/30" />
            <span className="truncate">{t}</span>
          </li>
        ))}
        {items.length > shown && <li className="pl-4 text-muted">+{items.length - shown} more</li>}
      </ul>
    </div>
  )
}

/**
 * What a row doesn't know yet, and how to send it in (a photo or the text): a note to add to, in a Light Blue disc,
 * what's missing, and the way to send it in Warm Blue, deepened to read as text. `compact`: on one line, for a card.
 */
function Gap({ to, send, icon = NoteAdd, compact = false, children }: { to: string; send: string; icon?: IconComponent; compact?: boolean; children: ReactNode }) {
  const action = <Link to={to} className="relative z-10 font-semibold text-cta hover:underline">{send}</Link>
  if (compact)
    return (
      <p className="text-muted">
        {children} {action}
      </p>
    )
  return (
    <div className="flex items-center gap-3">
      {/* Not beside a map on a tablet, where the row's text has little room */}
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-cta-bg text-cta md:max-lg:hidden">
        <Icon of={icon} className="size-6" />
      </span>
      <div className="min-w-0">
        <p className="text-muted">{children}</p>
        {action}
      </div>
    </div>
  )
}
