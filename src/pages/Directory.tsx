import { CloseCircle } from 'reicon-react'
import { Link, useSearchParams } from 'react-router'
import { SearchField, Segmented, Select } from '../components/Controls.tsx'
import { Icon } from '../components/Icon.tsx'
import { SiteThumb, TypeMark } from '../components/VenuePhoto.tsx'
import { useReady } from '../lib/data.tsx'
import { TYPES } from '../lib/filters.ts'
import { SITE_NAME, sitePath } from '../lib/site.ts'
import { openStatus } from '../lib/time/openNow.ts'
import { venueTypes, type Site } from '../lib/types.ts'
import { useNow } from '../lib/useNow.ts'

type Kind = 'all' | Site['kind']
type Sort = 'name' | 'open' | 'venues'
const KINDS: [Kind, string][] = [['all', 'All'], ['college', 'Colleges'], ['university', 'University']]
const SORTS: [Sort, string][] = [['name', 'A–Z'], ['open', 'Open now'], ['venues', 'Most venues']]

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/[’']/g, '').toLowerCase()

/** Every college and University site in one list, filtered by kind and name, sorted by name, what's open, or size. */
export function Directory() {
  const { sites, venues, snapshot } = useReady()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const kind = KINDS.find(([k]) => k === params.get('kind'))?.[0] ?? 'all'
  // What's open can't be known when the page is built
  const sort = SORTS.find(([s]) => s === params.get('sort') && !(snapshot && s === 'open'))?.[0] ?? 'name'
  const q = params.get('q') ?? ''
  const set = (key: string, value: string | undefined, fallback: string) => {
    const next = new URLSearchParams(params)
    if (value && value !== fallback) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const name = (s: Site) => s.short_name ?? s.name
  const rows = sites
    .filter((s) => kind === 'all' || s.kind === kind)
    .filter((s) => !q.trim() || [s.name, s.short_name ?? '', ...(s.aliases ?? [])].some((n) => fold(n).includes(fold(q.trim()))))
    .map((site) => {
      const mine = venues.filter((v) => v.site.slug === site.slug)
      return {
        site,
        venues: mine.length,
        types: TYPES.filter((t) => mine.some((v) => venueTypes(v).includes(t))),
        open: snapshot ? 0 : mine.filter((v) => openStatus(v.slots, now).kind === 'open').length,
        menuToday: !snapshot && mine.some((v) => v.menu.some((d) => d.date === now.date && d.items.length)),
      }
    })
    .sort((a, b) => (sort === 'open' ? b.open - a.open : sort === 'venues' ? b.venues - a.venues : 0) || name(a.site).localeCompare(name(b.site)))
  const count = (k: Site['kind']) => sites.filter((s) => s.kind === k).length

  return (
    <>
      <title>{`Directory: colleges and University sites · ${SITE_NAME}`}</title>
      <h1 className="title text-4xl">Directory</h1>
      <p className="mt-2 text-muted">
        {count('college')} colleges and {count('university')} University sites, with their dining halls, cafés and bars.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <SearchField value={q} onChange={(v) => set('q', v, '')} placeholder="Find a college or site" className="sm:w-72" />
        <Segmented label="Show" options={KINDS} value={kind} onChange={(k) => set('kind', k, 'all')} />
        <label className="flex items-center gap-2 text-sm text-muted sm:ml-auto">
          Sort
          <Select value={sort} onChange={(e) => set('sort', e.target.value, 'name')} className="w-40 text-ink">
            {SORTS.filter(([s]) => !(snapshot && s === 'open')).map(([s, label]) => (
              <option key={s} value={s}>
                {label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {rows.length ? (
        // An index, ruled like a printed one and one site to a line: its picture, its name, then what's there and what's open
        <ul className="mt-8">
          {rows.map((r) => (
            <li key={r.site.slug} className="border-t border-ink/10">
              <Link to={sitePath(r.site)} className="group -mx-3 flex items-center gap-4 rounded-lg px-3 py-3.5 transition-colors hover:bg-ink/4">
                <SiteThumb site={r.site} className="size-14 sm:size-16" />
                <div className="min-w-0 flex-1">
                  <h2 className="title truncate text-xl leading-snug">{name(r.site)}</h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
                    {r.types.length > 0 && (
                      <span className="flex gap-1">
                        {r.types.map((t) => <TypeMark key={t} type={t} />)}
                      </span>
                    )}
                    <span>
                      {r.venues} {r.venues === 1 ? 'venue' : 'venues'}
                    </span>
                    {r.open > 0 && <span className="rounded bg-open px-1.5 py-0.5 font-medium text-open-ink">{r.open} open now</span>}
                    {r.menuToday && <span>Menu today</span>}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-10 text-center">
          <p className="font-medium">Nothing matches “{q}”.</p>
          <button type="button" onClick={() => setParams({}, { replace: true })} className="mt-2 inline-flex cursor-pointer items-center gap-1 text-sm text-muted underline underline-offset-4 hover:text-ink">
            <Icon of={CloseCircle} />
            Clear
          </button>
        </div>
      )}
    </>
  )
}
