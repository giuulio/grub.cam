import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { StatusText } from '../components/VenueCard.tsx'
import { useReady } from '../lib/data.tsx'
import { ACCESS_LABEL, MEAL_LABEL, MEALS, serviceDate, typeNote } from '../lib/filters.ts'
import { SITE_NAME } from '../lib/site.ts'
import { useNow } from '../lib/useNow.ts'
import { formatDays, formatISODate } from '../lib/time/clock.ts'
import { openStatus } from '../lib/time/openNow.ts'
import { isFullTerm } from '../lib/time/termDates.ts'
import { DAYS } from '../lib/types.ts'
import { NotFound } from './NotFound.tsx'

export function VenuePage() {
  const params = useParams()
  const { venues } = useReady()
  const now = useNow()
  const [picked, setPicked] = useState<string>()

  const venue = venues.find((v) => v.college.slug === params.college && v.slug === params.venue)
  if (!venue) return <NotFound />
  const college = venue.college.short_name ?? venue.college.name
  const status = openStatus(venue.slots, now)

  const term = isFullTerm(now.date)
  const slots = venue.slots
    .filter((s) => s.period === 'all' || s.period === (term ? 'term' : 'vacation'))
    .sort((a, b) => MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal) || DAYS.indexOf(a.days[0]) - DAYS.indexOf(b.days[0]))

  // Menu dates from today on; opens on the day of the next service.
  const dates = [...new Set(venue.menu.filter((d) => d.items.length).map((d) => d.date))].filter((d) => d >= now.date).sort()
  const next = serviceDate(status)
  const date = picked && dates.includes(picked) ? picked : next && dates.includes(next) ? next : dates[0]
  const menu = venue.menu.filter((d) => d.date === date && d.items.length).sort((a, b) => MEALS.indexOf(a.service) - MEALS.indexOf(b.service))

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

      {date && (
        <section className="border-t border-white/10 py-8">
          <h2 className="mb-3 text-sm text-white/40">Menu</h2>
          {dates.length > 1 && (
            <div role="group" aria-label="Menu day" className="flex max-w-full overflow-x-auto rounded-lg border border-white/10 p-1 text-sm scrollbar-none sm:inline-flex">
              {dates.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={d === date}
                  onClick={() => setPicked(d)}
                  className={`shrink-0 cursor-pointer rounded-md px-3 py-1.5 transition-colors ${d === date ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'}`}
                >
                  {formatISODate(d, { weekday: 'short' })}
                </button>
              ))}
            </div>
          )}
          {menu.map((d) => (
            <div key={d.service} className="mt-6 text-sm leading-relaxed">
              <h3 className="mb-1 text-white/40">{MEAL_LABEL[d.service]}</h3>
              <ul className="text-white/70">
                {d.items.map((item, i) => (
                  <li key={i}>{item.name}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </>
  )
}
