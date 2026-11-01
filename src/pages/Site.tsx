import { useState } from 'react'
import { Navigate, useLocation, useParams } from 'react-router'
import { ExternalLink } from '../components/ExternalLink.tsx'
import { VenueRow } from '../components/Listing.tsx'
import { VenueMap } from '../components/VenueMap.tsx'
import { SiteBanner } from '../components/VenuePhoto.tsx'
import { useReady } from '../lib/data.tsx'
import { applyFilters, DEFAULT_FILTERS, TYPES } from '../lib/filters.ts'
import { hasLocation } from '../lib/finder.ts'
import { siteName, venuePath } from '../lib/site.ts'
import { siteTitle } from '../lib/seo.ts'
import { useNow } from '../lib/useNow.ts'
import { NotFound } from './NotFound.tsx'

/**
 * A college or University site (West Cambridge, Sidgwick, ...), laid out as a venue's page: its photo across the top,
 * its name, how many venues it has and its website, then its venues as the front page's rows; beside them, a square map
 * of its venues in a rail that stays in view (after the list on a phone). A pin marks its row; the row under the
 * pointer picks out its pin.
 */
export function SitePage() {
  const { slug } = useParams()
  const { hash } = useLocation()
  const { sites, venues, snapshot } = useReady()
  const now = useNow()
  // The venue whose pin was picked (its row is marked), and the row under the pointer (its pin is picked out)
  const [selected, setSelected] = useState<string>()
  const [hover, setHover] = useState<string>()

  const site = sites.find((s) => s.slug === slug)
  if (!site) return <NotFound />
  const mine = venues.filter((v) => v.site.slug === site.slug)

  // Links used to point at /:slug#venue
  const linked = hash && mine.find((v) => v.slug === decodeURIComponent(hash.slice(1)))
  if (linked) return <Navigate to={venuePath(linked)} replace />

  // Dining, cafés, bars; in the site's own order within each, so the list doesn't reshuffle as venues open and close.
  // Today's menus only: a row names the meal, not the day.
  const rows = applyFilters(mine, { ...DEFAULT_FILTERS, date: now.date, exactDate: true }, now).sort(
    (a, b) => TYPES.indexOf(a.venue.type) - TYPES.indexOf(b.venue.type) || mine.indexOf(a.venue) - mine.indexOf(b.venue),
  )
  const pick = (id?: string) => {
    setSelected(id)
    if (id) requestAnimationFrame(() => document.getElementById(`venue-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
  }

  return (
    <>
      <title>{siteTitle(site, mine)}</title>
      <SiteBanner site={site} />
      <div className="grid gap-y-10 md:grid-cols-[minmax(0,1fr)_17rem] md:gap-x-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-x-16">
        <div className="min-w-0">
          <h1 className="title text-4xl leading-[1.1] sm:text-5xl">{siteName(site)}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-muted">
            <span className="text-ink">{`${mine.length} ${mine.length === 1 ? 'venue' : 'venues'}`}</span>
            {site.official_dining_url && <ExternalLink href={site.official_dining_url} className="" />}
          </div>
          <section aria-label={`${siteName(site)} venues`} className="mt-8">
            <ul className="space-y-3">
              {rows.map((r) => <VenueRow key={r.venue.id} r={r} now={now} showSite={false} selected={r.venue.id === selected} onHover={setHover} />)}
            </ul>
          </section>
        </div>
        {mine.some(hasLocation) && (
          <aside aria-label={`Map of ${siteName(site)}’s venues`} className="min-w-0 md:sticky md:top-[calc(var(--header-h,0px)+1.5rem)] md:self-start">
            <div className="rail-map relative isolate overflow-hidden rounded-xl border border-ink/12">
              {snapshot ? (
                <div className="venue-map" />
              ) : (
                <VenueMap results={rows} selected={selected} highlight={hover ? [hover] : undefined} onSelect={pick} onBackground={() => pick(undefined)} filtered maxZoom={17} embedded controls={false} />
              )}
            </div>
          </aside>
        )}
      </div>
    </>
  )
}
