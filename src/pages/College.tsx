import { Link, Navigate, useLocation, useParams } from 'react-router'
import { VenueCard } from '../components/VenueCard.tsx'
import { useReady } from '../lib/data.tsx'
import { applyFilters, DEFAULT_FILTERS, nextService, TYPES } from '../lib/filters.ts'
import { SITE_NAME, venuePath } from '../lib/site.ts'
import { useNow } from '../lib/useNow.ts'
import { NotFound } from './NotFound.tsx'

export function College() {
  const { slug } = useParams()
  const { hash } = useLocation()
  const { colleges, venues } = useReady()
  const now = useNow()

  const college = colleges.find((c) => c.slug === slug)
  if (!college) return <NotFound />
  const mine = venues.filter((v) => v.college.slug === college.slug)

  // Links used to point at /:slug#venue
  const linked = hash && mine.find((v) => v.slug === decodeURIComponent(hash.slice(1)))
  if (linked) return <Navigate to={venuePath(linked)} replace />

  // Halls, cafés, bars; in the college's own order within each, so the list doesn't reshuffle as places open and close.
  const rows = applyFilters(mine, { ...DEFAULT_FILTERS, date: now.date }, now).sort(
    (a, b) => TYPES.indexOf(a.venue.type) - TYPES.indexOf(b.venue.type) || mine.indexOf(a.venue) - mine.indexOf(b.venue),
  )

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

      <ul className="divide-y divide-white/10 border-t border-white/10">
        {rows.map((r) => (
          <VenueCard key={r.venue.id} venue={r.venue} status={r.status} now={now} dishes={nextService(r)?.items.map((i) => i.name)} showCollege={false} />
        ))}
      </ul>
    </>
  )
}
