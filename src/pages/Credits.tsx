import { Link } from 'react-router'
import { PhotoCredit, SiteThumb, VenueThumb } from '../components/VenuePhoto.tsx'
import { useReady } from '../lib/data.tsx'
import { sitePhoto, venuePhoto } from '../lib/photos.ts'
import { SITE_NAME, siteName, sitePath, venuePath } from '../lib/site.ts'

/** Who took each photo and under what licence: the credit every photo carries on its venue's page, all in one place. */
export function Credits() {
  const { sites, venues } = useReady()
  const shownSites = sites.filter((s) => sitePhoto(s)).sort((a, b) => siteName(a).localeCompare(siteName(b)))
  const shown = venues.filter((v) => venuePhoto(v)).sort((a, b) => siteName(a.site).localeCompare(siteName(b.site)) || a.name.localeCompare(b.name))
  return (
    <>
      <title>{`Photo credits · ${SITE_NAME}`}</title>
      <div className="max-w-2xl leading-relaxed">
        <h1 className="title text-4xl">Photo credits</h1>
        <p className="mt-4 text-muted">
          Most photos of sites and venues here are from Wikimedia Commons, shared by the people who took them under open licences; each is credited where it's shown,
          and all of them below. Where no photo of the room itself is free to use, it's the building or court the venue is in. Took a better one?{' '}
          <Link to="/send?kind=photo" className="link text-ink">
            Send it
          </Link>
          .
        </p>
      </div>
      {shownSites.length > 0 && (
        <>
          <h2 className="title mt-10 text-2xl">Colleges and sites</h2>
          <ul className="mt-4">
            {shownSites.map((s) => (
              <li key={s.slug} className="flex items-start gap-4 border-t border-ink/10 py-4">
                <SiteThumb site={s} className="size-16 rounded-lg" />
                <div className="min-w-0">
                  <Link to={sitePath(s)} className="link font-medium">
                    {siteName(s)}
                  </Link>
                  <p className="mt-0.5 text-sm text-muted">{sitePhoto(s)!.alt}</p>
                  <PhotoCredit photo={sitePhoto(s)!} className="mt-1" />
                </div>
              </li>
            ))}
          </ul>
          <h2 className="title mt-10 text-2xl">Venues</h2>
        </>
      )}
      {shown.length ? (
        <ul className={shownSites.length ? 'mt-4' : 'mt-10'}>
          {shown.map((v) => (
            <li key={v.id} className="flex items-start gap-4 border-t border-ink/10 py-4">
              <VenueThumb venue={v} className="size-16" />
              <div className="min-w-0">
                <Link to={venuePath(v)} className="link font-medium">
                  {v.site.short_name ?? v.site.name}, {v.name}
                </Link>
                <p className="mt-0.5 text-sm text-muted">{venuePhoto(v)!.alt}</p>
                <PhotoCredit photo={venuePhoto(v)!} className="mt-1" />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-muted">No photos yet.</p>
      )}
    </>
  )
}
