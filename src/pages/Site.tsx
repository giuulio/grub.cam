import { useState } from 'react'
import { Navigate, useLocation, useParams } from 'react-router'
import { ExternalLink } from '../components/ExternalLink.tsx'
import { Breadcrumbs, VenueRow } from '../components/Listing.tsx'
import { VenueMap } from '../components/VenueMap.tsx'
import { SiteBanner } from '../components/VenuePhoto.tsx'
import { useReady } from '../lib/data.tsx'
import { applyFilters, DEFAULT_FILTERS, TYPES } from '../lib/filters.ts'
import { SITE_NAME, siteName, sitePath, venuePath } from '../lib/site.ts'
import { useMedia } from '../lib/useMedia.ts'
import { useNow } from '../lib/useNow.ts'
import { NotFound } from './NotFound.tsx'

/**
 * A college or University site (West Cambridge, Sidgwick, ...): the front page narrowed to it, laid out the same way.
 * Down the left, scrolling on their own, its photo, its name and how many venues it has, then its venues as the front
 * page's rows; beside them, the map of its venues, zoomed to them. On a phone, the list alone.
 */
export function SitePage() {
  const { slug } = useParams()
  const { hash } = useLocation()
  const { sites, venues, snapshot } = useReady()
  const now = useNow()
  // Beside the list from a tablet up; the map is only made where it's shown
  const split = useMedia('(min-width: 768px)')
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
      <title>{`${siteName(site)}: hours and menus · ${SITE_NAME}`}</title>
      <div className="finder is-list">
        <div className="finder-side max-md:pt-6">
          <Breadcrumbs trail={[[sitePath(site), siteName(site)]]} />
          <SiteBanner site={site} />
          <h1 className="finder-title title text-3xl leading-[1.1] md:text-[2.5rem]">{siteName(site)}</h1>
          <section aria-label={`${siteName(site)} venues`} className="finder-list">
            <p className="py-1 text-[15px] font-medium">{`${mine.length} ${mine.length === 1 ? 'venue' : 'venues'}`}</p>
            {site.official_dining_url && (
              <p className="text-muted">
                <ExternalLink href={site.official_dining_url} />
              </p>
            )}
            <ul className="mt-3 space-y-3">
              {rows.map((r) => <VenueRow key={r.venue.id} r={r} now={now} showSite={false} selected={r.venue.id === selected} onHover={setHover} />)}
            </ul>
          </section>
        </div>
        <div className="finder-map">
          {split && !snapshot ? (
            <VenueMap results={rows} selected={selected} highlight={hover ? [hover] : undefined} onSelect={pick} onBackground={() => pick(undefined)} filtered maxZoom={17} controls={false} />
          ) : (
            <div className="venue-map" />
          )}
        </div>
      </div>
    </>
  )
}
