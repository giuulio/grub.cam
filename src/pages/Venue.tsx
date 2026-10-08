import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { DayMenu } from '../components/DayMenu.tsx'
import { DayStepper, MenuCalendar } from '../components/MenuCalendar.tsx'
import { StatusText } from '../components/VenueCard.tsx'
import { useMenuDates, useMenuOn, useReady } from '../lib/data.tsx'
import { ACCESS_LABEL, MEAL_LABEL, MEALS, typeNote } from '../lib/filters.ts'
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

  const venue = venues.find((v) => v.college.slug === params.college && v.slug === params.venue)
  if (!venue) return <NotFound />
  const college = venue.college.short_name ?? venue.college.name
  const status = openStatus(venue.slots, now)

  const term = isFullTerm(now.date)
  const slots = venue.slots
    .filter((s) => s.period === 'all' || s.period === (term ? 'term' : 'vacation'))
    .sort((a, b) => MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal) || DAYS.indexOf(a.days[0]) - DAYS.indexOf(b.days[0]))

  const meta = [typeNote(venue), venue.access.level !== 'unknown' && ACCESS_LABEL[venue.access.level], venue.payment.bank_card && 'Bank card'].filter(Boolean).join(' · ')

  return (
    <>
      <title>{`${venue.name}, ${college} · ${SITE_NAME}`}</title>
      <Link to={`/${venue.college.slug}`} className="mb-6 inline-block text-sm text-white/50 transition-colors hover:text-white">
        ← {college}
      </Link>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{venue.name}</h1>
        <p className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm text-white/50">
          <span>{meta}</span>
          <StatusText s={status} now={now} />
        </p>
      </div>

      <section className="border-t border-white/10 py-8">
        <h2 className="mb-3 text-sm text-white/40">Hours</h2>
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
      <h2 className="mb-4 text-sm text-white/40">Menu</h2>
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
              <CalendarIcon className="size-4 shrink-0 text-white/50 sm:hidden" />
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

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className={className}>
      <rect x="2" y="3" width="12" height="11" rx="2" />
      <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" strokeLinecap="round" />
    </svg>
  )
}
