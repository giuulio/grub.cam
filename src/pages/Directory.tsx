import { CloseCircle, Search } from 'reicon-react'
import { Link, useSearchParams } from 'react-router'
import { Segmented, Select } from '../components/Controls.tsx'
import { Icon } from '../components/Icon.tsx'
import { useReady } from '../lib/data.tsx'
import { TYPE_LABEL, TYPES } from '../lib/filters.ts'
import { TYPE_ICON } from '../lib/icons.ts'
import { SITE_NAME, sitePath } from '../lib/site.ts'
import { openStatus } from '../lib/time/openNow.ts'
import { venueTypes, type Site } from '../lib/types.ts'
import { useNow } from '../lib/useNow.ts'

type Kind = 'all' | Site['kind']
type Sort = 'name' | 'open' | 'places'
const KINDS: [Kind, string][] = [['all', 'All'], ['college', 'Colleges'], ['university', 'University']]
const SORTS: [Sort, string][] = [['name', 'A–Z'], ['open', 'Open now'], ['places', 'Most places']]

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
        places: mine.length,
        types: TYPES.filter((t) => mine.some((v) => venueTypes(v).includes(t))),
        open: snapshot ? 0 : mine.filter((v) => openStatus(v.slots, now).kind === 'open').length,
        menuToday: !snapshot && mine.some((v) => v.menu.some((d) => d.date === now.date && d.items.length)),
      }
    })
    .sort((a, b) => (sort === 'open' ? b.open - a.open : sort === 'places' ? b.places - a.places : 0) || name(a.site).localeCompare(name(b.site)))
  const count = (k: Site['kind']) => sites.filter((s) => s.kind === k).length

  return (
    <>
      <title>{`Directory: colleges and University sites · ${SITE_NAME}`}</title>
      <h1 className="text-3xl font-semibold tracking-tight">Directory</h1>
      <p className="mt-2 text-muted">
        {count('college')} colleges and {count('university')} University sites, with their dining halls, cafés and bars.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <label className="flex h-11 w-full items-center gap-3 rounded-full border border-ink/15 px-4 text-muted focus-within:border-ink/40 sm:h-10 sm:w-72">
          <Icon of={Search} />
          <input type="search" value={q} onChange={(e) => set('q', e.target.value, '')} placeholder="Find a college or site" aria-label="Find a college or site" className="w-full bg-transparent text-ink outline-none placeholder:text-muted" />
        </label>
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
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <li key={r.site.slug}>
              <Link to={sitePath(r.site)} className="flex h-full flex-col rounded-2xl border border-ink/10 p-4 transition-colors hover:border-ink/35">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-medium">{name(r.site)}</h2>
                  {kind === 'all' && <span className="shrink-0 text-xs text-muted">{r.site.kind === 'college' ? 'College' : 'University'}</span>}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
                  {r.types.length ? (
                    <span className="flex gap-1.5">
                      {r.types.map((t) => (
                        <span key={t} className="type-swatch" data-type={t} title={TYPE_LABEL[t]}>
                          <Icon of={TYPE_ICON[t]} className="size-3" />
                          <span className="sr-only">{TYPE_LABEL[t]}</span>
                        </span>
                      ))}
                    </span>
                  ) : null}
                  <span>
                    {r.places} {r.places === 1 ? 'place' : 'places'}
                  </span>
                  {r.open > 0 && (
                    <span className="flex items-center gap-1.5 text-ink">
                      <span aria-hidden="true" className="size-2 rounded-full bg-accent ring-1 ring-accent-ink/20" />
                      {r.open} open now
                    </span>
                  )}
                  {r.menuToday && <span>Menu today</span>}
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
