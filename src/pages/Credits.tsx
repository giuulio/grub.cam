import { Link } from 'react-router'
import { PhotoCredit, VenueThumb } from '../components/VenuePhoto.tsx'
import { useReady } from '../lib/data.tsx'
import { venuePhoto } from '../lib/photos.ts'
import { ISSUES_URL, SITE_NAME, venuePath } from '../lib/site.ts'

/** Who took each photo and under what licence: the credit every photo carries on its venue's page, all in one place. */
export function Credits() {
  const { venues } = useReady()
  const shown = venues.filter((v) => venuePhoto(v)).sort((a, b) => (a.site.short_name ?? a.site.name).localeCompare(b.site.short_name ?? b.site.name) || a.name.localeCompare(b.name))
  return (
    <>
      <title>{`Photo credits · ${SITE_NAME}`}</title>
      <div className="max-w-2xl leading-relaxed">
        <h1 className="title text-4xl">Photo credits</h1>
        <p className="mt-4 text-muted">
          Most photos of venues here are from Wikimedia Commons, shared by the people who took them under open licences; each is credited where it's shown,
          and all of them below. Where no photo of the room itself is free to use, it's the building or court the venue is in. Took a better one?{' '}
          <a href={ISSUES_URL} target="_blank" rel="noopener" className="link text-ink">
            Send it
          </a>
          .
        </p>
      </div>
      {shown.length ? (
        <ul className="mt-10 grid gap-x-10 lg:grid-cols-2">
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
