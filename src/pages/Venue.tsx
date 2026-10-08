import { useState } from 'react'
import { Calendar2, Card, ChefHat, Clock, Pin, Users } from 'reicon-react'
import { Link, useParams, useSearchParams } from 'react-router'
import { BackButton } from '../components/BackButton.tsx'
import { DayMenu } from '../components/DayMenu.tsx'
import { ExternalLink } from '../components/ExternalLink.tsx'
import { Icon } from '../components/Icon.tsx'
import { DayStepper, MenuCalendar } from '../components/MenuCalendar.tsx'
import { StatusText } from '../components/VenueCard.tsx'
import { useMenuDates, useMenuOn, useReady } from '../lib/data.tsx'
import { ACCESS_LABEL, MEAL_LABEL, MEALS, TYPE_LABEL, typeNote } from '../lib/filters.ts'
import { TYPE_ICON } from '../lib/icons.ts'
import { SITE_NAME } from '../lib/site.ts'
import { useNow } from '../lib/useNow.ts'
import { formatDays, formatISODate, isISODate, relativeDay, type LocalNow } from '../lib/time/clock.ts'
import { openStatus } from '../lib/time/openNow.ts'
import { isFullTerm } from '../lib/time/termDates.ts'
import { DAYS, type Venue } from '../lib/types.ts'
import { NotFound } from './NotFound.tsx'

export function VenuePage() {
  const params = useParams()
  const { venues } = useReady()
  const now = useNow()

  const venue = venues.find((v) => v.site.slug === params.site && v.slug === params.venue)
  if (!venue) return <NotFound />
  const site = venue.site.short_name ?? venue.site.name
  const status = openStatus(venue.slots, now)

  const term = isFullTerm(now.date)
  const slots = venue.slots
    .filter((s) => s.period === 'all' || s.period === (term ? 'term' : 'vacation'))
    .sort((a, b) => MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal) || DAYS.indexOf(a.days[0]) - DAYS.indexOf(b.days[0]))

  return (
    <>
      <title>{`${venue.name}, ${site} · ${SITE_NAME}`}</title>
      <BackButton up={`/${venue.site.slug}`} />
      <div className="mb-8">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">{venue.name}</h1>
          {venue.url && <ExternalLink href={venue.url} />}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/50">
          <Link to={`/${venue.site.slug}`} className="flex items-center gap-1.5 transition-colors hover:text-white">
            <Icon of={Pin} />
            {site}
          </Link>
          <span title={TYPE_LABEL[venue.type]} className="flex items-center gap-1.5">
            <Icon of={TYPE_ICON[venue.type]} />
            {typeNote(venue)}
          </span>
          {venue.access.level !== 'unknown' && (
            <span className="flex items-center gap-1.5">
              <Icon of={Users} />
              {ACCESS_LABEL[venue.access.level]}
            </span>
          )}
          {venue.payment.bank_card && (
            <span className="flex items-center gap-1.5">
              <Icon of={Card} />
              Bank card
            </span>
          )}
          <span className="ml-auto">
            <StatusText s={status} now={now} />
          </span>
        </div>
      </div>

      <section className="border-t border-white/10 py-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm text-white/40">
          <Icon of={Clock} />
          Hours
        </h2>
        {slots.length ? (
          <table className="w-full text-sm text-white/60 tabular-nums">
            <tbody>
              {slots.map((s, i) => (
                <tr key={i}>
                  <td className="py-0.5 pr-4">{MEAL_LABEL[s.meal]}</td>
                  <td className="py-0.5 pr-4">{formatDays(s.days)}</td>
                  <td className="py-0.5 text-right">
                    {s.start}–{s.end}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-white/40">Hours not published</p>
        )}
      </section>

      <MenuSection key={venue.id} venue={venue} now={now} />
    </>
  )
}

/** The menu for one date (?date=, default today), with a calendar of every date that has one. */
function MenuSection({ venue, now }: { venue: Venue; now: LocalNow }) {
  const [params, setParams] = useSearchParams()
  const [calendarOpen, setCalendarOpen] = useState(false)
  const asked = params.get('date') ?? ''
  const date = isISODate(asked) ? asked : now.date
  const setDate = (d: string) => setParams(d === now.date ? {} : { date: d }, { replace: true })

  // Dates already loaded show straight away; the full history fills in once fetched.
  const fetched = useMenuDates(venue.id)
  const dates = [...new Set([...(fetched ?? []), ...venue.menu.filter((d) => d.items.length).map((d) => d.date)])].sort()
  const { days, failed } = useMenuOn(venue, date)
  if (!dates.length && !asked) return null

  const dateSet = new Set(dates)
  const relative = relativeDay(date, now.date)
  const dayMonth: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', ...(date.slice(0, 4) === now.date.slice(0, 4) ? {} : { year: 'numeric' }) }
  const calendar = <MenuCalendar value={date} today={now.date} dates={dateSet} onChange={(d) => (setDate(d), setCalendarOpen(false))} />

  return (
    <section className="border-t border-white/10 py-8">
      <h2 className="mb-4 flex items-center gap-2 text-sm text-white/40">
        <Icon of={ChefHat} />
        Menu
      </h2>
      <div className="sm:grid sm:grid-cols-[14rem_1fr] sm:gap-10">
        <div className="hidden sm:block">
          <div className="sticky top-24">{calendar}</div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCalendarOpen(!calendarOpen)}
              aria-expanded={calendarOpen}
              className="-ml-2 flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-white/5 sm:pointer-events-none sm:cursor-auto"
            >
              <span className="min-w-0">
                <span className="block truncate text-xl font-medium">
                  <span className="sm:hidden">{formatISODate(date, { weekday: 'short', ...dayMonth })}</span>
                  <span className="hidden sm:inline">{formatISODate(date, { weekday: 'long', ...dayMonth })}</span>
                </span>
                {relative && <span className="block text-sm text-white/50">{relative}</span>}
              </span>
              <span className="text-white/50 sm:hidden">
                <Icon of={Calendar2} />
              </span>
            </button>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {date !== now.date && (
                <button type="button" onClick={() => setDate(now.date)} className="cursor-pointer rounded-md px-2 py-1 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white">
                  Today
                </button>
              )}
              <DayStepper value={date} dates={dates} onChange={setDate} />
            </div>
          </div>
          {calendarOpen && <div className="mt-4 sm:hidden">{calendar}</div>}
          <div className="mt-6">
            {days?.some((d) => d.items.length) ? (
              <DayMenu days={days} slots={venue.slots} date={date} />
            ) : (
              <p className="text-sm text-white/40">{failed ? "Couldn't load this menu" : days ? 'No menu published for this day' : 'Loading…'}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
