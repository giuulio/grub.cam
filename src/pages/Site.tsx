import { useState } from 'react'
import { Navigate, useLocation, useParams } from 'react-router'
import { ExternalLink } from '../components/ExternalLink.tsx'
import { Breadcrumbs, ListHeading, ListWithMap, VenueListing } from '../components/Listing.tsx'
import { useReady } from '../lib/data.tsx'
import { applyFilters, DEFAULT_FILTERS, TYPES } from '../lib/filters.ts'
import { SITE_NAME, siteName, sitePath, venuePath } from '../lib/site.ts'
import { useNow } from '../lib/useNow.ts'
import { NotFound } from './NotFound.tsx'

/** A college or University site (West Cambridge, Sidgwick, ...): its venues as TheFork lists restaurants, a card each beside the map. */
export function SitePage() {
  const { slug } = useParams()
  const { hash } = useLocation()
  const { sites, venues } = useReady()
  const now = useNow()
  // The venue under the pointer, picked out on the map
  const [hover, setHover] = useState<string>()

  const site = sites.find((s) => s.slug === slug)
  if (!site) return <NotFound />
  const mine = venues.filter((v) => v.site.slug === site.slug)

  // Links used to point at /:slug#venue
  const linked = hash && mine.find((v) => v.slug === decodeURIComponent(hash.slice(1)))
  if (linked) return <Navigate to={venuePath(linked)} replace />

  // Dining, cafés, bars; in the site's own order within each, so the list doesn't reshuffle as venues open and close.
  // Today's menus only: a card names the meal, not the day.
  const rows = applyFilters(mine, { ...DEFAULT_FILTERS, date: now.date, exactDate: true }, now).sort(
    (a, b) => TYPES.indexOf(a.venue.type) - TYPES.indexOf(b.venue.type) || mine.indexOf(a.venue) - mine.indexOf(b.venue),
  )

  return (
    <>
      <title>{`${siteName(site)}: hours and menus · ${SITE_NAME}`}</title>
      <Breadcrumbs trail={[[`/directory?kind=${site.kind}`, 'Directory'], [sitePath(site), siteName(site)]]} />
      <ListHeading title={siteName(site)} count={`${mine.length} ${mine.length === 1 ? 'venue' : 'venues'}`}>
        {site.official_dining_url && <ExternalLink href={site.official_dining_url} />}
      </ListHeading>
      <div className="mt-6 border-t border-ink/10 pt-6">
        <ListWithMap results={rows} highlight={hover ? [hover] : undefined} list={rows.map((r) => <VenueListing key={r.venue.id} r={r} now={now} onHover={setHover} />)} />
      </div>
    </>
  )
}
