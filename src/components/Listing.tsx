import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router'
import { NoteAdd } from 'reicon-react'
import { useReady } from '../lib/data.tsx'
import { mainDishes, MEAL_LABEL, plantTag, slotOrder, type Ranked } from '../lib/filters.ts'
import type { RowDish } from '../lib/finder.ts'
import { formalBooking, formalDress, formalPrice, formalWhen } from '../lib/formal.ts'
import { formatPrice, fromList, headlinePrices, priceGroups } from '../lib/prices.ts'
import { pinLabel } from '../lib/mapView.ts'
import { sendPath, sitePath, venuePath } from '../lib/site.ts'
import { leadsWithMeal } from '../lib/status.ts'
import { addDaysISO, dayLabel, dayOfISO, hhmmToMinutes, type LocalNow } from '../lib/time/clock.ts'
import { slotApplies, withDayTimes, type OpenStatus } from '../lib/time/openNow.ts'
import { isFormalOnly, venueTypes, type Meal, type Slot, type Venue, type VenuePrice, type VenueType } from '../lib/types.ts'
import { Icon } from './Icon.tsx'
import { PinMark } from './MapParts.tsx'
import { Code } from './MenuRows.tsx'
import { Status } from './Status.tsx'
import { RatingSummary } from './Reviews.tsx'
import { VenueImage, VenueThumb } from './VenuePhoto.tsx'

// The venues, a row each (its photo down the left, what to know beside it, its menu first), beside a map of them:
// the front page's and a site's.

/** The prices of what people usually order at a venue of its kind (`headlinePrices`), its own kind's list first. */
function headlineLines(venue: Venue, types: VenueType[], max = 3): VenuePrice[] {
  const groups = priceGroups(venue.prices, types)
  const lines: VenuePrice[] = []
  for (const t of types) if (lines.length < max) lines.push(...headlinePrices(groups[t] ?? [], t, max - lines.length))
  return lines
}

/**
 * The lines a row's dishes or usual prices fill beside its photo, a dish heading among them: five, so the list ends
 * with the photo at its full size (288px wide, 4:3).
 */
const LINES = 5

/**
 * A venue in the front page's list: its photo, with its map pin's mark in the corner for what kind of venue it is, the
 * same on every tab; its college by the name people use (linked to its page) and its name on one line (its link covers
 * the row); whether it's open, the next meal today and how far
 * (nearest first); then one thing to know: what a search matched, the next meal's main dishes with their meat-free
 * tags, the prices of what people usually order, or, under the Formal hall tab, when it is, its price, dress
 * and booking. What isn't known yet is said there instead, linked to sending it in. `card`: the same, smaller, as the
 * card over a phone's map for the venue picked on it. `selected` when its pin was picked. `showSite: false` on its
 * site's own page.
 */
export function VenueRow({ r, now, selected = false, onHover, dishes, distance, formal = false, card = false, showSite = true }: { r: Ranked; now: LocalNow; selected?: boolean; onHover?: (id?: string) => void; dishes?: RowDish[]; distance?: string; formal?: boolean; card?: boolean; showSite?: boolean }) {
  const { snapshot } = useReady()
  const v = r.venue
  const types = venueTypes(v)
  // While it's closed, the meal whose menu it lists
  const status = snapshot ? r.status : rowStatus(r, now, !formal && !dishes?.length)
  const after = !snapshot && !formal ? nextToday(r, now) : undefined
  // Not when the menu under it is that meal's, headed with its time already
  const then = after && !(!dishes?.length && r.next?.date === now.date && r.next.service === after.meal) ? `${after.meal === 'formal' ? 'Formal hall' : MEAL_LABEL[after.meal]} ${after.start}` : undefined
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
        // Its photo: 4:3 at least, 20px corners, its pin's mark 14px in; as tall as the row beside it, which can run past
        // 4:3; across the top on a phone, 16:9
        <div className="relative w-full shrink-0 overflow-hidden rounded-[1.25rem] sm:w-[38%] sm:max-w-72">
          <div aria-hidden="true" className="aspect-[16/9] sm:aspect-[4/3]" />
          <VenueImage venue={v} sizes="(min-width: 640px) 18rem, 100vw" decorative icon="size-12" className="absolute inset-0 size-full" />
          <PinMark types={types} className="on-photo" label />
        </div>
      )}
      <div className={`min-w-0 flex-1 ${card ? '' : 'sm:py-1'}`}>
        {/* Its college by the name people use, then its own, on one line ("Robinson · Garden Restaurant"); its rating
            beside them, once 5 members have rated it */}
        <div className="flex items-baseline justify-between gap-3">
          <h3 className={`title min-w-0 leading-tight ${card ? 'text-base' : 'text-xl sm:text-2xl'}`}>
            {showSite && (
              <>
                <Link to={sitePath(v.site)} className="relative z-10 text-site-ink hover:underline">
                  {v.site.short_name ?? v.site.name}
                </Link>
                <span aria-hidden="true" className="text-muted"> · </span>
                <span className="sr-only"> </span>
              </>
            )}
            <Link to={venuePath(v)} className="card-link after:absolute after:inset-0 hover:underline focus-visible:outline-none">
              {v.name}
            </Link>
          </h3>
          <RatingSummary venue={v} compact className={`shrink-0 ${card ? 'text-sm' : 'text-base'}`} />
        </div>
        <p className={card ? 'mt-1' : 'mt-1.5'}>
          <Status s={status} now={now} meal={named} />
          {then && <span className="text-muted"> · {then}</span>}
          {distance && <span className="text-muted"> · {distance}</span>}
          {!snapshot && r.status.kind === 'unknown' && (
            <>
              {' · '}
              <Link to={sendPath(v, 'hours')} className="relative z-10 font-semibold text-cta hover:underline">Send them</Link>
            </>
          )}
        </p>
        <div className={card ? 'mt-2 line-clamp-2' : '@container mt-3 text-[1.0625rem]'}>
          <RowPreview r={{ ...r, status }} now={now} types={types} dishes={dishes} formal={formal} named={named} compact={card} />
        </div>
      </div>
    </li>
  )
}

/** When a venue serves a meal on a date: its first time that day, a menu's note's times applied. */
function mealSlot(v: Venue, meal: Meal, date: string): Slot | undefined {
  return withDayTimes(v.slots, v.menu).filter((x) => x.meal === meal && slotApplies(x, date)).sort(slotOrder)[0]
}

/**
 * The status a row shows. While it's closed, or yet to open today, for the meal whose menu it lists (`menu`) rather
 * than an earlier one without a menu: "Lunch tomorrow 11:45" over lunch's dishes, not "Breakfast tomorrow 08:00", so
 * the row names one meal. Open now, it says so whatever the menu below.
 */
function rowStatus(r: Ranked, now: LocalNow, menu: boolean): OpenStatus {
  const s = r.status
  const day = r.next
  const at = s.kind === 'opening' ? s : s.kind === 'closed' ? s.next : undefined
  if (!menu || !day || !at || (at.date === day.date && at.slot.meal === day.service)) return s
  const slot = mealSlot(r.venue, day.service, day.date)
  if (!slot) return s
  const days = Math.round((Date.parse(day.date) - Date.parse(now.date)) / 86_400_000)
  return { kind: 'closed', next: { slot, date: day.date, opensInMin: days * 1440 + hhmmToMinutes(slot.start) - now.minutes } }
}

/** The meal after the one a venue's status names, still to come today ("· Dinner 17:30", "· Formal hall 19:30"). */
function nextToday(r: Ranked, now: LocalNow): Slot | undefined {
  const s = r.status
  const named = s.kind === 'open' || s.kind === 'opening' ? s.slot : undefined
  const next = withDayTimes(r.venue.slots, r.venue.menu)
    .filter((x) => slotApplies(x, now.date) && hhmmToMinutes(x.start) > now.minutes && !(named && x.meal === named.meal && x.start === named.start))
    .sort(slotOrder)[0]
  if (!next || !named || next.meal === named.meal) return undefined
  return next
}

/**
 * A row's one thing to know (see VenueRow) beside its photo: a meal's main dishes, the usual prices lined up, formal
 * hall's facts; or what's missing, linked to sending it in. A meal's name and time head its dishes, in the status
 * line's words ("Lunch tomorrow 12:30" under "Breakfast tomorrow 07:30"), only when the status above doesn't already
 * name it (`named`): another meal's, or another day's. `compact`: one or two lines, for the card over a phone's map.
 */
function RowPreview({ r, now, types, dishes, formal, named, compact }: { r: Ranked; now: LocalNow; types: VenueType[]; dishes?: RowDish[]; formal: boolean; named: boolean; compact: boolean }) {
  const { snapshot } = useReady()
  const v = r.venue
  if (formal) {
    const facts: [string, string | undefined][] = [['When', formalWhen(v, v.formal).join('; ')], ['Price', v.formal && formalPrice(v.formal)], ['Dress', v.formal && formalDress(v.formal)], ['Booking', v.formal && formalBooking(v.formal)]]
    const known = facts.filter((f): f is [string, string] => !!f[1])
    if (!known.length) return <Gap to={sendPath(v, 'other', { topic: 'formal' })} send="Tell us" compact={compact}>Times and price not known yet.</Gap>
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
  if (dishes?.length) return <Dishes items={dishes} compact={compact} />
  const s = r.status
  const at = s.kind === 'open' || s.kind === 'opening' ? s : s.kind === 'closed' ? s.next : undefined
  const day = r.next
  if (day) {
    const mains = mainDishes(day.items).filter((i) => i.name.toLowerCase() !== MEAL_LABEL[day.service].toLowerCase())
    // Today's meal unless it's another day's (a prerendered page can't say which day is today)
    const when = snapshot || day.date === now.date ? '' : day.date === addDaysISO(now.date, 1) ? ' tomorrow' : ` ${dayLabel(dayOfISO(day.date))}`
    // The status names a meal it leads with; a café's or bar's hours are its own, with nothing more to name
    const said = !snapshot && at?.date === day.date && at.slot.meal === day.service && (named || !leadsWithMeal(day.service))
    // When it's served that day, as the status says when a venue opens
    const slot = mealSlot(v, day.service, day.date)
    const title = `${MEAL_LABEL[day.service]}${when}${slot ? ` ${slot.start}` : ''}`
    // A meal posted elsewhere says so ("European Night, see posters for details")
    return <Dishes title={said ? undefined : title} items={day.items.length ? mains : [{ name: day.note ?? '', tags: [] }]} compact={compact} />
  }
  const prices = headlineLines(v, types, compact ? 3 : LINES * 2)
  if (prices.length)
    return compact ? (
      <p>{prices.map((p) => `${p.name} ${formatPrice(fromList(p))}`).join(' · ')}</p>
    ) : (
      // Each price near its name, a column no wider than 20rem; two columns where the row has room, so up to ten
      <ul className="grid gap-x-10 gap-y-1 @lg:grid-cols-2">
        {prices.map((p, n) => (
          <li key={n} className={`max-w-xs items-baseline justify-between gap-4 ${n < LINES ? 'flex' : 'hidden @lg:flex'}`}>
            <span className="truncate">{p.name}</span>
            <span className="shrink-0 tabular-nums">{formatPrice(fromList(p))}</span>
          </li>
        ))}
      </ul>
    )
  if (v.type === 'hall' && !isFormalOnly(v)) {
    // Today's meal it's serving or opening for by name ("No dinner menu yet"), tomorrow's by the day: menus someone can
    // see. One further off (Wednesday's, on a Sunday) isn't anyone's to send yet, so it asks for none in particular. A
    // scripted menu isn't ours to ask for
    const today = !at || snapshot || at.date === now.date
    const tomorrow = !today && at.date === addDaysISO(now.date, 1)
    const meal = !today ? '' : at && ['breakfast', 'brunch', 'lunch', 'dinner'].includes(at.slot.meal) ? `${MEAL_LABEL[at.slot.meal].toLowerCase()} ` : ''
    const on = tomorrow ? ' for tomorrow' : ''
    if (v.menu_scripted) return <p className="text-muted">No {meal}menu posted{on} yet.</p>
    return <Gap to={sendPath(v, 'menu', at && !snapshot && (today || tomorrow) ? { date: at.date, ...(meal && { meal: at.slot.meal }) } : {})} send="Send it in" compact={compact}>No {meal}menu{on} yet.</Gap>
  }
  return <Gap to={sendPath(v, 'prices')} send={types[0] === 'bar' ? 'Send the drinks list' : 'Send the price list'} compact={compact}>No prices yet.</Gap>
}

/**
 * A meal's dishes, a bullet each, under its name and time when given, within `LINES`: the last also says how many
 * more there are when they don't fit ("Grilled Bacon +17 more"). Each carries its strongest meat-free code (VG, else PB, else V; `plantTag()`), so a
 * vegetarian can run down them. `compact`: on one line, " · " between them, for the card over a phone's map.
 */
function Dishes({ title, items, compact = false }: { title?: string; items: RowDish[]; compact?: boolean }) {
  if (compact)
    return (
      <p>
        {title && <span className="font-semibold">{title}: </span>}
        {items.map((d, n) => {
          const tag = plantTag(d.tags)
          return (
            <Fragment key={n}>
              {n > 0 && (
                <>
                  <span aria-hidden="true" className="text-muted"> · </span>
                  <span className="sr-only">, </span>
                </>
              )}
              {d.name}
              {tag && <Code tag={tag} small className="ml-1" />}
            </Fragment>
          )
        })}
      </p>
    )
  const shown = items.slice(0, LINES - (title ? 1 : 0))
  const more = items.length - shown.length
  return (
    <div>
      {title && <p className="mb-1 font-semibold">{title}</p>}
      <ul className="space-y-1">
        {shown.map((d, n) => {
          const tag = plantTag(d.tags)
          return (
            <li key={n} className="flex items-baseline gap-2.5">
              <span aria-hidden="true" className="size-1.5 shrink-0 -translate-y-[0.2em] rounded-full bg-ink/30" />
              <span className="min-w-0 truncate">{d.name}</span>
              {tag && <Code tag={tag} small className="shrink-0" />}
              {more > 0 && n === shown.length - 1 && <span className="shrink-0 text-muted">+{more} more</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * What a row doesn't know yet, and how to send it in (a photo or the text): a note to add to, in a Light Blue disc,
 * what's missing, and the way to send it in Warm Blue, deepened to read as text. `compact`: on one line, for a card.
 */
function Gap({ to, send, compact = false, children }: { to: string; send: string; compact?: boolean; children: ReactNode }) {
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
        <Icon of={NoteAdd} className="size-6" />
      </span>
      <div className="min-w-0">
        <p className="text-muted">{children}</p>
        {action}
      </div>
    </div>
  )
}

/**
 * Dining's venues without a menu for the date and meal picked, folded into one line at the foot of its list, so the
 * menus lead: each linked to its page (and its pin lit on the map), then the way to send one in.
 */
export function NoMenuLine({ rows, onHover }: { rows: Ranked[]; onHover?: (id?: string) => void }) {
  if (!rows.length) return null
  return (
    <p className="mt-4 border-t border-ink/10 pt-4 text-[0.9375rem] leading-relaxed text-muted">
      <span className="font-semibold text-ink">No menu yet</span> at {rows.length === 1 ? 'one more' : `${rows.length} more`}:{' '}
      {rows.map((r, n) => (
        <Fragment key={r.venue.id}>
          {n > 0 && ', '}
          <Link to={venuePath(r.venue)} onMouseEnter={() => onHover?.(r.venue.id)} onMouseLeave={() => onHover?.(undefined)} className="text-ink hover:underline">
            {/* The site's name before a venue's that says nothing alone ("Clare Buttery"), as its map pin's label does */}
            {pinLabel(r.venue) !== r.venue.name && <span className="text-site-ink">{r.venue.site.short_name ?? r.venue.site.name} </span>}
            {r.venue.name}
          </Link>
        </Fragment>
      ))}
      .{' '}
      <Link to="/send" className="font-semibold text-cta hover:underline">Send one in</Link>
    </p>
  )
}
