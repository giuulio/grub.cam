import { Link } from 'react-router'
import { useReady } from '../lib/data.tsx'
import { TYPE_LABEL, TYPES } from '../lib/filters.ts'
import { sitePath, SITE_NAME } from '../lib/site.ts'
import { venueTypes, type Site } from '../lib/types.ts'

export function Directory({ kind }: { kind: Site['kind'] }) {
  const { sites, venues } = useReady()
  const colleges = kind === 'college'
  const title = colleges ? 'Colleges' : 'University'
  const entries = sites.filter((s) => s.kind === kind).sort((a, b) => a.name.localeCompare(b.name))
  return (
    <>
      <title>{`${title} · ${SITE_NAME}`}</title>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-muted">{colleges ? 'Find your college’s dining halls, cafés and bars.' : 'Food and drink across University sites, museums and gardens.'}</p>
      <ul className="mt-8 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-10">
        {entries.map((s) => {
          const mine = venues.filter((v) => v.site.slug === s.slug)
          const present = new Set(mine.flatMap(venueTypes))
          const types = TYPES.filter((t) => present.has(t))
          return (
            <li key={s.slug} className="border-t border-ink/10">
              <Link to={sitePath(s)} className="group flex items-center justify-between gap-4 py-5">
                <div className="min-w-0 flex-1">
                  <h2 className="font-medium group-hover:underline underline-offset-4">{s.short_name ?? s.name}</h2>
                  <p className="mt-1 text-sm text-muted">{types.map((t) => TYPE_LABEL[t]).join(' · ') || 'Places coming soon'}</p>
                </div>
                <span className="shrink-0 text-sm text-muted tabular-nums">{mine.length} {mine.length === 1 ? 'place' : 'places'}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}
