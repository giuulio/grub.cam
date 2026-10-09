import { useEffect, useRef, type Ref } from 'react'
import { Link } from 'react-router'
import { Xmark } from 'reicon-react'
import { useReady } from '../lib/data.tsx'
import { hasLocation } from '../lib/explore.ts'
import { ACCESS_LABEL, TYPE_LABEL, type Ranked } from '../lib/filters.ts'
import { venuePhoto } from '../lib/photos.ts'
import { venuePath } from '../lib/site.ts'
import { formatISODate, type LocalNow } from '../lib/time/clock.ts'
import type { OpenStatus } from '../lib/time/openNow.ts'
import { isFormalOnly, venueTypes, type Venue } from '../lib/types.ts'
import { useNow } from '../lib/useNow.ts'
import { Icon } from './Icon.tsx'
import { Status } from './Status.tsx'
import { PhotoCredit, TypeMark, VenueImage, VenueThumb } from './VenuePhoto.tsx'

const siteOf = (v: Venue) => v.site.short_name ?? v.site.name

/**
 * One venue in a list, linking to its page: its photo (or its type's tile), its name, whether it's open, and the
 * dishes that matched. Search leads with the site (college, West Cambridge, ...), since many venues share a name
 * (Buttery, Servery); a site page with the venue alone.
 */
export function VenueCard({ venue, status, now, dishes = [], showSite = true, date, showAccess = false }: { venue: Venue; status: OpenStatus; now: LocalNow; dishes?: string[]; showSite?: boolean; date?: string; showAccess?: boolean }) {
  const site = siteOf(venue)
  return (
    <li className="border-t border-ink/10">
      <Link to={`${venuePath(venue)}${date ? `?date=${date}` : ''}`} className="-mx-3 flex items-start gap-4 rounded-lg px-3 py-3.5 transition-colors hover:bg-ink/4">
        <VenueThumb venue={venue} className="size-14 sm:size-16" />
        <div className="min-w-0 flex-1">
          <p className="title truncate text-lg leading-snug">{showSite ? site : venue.name}</p>
          {showSite && venue.name !== site && <p className="truncate text-sm text-muted">{venue.name}</p>}
          <p className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
            <span className="sr-only">{TYPE_LABEL[venue.type]}</span>
            <Status s={status} now={now} />
            {showAccess && <AccessLine venue={venue} />}
          </p>
          {dishes.length > 0 && <p className="mt-1.5 truncate text-sm text-muted">{dishes.slice(0, 3).join(' · ')}</p>}
        </div>
      </Link>
    </li>
  )
}

/** Who can go, when known, and that formal hall is booked where it's all a Hall holds. */
function AccessLine({ venue }: { venue: Venue }) {
  const parts = [venue.access.level !== 'unknown' && ACCESS_LABEL[venue.access.level], isFormalOnly(venue) && 'Formal hall, booking required'].filter(Boolean)
  return parts.length ? <span className="text-muted">{parts.join(', ')}</span> : null
}

/**
 * The place picked on the map, as Google Maps shows one: down the map's left side on a wide screen, a sheet from the
 * bottom on a phone. Its photo, name, types, whether it's open, the dishes that matched on the menu date, its page,
 * and the other places in the same building.
 */
export function VenuePanel({ r, dishes, date, results, formalSelected, onSelect, onClose, ref }: { r: Ranked; dishes: string[]; date: string; results: Ranked[]; formalSelected: boolean; onSelect: (id: string) => void; onClose: () => void; ref?: Ref<HTMLDivElement> }) {
  const { snapshot } = useReady()
  const v = r.venue
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => { close.current?.focus({ preventScroll: true }) }, [v.id])
  // Places in the same building (same point), whose pins sit beside this one
  const others = results.filter((o) => o.venue.id !== v.id && hasLocation(v) && hasLocation(o.venue) && v.latitude === o.venue.latitude && v.longitude === o.venue.longitude)
  const slot = r.status.kind === 'open' || r.status.kind === 'opening' ? r.status.slot : r.status.kind === 'closed' ? r.status.next?.slot : undefined
  const photo = venuePhoto(v)
  const now = useNow()
  return (
    <div ref={ref} aria-label="Selected place" className="selected-place raised absolute inset-x-0 bottom-0 z-600 max-h-[62%] overflow-y-auto rounded-t-xl text-ink sm:inset-x-auto sm:top-3 sm:bottom-auto sm:left-3 sm:max-h-[calc(100%-1.5rem)] sm:w-(--panel-w) sm:rounded-xl">
      <button ref={close} type="button" aria-label="Close selected place" title="Close" onClick={onClose} className="raised absolute top-3 right-3 z-10 flex size-9 cursor-pointer items-center justify-center rounded-lg text-ink">
        <Icon of={Xmark} className="size-4.5" />
      </button>
      <VenueImage venue={v} sizes="(min-width: 640px) 22rem, 100vw" icon="size-10" className="block aspect-5/2 w-full sm:aspect-video" />
      <div className="p-5 pt-4">
        <p className="pr-12 text-sm text-muted">{siteOf(v)}</p>
        <h2 className="title mt-0.5 pr-12 text-2xl leading-tight">{v.name}</h2>
        <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
          {venueTypes(v).map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <TypeMark type={t} className="size-4.5" label />
              {TYPE_LABEL[t]}
            </span>
          ))}
          {v.access.level !== 'unknown' && <span className="text-muted">{ACCESS_LABEL[v.access.level]}</span>}
        </p>
        {!snapshot && (
          <p className="mt-3">
            <Status s={r.status} now={now} meal={new Set(v.slots.map((s) => s.meal)).size > 1} />
          </p>
        )}
        {(formalSelected || slot?.meal === 'formal' || isFormalOnly(v)) && <p className="mt-1.5 text-sm text-muted">Formal hall is booked ahead.</p>}
        {dishes.length > 0 && (
          <div className="mt-5 border-t border-ink/10 pt-4">
            <h3 className="text-sm font-semibold">On the menu {formatISODate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {dishes.slice(0, 6).map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </div>
        )}
        <Link to={`${venuePath(v)}?date=${date}`} className="btn btn-primary mt-5">Menu and hours</Link>
        {others.length > 0 && (
          <div className="mt-5 border-t border-ink/10 pt-4">
            <h3 className="text-sm font-semibold">Also in this building</h3>
            <ul className="mt-1">
              {others.map((o) => (
                <li key={o.venue.id}>
                  <button type="button" onClick={() => onSelect(o.venue.id)} className="flex min-h-11 w-full cursor-pointer items-center gap-3 text-left text-sm hover:underline">
                    <TypeMark type={o.venue.type} className="size-4.5" />
                    {o.venue.site.slug !== v.site.slug ? `${siteOf(o.venue)}, ` : ''}{o.venue.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {photo && <PhotoCredit photo={photo} className="mt-5" />}
      </div>
    </div>
  )
}
