import { Link } from 'react-router'
import { typeNote } from '../lib/filters.ts'
import { venuePath } from '../lib/site.ts'
import { dayOfISO, dayLabel, type LocalNow } from '../lib/time/clock.ts'
import type { OpenStatus } from '../lib/time/openNow.ts'
import type { Venue } from '../lib/types.ts'

/** One venue in a list, linking to its page. Search leads with the college; a college page leads with the venue. */
export function VenueCard({ venue, status, now, dishes = [], showCollege = true }: { venue: Venue; status: OpenStatus; now: LocalNow; dishes?: string[]; showCollege?: boolean }) {
  const type = typeNote(venue)
  return (
    <li>
      <Link to={venuePath(venue)} className="-mx-3 flex items-start gap-4 rounded-md px-3 py-4 transition-colors hover:bg-white/5">
        <div className="min-w-0 flex-1">
          <p className="truncate">
            {showCollege ? (
              <>
                <span className="font-medium">{venue.college.short_name ?? venue.college.name}</span>
                <span className="ml-2 text-white/50">{venue.name}</span>
              </>
            ) : (
              <>
                <span className="font-medium">{venue.name}</span>
                {type && <span className="ml-2 text-white/50">{type}</span>}
              </>
            )}
          </p>
          {dishes.length > 0 && <p className="mt-1 truncate text-sm text-white/50">{dishes.slice(0, 3).join(' · ')}</p>}
        </div>
        <StatusText s={status} now={now} />
      </Link>
    </li>
  )
}

export function StatusText({ s, now }: { s: OpenStatus; now: LocalNow }) {
  const cls = 'shrink-0 text-sm tabular-nums'
  switch (s.kind) {
    case 'open':
      return <span className={`${cls} text-white`}>Open until {s.slot.end}</span>
    case 'opening':
      return <span className={`${cls} text-white/60`}>Opens {s.slot.start}</span>
    case 'closed':
      if (!s.next) return null
      return (
        <span className={`${cls} text-white/40`}>
          Opens {s.next.date === now.date ? '' : `${dayLabel(dayOfISO(s.next.date))} `}
          {s.next.slot.start}
        </span>
      )
    case 'unknown':
      return null
  }
}
