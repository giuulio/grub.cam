import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { DAYS, type VenueView } from '../lib/data/types.ts'
import { useReady } from '../lib/data/useData.tsx'
import { ACCESS_LABEL, MEAL_LABEL, MEALS } from '../lib/filters.ts'
import { SITE_NAME } from '../lib/site.ts'
import { useNow } from '../lib/useNow.ts'
import { formatDays, formatISODate, type LocalNow } from '../lib/time/clock.ts'
import { openStatus } from '../lib/time/openNow.ts'
import { isFullTerm } from '../lib/time/termDates.ts'
import { NotFound } from './NotFound.tsx'

export function College() {
  const { slug } = useParams()
  const { bundle, venues } = useReady()
  const now = useNow()
  const [picked, setPicked] = useState<string>()
  const { hash } = useLocation()

  // Search results link to /:slug#venue; React Router doesn't scroll to hashes itself.
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView()
  }, [hash])

  const college = bundle.colleges.find((c) => c.slug === slug)
  if (!college) return <NotFound />
  const mine = venues.filter((v) => v.college.slug === college.slug)

  // Menu dates from today on; past days of the week aren't shown.
  const dates = [...new Set(mine.flatMap((v) => v.menu?.days.map((d) => d.date) ?? []))].filter((d) => d >= now.date).sort()
  const date = picked && dates.includes(picked) ? picked : dates[0]

  return (
    <>
      <title>{`${college.short_name ?? college.name} · ${SITE_NAME}`}</title>
      <Link to="/" className="mb-6 inline-block text-sm text-white/50 transition-colors hover:text-white">
        ← Search
      </Link>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">{college.name}</h1>
        {college.official_dining_url && (
          <a href={college.official_dining_url} target="_blank" rel="noopener" className="text-sm text-white/50 transition-colors hover:text-white">
            {new URL(college.official_dining_url).hostname.replace(/^www\./, '')} ↗
          </a>
        )}
      </div>

      {dates.length > 1 && (
        <div role="group" aria-label="Menu day" className="mb-8 inline-flex rounded-lg border border-white/10 p-1 text-sm">
          {dates.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={d === date}
              onClick={() => setPicked(d)}
              className={`cursor-pointer rounded-md px-3 py-1.5 transition-colors ${d === date ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'}`}
            >
              {formatISODate(d, { weekday: 'short' })}
            </button>
          ))}
        </div>
      )}

      <div className="divide-y divide-white/10 border-t border-white/10">
        {mine.map((v) => (
          <VenueSection key={v.id} venue={v} now={now} date={date} />
        ))}
      </div>
    </>
  )
}

function VenueSection({ venue, now, date }: { venue: VenueView; now: LocalNow; date?: string }) {
  const open = openStatus(venue.slots, now).kind === 'open'
  const term = isFullTerm(now.date)
  const slots = venue.slots
    .filter((s) => s.period === 'all' || s.period === (term ? 'term' : 'vacation'))
    .sort((a, b) => MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal) || DAYS.indexOf(a.days[0]) - DAYS.indexOf(b.days[0]))
  const menu = date ? (venue.menu?.days.filter((d) => d.date === date && d.items.length) ?? []) : []
  menu.sort((a, b) => MEALS.indexOf(a.service) - MEALS.indexOf(b.service))
  const meta = [venue.access.level !== 'unknown' && ACCESS_LABEL[venue.access.level], venue.payment.bank_card && 'Bank card'].filter(Boolean).join(' · ')

  return (
    <section id={venue.slug} className="scroll-mt-20 py-8">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className={`text-lg font-medium ${open ? 'text-white' : 'text-white/60'}`}>{venue.name}</h2>
        {meta && <span className="ml-auto text-sm text-white/40">{meta}</span>}
      </div>

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
  )
}
