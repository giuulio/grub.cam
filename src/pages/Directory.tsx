import { useState } from 'react'
import { CloseCircle } from 'reicon-react'
import { useSearchParams } from 'react-router'
import { SearchField, Segmented, Select } from '../components/Controls.tsx'
import { Icon } from '../components/Icon.tsx'
import { Breadcrumbs, ListHeading, ListWithMap, SiteListing } from '../components/Listing.tsx'
import { useReady } from '../lib/data.tsx'
import { applyFilters, DEFAULT_FILTERS, TYPES } from '../lib/filters.ts'
import { SITE_NAME } from '../lib/site.ts'
import { openStatus } from '../lib/time/openNow.ts'
import type { Site } from '../lib/types.ts'
import { useNow } from '../lib/useNow.ts'

type Kind = 'all' | Site['kind']
type Sort = 'name' | 'open' | 'venues'
const KINDS: [Kind, string][] = [['all', 'All'], ['college', 'Colleges'], ['university', 'University']]
const SORTS: [Sort, string][] = [['name', 'A–Z'], ['open', 'Open now'], ['venues', 'Most venues']]

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/[’']/g, '').toLowerCase()

/**
 * Every college and University site in one list, as TheFork lists restaurants: a card each, the map of their venues
 * beside them; filtered by kind and name, sorted by name, what's open, or size.
 */
export function Directory() {
  const { sites, venues, snapshot } = useReady()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  // The venues of the card under the pointer, picked out on the map
  const [hover, setHover] = useState<string[]>()
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
      // Dining, cafés, bars; in the site's own order within each
      const mine = venues.filter((v) => v.site.slug === site.slug).sort((a, b) => TYPES.indexOf(a.type) - TYPES.indexOf(b.type))
      return {
        site,
        mine,
        venues: mine.length,
        open: snapshot ? 0 : mine.filter((v) => openStatus(v.slots, now).kind === 'open').length,
      }
    })
    .sort((a, b) => (sort === 'open' ? b.open - a.open : sort === 'venues' ? b.venues - a.venues : 0) || name(a.site).localeCompare(name(b.site)))
  const count = (k: Site['kind']) => sites.filter((s) => s.kind === k).length
  const results = applyFilters(rows.flatMap((r) => r.mine), { ...DEFAULT_FILTERS, date: now.date }, now)
  const noun = kind === 'college' ? 'college' : kind === 'university' ? 'University site' : 'site'

  return (
    <>
      <title>{`Directory: colleges and University sites · ${SITE_NAME}`}</title>
      <Breadcrumbs trail={[['/directory', 'Directory']]} />
      <ListHeading title={kind === 'college' ? 'Colleges' : kind === 'university' ? 'University sites' : 'Colleges and University sites'} count={`${rows.length} ${noun}${rows.length === 1 ? '' : 's'}`}>
        {count('college')} colleges and {count('university')} University sites with somewhere to eat or drink: departments, museums, the library and more. Each with its dining halls, cafés and bars, and what’s open now.
      </ListHeading>

      <div className="mt-6 mb-6 flex flex-wrap items-center gap-3 border-t border-ink/10 pt-6">
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
        <ListWithMap results={results} highlight={hover} list={rows.map((r) => <SiteListing key={r.site.slug} site={r.site} venues={r.mine} now={now} onHover={setHover} />)} />
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
