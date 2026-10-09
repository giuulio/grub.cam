import { Navigate, useLocation, useParams } from 'react-router'
import { BackButton } from '../components/BackButton.tsx'
import { ExternalLink } from '../components/ExternalLink.tsx'
import { VenueCard } from '../components/VenueCard.tsx'
import { useReady } from '../lib/data.tsx'
import { applyFilters, DEFAULT_FILTERS, nextService, TYPES } from '../lib/filters.ts'
import { SITE_NAME, siteName, venuePath } from '../lib/site.ts'
import { useNow } from '../lib/useNow.ts'
import { NotFound } from './NotFound.tsx'

/** A college or University site (West Cambridge, Sidgwick, ...) and its venues. */
export function SitePage() {
  const { slug } = useParams()
  const { hash } = useLocation()
  const { sites, venues } = useReady()
  const now = useNow()

  const site = sites.find((s) => s.slug === slug)
  if (!site) return <NotFound />
  const mine = venues.filter((v) => v.site.slug === site.slug)

  // Links used to point at /:slug#venue
  const linked = hash && mine.find((v) => v.slug === decodeURIComponent(hash.slice(1)))
  if (linked) return <Navigate to={venuePath(linked)} replace />

  // Dining, cafés, bars; in the site's own order within each, so the list doesn't reshuffle as venues open and close.
  const rows = applyFilters(mine, { ...DEFAULT_FILTERS, date: now.date }, now).sort(
    (a, b) => TYPES.indexOf(a.venue.type) - TYPES.indexOf(b.venue.type) || mine.indexOf(a.venue) - mine.indexOf(b.venue),
  )

  return (
    <>
      <title>{`${siteName(site)}: hours and menus · ${SITE_NAME}`}</title>
      <BackButton up={`/directory?kind=${site.kind}`} />
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className="title text-4xl leading-tight sm:text-5xl">{siteName(site)}</h1>
        {site.official_dining_url && <ExternalLink href={site.official_dining_url} />}
      </div>

      <ul className="grid gap-x-10 lg:grid-cols-2">
        {rows.map((r) => (
          <VenueCard key={r.venue.id} venue={r.venue} status={r.status} now={now} dishes={nextService(r)?.items.map((i) => i.name)} showSite={false} />
        ))}
      </ul>
    </>
  )
}
