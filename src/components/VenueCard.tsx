import { Link } from 'react-router'
import { useReady } from '../lib/data.tsx'
import { ACCESS_LABEL, TYPE_LABEL } from '../lib/filters.ts'
import { TYPE_ICON } from '../lib/icons.ts'
import { venuePath } from '../lib/site.ts'
import { dayOfISO, dayLabel, type LocalNow } from '../lib/time/clock.ts'
import type { OpenStatus } from '../lib/time/openNow.ts'
import { isFormalOnly, type Venue } from '../lib/types.ts'
import { Icon } from './Icon.tsx'

/** One venue in a list, linking to its page; the icon says what kind of place it is. Search leads with the site (college, West Cambridge, ...); a site page with the venue. */
export function VenueCard({ venue, status, now, dishes = [], showSite = true, date, showAccess = false }: { venue: Venue; status: OpenStatus; now: LocalNow; dishes?: string[]; showSite?: boolean; date?: string; showAccess?: boolean }) {
  return (
    <li>
      <Link to={`${venuePath(venue)}${date ? `?date=${date}` : ''}`} className="-mx-3 flex items-start gap-3 rounded-md px-3 py-4 transition-colors hover:bg-ink/5">
        <span className="mt-0.5 text-muted">
          <Icon of={TYPE_ICON[venue.type]} className="size-5" />
          <span className="sr-only">{TYPE_LABEL[venue.type]}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="min-w-0">
            {showSite ? (
              <>
                <span className="block truncate font-medium sm:inline">{venue.site.short_name ?? venue.site.name}</span>
                {venue.name !== (venue.site.short_name ?? venue.site.name) && <span className="block truncate text-sm text-muted sm:ml-2 sm:inline">{venue.name}</span>}
              </>
            ) : (
              <span className="font-medium">{venue.name}</span>
            )}
          </p>
          {dishes.length > 0 && <p className="mt-1 truncate text-sm text-muted">{dishes.slice(0, 3).join(' · ')}</p>}
          {showAccess && <AccessLine venue={venue} />}
        </div>
        <StatusText s={status} now={now} />
      </Link>
    </li>
  )
}

/** Who can go, when known, and that formal hall is booked where it's all a Hall holds. */
function AccessLine({ venue }: { venue: Venue }) {
  const parts = [venue.access.level !== 'unknown' && ACCESS_LABEL[venue.access.level], isFormalOnly(venue) && 'Formal hall, booking required'].filter(Boolean)
  return parts.length ? <p className="mt-1 text-xs text-muted">{parts.join(' · ')}</p> : null
}

export function StatusText({ s, now }: { s: OpenStatus; now: LocalNow }) {
  // Prerendered pages cannot know which service will be current when read.
  if (useReady().snapshot) return null
  const cls = 'shrink-0 text-right text-xs whitespace-nowrap tabular-nums sm:text-sm'
  switch (s.kind) {
    case 'open':
      return <span className={`${cls} text-ink`} aria-label={`Open, ${s.slot.start} to ${s.slot.end}`}>{s.slot.start}–{s.slot.end}</span>
    case 'opening':
      return <span className={`${cls} text-muted`}>{s.slot.start}–{s.slot.end}</span>
    case 'closed':
      if (!s.next) return null
      return (
        <span className={`${cls} text-muted`}>
          {s.next.date !== now.date && <span className="block text-xs">{dayLabel(dayOfISO(s.next.date))}</span>}
          {s.next.slot.start}–{s.next.slot.end}
        </span>
      )
    case 'unknown':
      return null
  }
}
