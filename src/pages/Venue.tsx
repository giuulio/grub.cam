import { useState, type ReactNode } from 'react'
import { Calendar2, Card, Location, Users } from 'reicon-react'
import { Link, useParams, useSearchParams } from 'react-router'
import { BackButton } from '../components/BackButton.tsx'
import { DayMenu } from '../components/DayMenu.tsx'
import { ExternalLink } from '../components/ExternalLink.tsx'
import { Icon } from '../components/Icon.tsx'
import { DayStepper, MenuCalendar } from '../components/MenuCalendar.tsx'
import { menuGap } from '../lib/coverage.ts'
import { servedMeals } from '../lib/prices.ts'
import { useMenuDates, useMenuOn, useReady } from '../lib/data.tsx'
import { ACCESS_LABEL, MEAL_LABEL, periodSlots, TYPE_LABEL, typeNote } from '../lib/filters.ts'
import { TYPE_ICON } from '../lib/icons.ts'
import { SITE_NAME, siteName } from '../lib/site.ts'
import { useNow } from '../lib/useNow.ts'
import { addDaysISO, dayLabel, dayOfISO, formatDays, formatISODate, isISODate, relativeDay, type LocalNow } from '../lib/time/clock.ts'
import { openStatus, slotApplies, type OpenStatus } from '../lib/time/openNow.ts'
import type { Channel, Venue } from '../lib/types.ts'
import { NotFound } from './NotFound.tsx'

export function VenuePage() {
  const params = useParams()
  const { venues } = useReady()
  const now = useNow()

  const venue = venues.find((v) => v.site.slug === params.site && v.slug === params.venue)
  if (!venue) return <NotFound />
  const site = venue.site.short_name ?? venue.site.name

  return (
    <>
      <title>{`${venue.name}, ${siteName(venue.site)}: ${venue.menu.length ? 'menu and hours' : 'opening hours'} · ${SITE_NAME}`}</title>
      <BackButton up={`/${venue.site.slug}`} />
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{venue.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
          <Link to={`/${venue.site.slug}`} className="transition-colors hover:text-ink">
            {site}
          </Link>
          {typeNote(venue) && <span title={TYPE_LABEL[venue.type]} className="flex items-center gap-1.5">
            <Icon of={TYPE_ICON[venue.type]} />
            {typeNote(venue)}
          </span>}
        </div>
      </div>

      <MenuSection key={venue.id} venue={venue} now={now} facts={<Facts venue={venue} now={now} />} />
    </>
  )
}

/** What doesn't change with the menu date: open now, the hours, who can go in, how to pay, links. */
function Facts({ venue, now }: { venue: Venue; now: LocalNow }) {
  const { snapshot } = useReady()
  const slots = periodSlots(venue.slots, now.date)
  // A café's "Café, Daily" says nothing the page doesn't: name the meal only when there's more than one
  const meals = new Set(slots.map((s) => s.meal)).size > 1
  const mapped = venue.latitude != null && venue.longitude != null
  const more = venue.access.level !== 'unknown' || venue.payment.bank_card || mapped || venue.url
  return (
    <div className="rounded-xl border border-ink/10 p-4 text-sm">
      <StatusLine s={openStatus(venue.slots, now)} now={now} />
      <h2 className="mb-2 text-xs tracking-wide text-muted uppercase">Hours</h2>
      {slots.length ? (
        <table className="w-full tabular-nums">
          <tbody>
            {slots.map((s, i) => (
              // Today's services stand out, once the page knows what today is
              <tr key={i} className={!snapshot && slotApplies(s, now.date) ? 'text-ink' : 'text-muted'}>
                {meals && <td className="py-0.5 pr-2 align-top">{MEAL_LABEL[s.meal]}</td>}
                <td className="py-0.5 pr-2 align-top">{formatDays(s.days)}</td>
                <td className="py-0.5 text-right align-top whitespace-nowrap">
                  {s.start}–{s.end}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-muted">Hours not published</p>
      )}
      {more && <ul className="mt-4 space-y-1.5 border-t border-ink/10 pt-4 text-muted">
        {venue.access.level !== 'unknown' && (
          <li className="flex items-center gap-2">
            <Icon of={Users} />
            {ACCESS_LABEL[venue.access.level]}
          </li>
        )}
        {venue.payment.bank_card && (
          <li className="flex items-center gap-2">
            <Icon of={Card} />
            Bank card
          </li>
        )}
        {mapped && (
          <li>
            <Link to={`/?place=${encodeURIComponent(venue.id)}`} className="flex items-center gap-2 transition-colors hover:text-ink">
              <Icon of={Location} />
              On the map
            </Link>
          </li>
        )}
        {venue.url && (
          <li>
            <ExternalLink href={venue.url} />
          </li>
        )}
      </ul>}
    </div>
  )
}

/** Open now and until when, or the next service; nothing on a prerendered page, which can't know when it's read. */
function StatusLine({ s, now }: { s: OpenStatus; now: LocalNow }) {
  if (useReady().snapshot || s.kind === 'unknown' || (s.kind === 'closed' && !s.next)) return null
  const { slot, date } = s.kind === 'closed' ? s.next! : s
  const day = date === now.date ? '' : `${relativeDay(date, now.date)?.toLowerCase() ?? dayLabel(dayOfISO(date))} `
  return (
    <div className="mb-4 border-b border-ink/10 pb-4">
      <p className="flex items-center gap-2 font-medium">
        {s.kind === 'open' && <span aria-hidden="true" className="size-2 rounded-full bg-accent ring-1 ring-accent-ink/20" />}
        {s.kind === 'open' ? 'Open now' : s.kind === 'opening' ? 'Opens soon' : 'Closed'}
      </p>
      <p className="text-muted tabular-nums">
        {MEAL_LABEL[slot.meal]} {s.kind === 'open' ? `until ${slot.end}` : `${day}${slot.start}–${slot.end}`}
      </p>
    </div>
  )
}

const FIXED_MENU_DAYS = 14

/**
 * The menu for one date (?date=, default today), with a calendar of every date that has one and the venue's facts beside it.
 * On a phone the facts come first and the calendar opens from the date.
 */
function MenuSection({ venue, now, facts }: { venue: Venue; now: LocalNow; facts: ReactNode }) {
  const { snapshot } = useReady()
  const [params, setParams] = useSearchParams()
  const [calendarOpen, setCalendarOpen] = useState(false)
  const asked = params.get('date') ?? ''
  const date = isISODate(asked) ? asked : now.date
  const setDate = (d: string) => setParams(d === now.date ? {} : { date: d }, { replace: true })

  // Dates already loaded show straight away; the full history fills in once fetched.
  const fetched = useMenuDates(venue.id)
  // Days with dishes, and the next two weeks' days with a fixed menu (a brunch or bar list from the posted prices)
  const fixed = Array.from({ length: FIXED_MENU_DAYS }, (_, i) => addDaysISO(now.date, i)).filter((d) => servedMeals([], venue.slots, venue.prices, d).length)
  const dates = [...new Set([...(fetched ?? []), ...venue.menu.filter((d) => d.items.length).map((d) => d.date), ...fixed])].sort()
  const { days, failed } = useMenuOn(venue, date)
  // Never had a menu here: say where it is instead, once the history has confirmed it
  if (!dates.length && !asked)
    return (
      <div className="flex flex-col gap-8 md:flex-row md:items-start md:gap-10">
        <div className="md:w-72 md:shrink-0">{facts}</div>
        {fetched && <MissingMenu venue={venue} />}
      </div>
    )

  const dateSet = new Set(dates)
  // A build-time page can't know what "today" will be when it's read
  const relative = snapshot ? undefined : relativeDay(date, now.date)
  const dayMonth: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', ...(date.slice(0, 4) === now.date.slice(0, 4) ? {} : { year: 'numeric' }) }
  const calendar = <MenuCalendar value={date} today={now.date} dates={dateSet} onChange={(d) => (setDate(d), setCalendarOpen(false))} />

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,42rem)_16rem] md:justify-between md:gap-x-10 lg:grid-cols-[minmax(0,42rem)_18rem]">
      <aside className="space-y-8 md:sticky md:top-24 md:col-start-2 md:row-start-1 md:self-start">
        <div className="hidden md:block">{calendar}</div>
        {facts}
      </aside>
      <section className="min-w-0 md:col-start-1 md:row-start-1">
        <h2 className="sr-only">Menu</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCalendarOpen(!calendarOpen)}
            aria-expanded={calendarOpen}
            className="-ml-2 flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-ink/5 md:pointer-events-none md:cursor-auto"
          >
            <span className="min-w-0">
              <span className="block truncate text-xl font-medium">
                <span className="sm:hidden">{formatISODate(date, { weekday: 'short', ...dayMonth })}</span>
                <span className="hidden sm:inline">{formatISODate(date, { weekday: 'long', ...dayMonth })}</span>
              </span>
              {relative && <span className="block text-sm text-muted">{relative}</span>}
            </span>
            <span className="text-muted md:hidden">
              <Icon of={Calendar2} />
            </span>
          </button>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {date !== now.date && (
              <button type="button" onClick={() => setDate(now.date)} className="cursor-pointer rounded-md px-2 py-1 text-sm text-muted transition-colors hover:bg-ink/10 hover:text-ink">
                Today
              </button>
            )}
            <DayStepper value={date} dates={dates} onChange={setDate} />
          </div>
        </div>
        {calendarOpen && <div className="mt-4 md:hidden">{calendar}</div>}
        <div className="mt-6">
          {days && servedMeals(days, venue.slots, venue.prices, date).length ? (
            <DayMenu days={days} slots={venue.slots} date={date} prices={venue.prices} />
          ) : (
            <p className="text-sm text-muted">{failed ? "Couldn't load this menu" : days ? 'No menu published for this day' : 'Loading…'}</p>
          )}
        </div>
      </section>
    </div>
  )
}

const MEMBERS_WHERE: Partial<Record<Channel, string>> = { intranet: 'on the college intranet', app: 'in a college app', email: 'by email' }

/** Why a venue with a known menu source has no menu here, and how to help. */
function MissingMenu({ venue }: { venue: Venue }) {
  const status = menuGap(venue)
  if (!status || venue.menu_scripted) return null
  const site = venue.site.short_name ?? venue.site.name
  return (
    <div>
      <h2 className="mb-2 font-medium">No menu here yet</h2>
      <p className="text-sm text-muted">
        {status === 'members'
          ? `Posted for ${site} members only, ${MEMBERS_WHERE[venue.menu_channel!] ?? 'not online'}.`
          : status === 'online'
          ? 'Published, not here yet.'
          : 'Not published anywhere we know of.'}{' '}
        <Link to="/coverage" className="text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
          Help get it here
        </Link>
      </p>
      {status === 'online' && venue.menu_url && (
        <div className="mt-2">
          <ExternalLink href={venue.menu_url} />
        </div>
      )}
    </div>
  )
}
