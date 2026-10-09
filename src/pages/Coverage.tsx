import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Segmented } from '../components/Controls.tsx'
import { CATEGORY_TITLES, coverage, coverageMatrix, menuWindow, type Category, type Cell } from '../lib/coverage.ts'
import { useReady } from '../lib/data.tsx'
import { SITE_NAME, sitePath, venuePath } from '../lib/site.ts'
import type { Site } from '../lib/types.ts'

const SHORT: Record<string, string> = { 'Who can eat there': 'Access', 'Card payments': 'Cards' }
const KINDS: [Site['kind'], string][] = [['college', 'Colleges'], ['university', 'University']]
type Order = 'name' | 'missing'

/**
 * What grub.cam knows for each college (or University site), and what's missing: a tile per category with how many
 * have it, then every site against every category, so the gaps show at a glance and each links to where it is.
 */
export function CoveragePage() {
  const data = useReady()
  const [params, setParams] = useSearchParams()
  const kind = params.get('kind') === 'university' ? 'university' : 'college'
  const [order, setOrder] = useState<Order>('name')
  const [detail, setDetail] = useState<string>()
  const dates = menuWindow(data, true)
  const categories = coverage(data, kind)
  // The page counts one kind at a time, so the units say so: "college venues", not a share of every venue
  const sites = kind === 'college' ? 'colleges' : 'University sites'
  const venues = kind === 'college' ? 'college venues' : 'University venues'

  const score = (cells: Cell[]) => cells.reduce((n, c) => n + (c.state === 'na' ? 0 : c.state === 'all' ? 0 : c.state === 'some' ? 0.5 : 1), 0)
  const name = (s: Site) => s.short_name ?? s.name
  const rows = coverageMatrix(data, kind).sort((a, b) => (order === 'missing' ? score(b.cells) - score(a.cells) : 0) || name(a.site).localeCompare(name(b.site)))

  return (
    <>
      <title>{`Coverage · ${SITE_NAME}`}</title>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="title text-4xl">Coverage</h1>
          <p className="mt-2 text-muted">
            What we know for each of the {rows.length} {sites}, and what's missing.
          </p>
        </div>
        <Segmented label="Show" options={KINDS} value={kind} onChange={(k) => setParams(k === 'college' ? {} : { kind: k }, { replace: true })} />
      </div>

      <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4 lg:grid-cols-7">
        {categories.map((c) => (
          <Tile key={c.title} category={c} unit={c.unit === 'sites' ? sites : venues} dates={dates} />
        ))}
      </ul>

      <section className="mt-12" aria-labelledby="by-site">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="by-site" className="title text-2xl">
            {kind === 'college' ? 'College by college' : 'Site by site'}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              label="Order"
              options={[
                ['name', 'A–Z'],
                ['missing', 'Most missing'],
              ]}
              value={order}
              onChange={setOrder}
            />
            <Link to="/send" className="btn btn-primary">
              Help fill the gaps
            </Link>
          </div>
        </div>
        <Legend />
        <p aria-live="polite" className="mt-3 min-h-6 text-sm text-muted">
          {detail ?? 'Point at or tab to a square to see what’s missing; squares link to the venue.'}
        </p>

        <div className="mt-2 overflow-x-auto rounded-xl border border-ink/10" onMouseLeave={() => setDetail(undefined)}>
          <table className="w-full min-w-160 table-fixed border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-muted">
                <th scope="col" className="sticky left-0 w-36 bg-canvas px-4 py-3 text-left font-medium sm:w-56">
                  {kind === 'college' ? 'College' : 'Site'}
                </th>
                {CATEGORY_TITLES.map((t) => (
                  <th key={t} scope="col" className="px-2 py-3 text-center text-xs leading-4 font-medium">
                    {SHORT[t] ?? t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ site, cells }) => (
                <tr key={site.slug} className="border-b border-ink/5 last:border-0 hover:bg-ink/3">
                  <th scope="row" className="sticky left-0 truncate bg-canvas px-4 py-2 text-left font-normal">
                    <Link to={sitePath(site)} className="transition-colors hover:text-muted">
                      {name(site)}
                    </Link>
                  </th>
                  {cells.map((cell, i) => {
                    const text = describe(name(site), CATEGORY_TITLES[i], cell)
                    const show = () => setDetail(text)
                    const target = cell.missing.length === 1 ? venuePath(cell.missing[0]) : sitePath(site)
                    return (
                      <td key={i} className="px-2 py-2 text-center" onMouseEnter={show}>
                        {cell.state === 'some' || cell.state === 'none' ? (
                          <Link to={target} aria-label={text} onFocus={show} className="inline-flex size-8 items-center justify-center rounded-md hover:bg-ink/10">
                            <Mark state={cell.state} />
                          </Link>
                        ) : (
                          <span title={text} className="inline-flex size-8 items-center justify-center">
                            <Mark state={cell.state} />
                            <span className="sr-only">{text}</span>
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

/** A category's headline: how many have it, out of how many could, as a number and a meter. */
function Tile({ category: c, unit, dates }: { category: Category; unit: string; dates: string }) {
  const share = c.of ? c.have / c.of : 0
  return (
    <li className="border-t border-ink/15 pt-3">
      <p className="text-sm text-muted">{c.title}</p>
      <p className="title mt-1 text-3xl tabular-nums">
        {c.have}
        <span className="text-base font-normal text-muted"> / {c.of}</span>
      </p>
      <p className="mt-0.5 text-xs text-muted">
        {unit}
        {c.dated && `, ${dates}`}
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-sm bg-ink/10" role="meter" aria-valuemin={0} aria-valuemax={c.of} aria-valuenow={c.have} aria-label={`${c.title}: ${c.have} of ${c.of} ${unit}`}>
        <div className="h-full bg-action" style={{ width: `${Math.round(share * 100)}%` }} />
      </div>
    </li>
  )
}

/** Shape carries the state, so it reads without colour: full, half, empty, or a dot where nothing applies. */
function Mark({ state }: { state: Cell['state'] }) {
  if (state === 'na') return <span aria-hidden="true" className="block size-1.5 rounded-full bg-ink/25" />
  return (
    <span aria-hidden="true" className={`relative block size-4.5 overflow-hidden rounded-[5px] border-[1.5px] ${state === 'none' ? 'border-ink/35' : 'border-ink'}`}>
      {state !== 'none' && <span className={`absolute inset-y-0 left-0 bg-ink ${state === 'all' ? 'right-0' : 'right-1/2'}`} />}
    </span>
  )
}

function Legend() {
  const items: [Cell['state'], string][] = [
    ['all', 'Every venue'],
    ['some', 'Some venues'],
    ['none', 'None yet'],
    ['na', 'No such venue'],
  ]
  return (
    <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted" aria-label="Key">
      {items.map(([state, label]) => (
        <li key={state} className="flex items-center gap-2">
          <span className="inline-flex size-4.5 items-center justify-center">
            <Mark state={state} />
          </span>
          {label}
        </li>
      ))}
    </ul>
  )
}

/** "Jesus · Hours: 2 of 3 venues, missing The Roost" */
function describe(site: string, title: string, c: Cell): string {
  if (c.state === 'na') return `${site} · ${title}: no venue it applies to`
  const missing = c.missing.length ? `; missing ${c.missing.map((v) => v.name).join(', ')}` : ''
  return `${site} · ${title}: ${c.have} of ${c.of} ${c.of === 1 ? 'venue' : 'venues'}${missing}`
}
