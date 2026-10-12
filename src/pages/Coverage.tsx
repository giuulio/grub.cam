import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Camera, Clock, CloseCircle, MenuBoard, Receipt, type IconComponent } from 'reicon-react'
import { ChipSelect } from '../components/Controls.tsx'
import { Icon } from '../components/Icon.tsx'
import { SitePicker } from '../components/SitePicker.tsx'
import { VenueThumb } from '../components/VenuePhoto.tsx'
import { menuNote, menuWindow, overallCoverage, venueGaps, type Counter, type Gap } from '../lib/coverage.ts'
import { useReady } from '../lib/data.tsx'
import { BowTie } from '../lib/icons.ts'
import { REPO_URL, sendPath, SITE_NAME, siteName, sitePath, venuePath } from '../lib/site.ts'
import type { Site, Venue } from '../lib/types.ts'

/** Rows shown at a time, before "Show more" (the front page's) */
const PAGE = 24

const GAP_ICON: Record<Gap['kind'], IconComponent> = { menu: MenuBoard, prices: Receipt, hours: Clock, formal: BowTie, photo: Camera }
const GAP_OPTIONS: [Gap['kind'] | '', string][] = [['', 'Anything missing'], ['menu', 'The menu'], ['prices', 'Prices'], ['hours', 'Opening hours'], ['formal', 'Formal hall'], ['photo', 'A photo']]
type Order = 'gain' | 'site'

/**
 * What grub.cam has, and what's still missing, laid out to get it filled: four counts (menus this week, price lists,
 * hours, photos), then every venue with a gap as a row, its gaps each a link to send that thing in from where you are,
 * most worth having first. Narrow to your own college with the front page's picker; the URL keeps the choice.
 */
export function CoveragePage() {
  const data = useReady()
  const { venues, sites, snapshot } = data
  const [params, setParams] = useSearchParams()
  const picked = params.get('site')?.split(',').filter((s) => sites.some((x) => x.slug === s)) ?? []
  const kind = (['college', 'university'] as const).find((k) => k === params.get('kind'))
  const missing = GAP_OPTIONS.find(([k]) => k && k === params.get('missing'))?.[0] || ''
  const order: Order = params.get('order') === 'site' ? 'site' : 'gain'
  const [shown, setShown] = useState(PAGE)
  const update = (fn: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params)
    fn(next)
    setParams(next, { replace: true })
    setShown(PAGE)
  }
  const set = (key: string, value?: string) => update((p) => (value ? p.set(key, value) : p.delete(key)))

  const counts = overallCoverage(venues)
  const colleges = sites.filter((s) => s.kind === 'college').length
  const uniSites = sites.length - colleges

  const inScope = venues.filter((v) => (picked.length ? picked.includes(v.site.slug) : !kind || v.site.kind === kind))
  const name = (s: Site) => s.short_name ?? s.name
  const rows = inScope
    .map((venue) => ({ venue, gaps: venueGaps(venue).filter((g) => !missing || g.kind === missing) }))
    .filter((r) => r.gaps.length)
    .sort((a, b) => (order === 'gain' ? weight(b.gaps) - weight(a.gaps) : 0) || name(a.venue.site).localeCompare(name(b.venue.site)) || a.venue.name.localeCompare(b.venue.name))
  const gapCount = rows.reduce((n, r) => n + r.gaps.length, 0)
  const filtered = !!(picked.length || kind || missing)
  const scopeName = picked.length === 1 ? siteName(sites.find((s) => s.slug === picked[0])!) : picked.length ? `${picked.length} colleges and sites` : kind === 'college' ? 'The colleges' : kind === 'university' ? 'The University’s sites' : undefined
  // A prerendered page lists every venue, for whoever reads it without the script
  const visible = snapshot ? rows : rows.slice(0, shown)

  return (
    <>
      <title>{`What’s missing · ${SITE_NAME}`}</title>
      <h1 className="title text-4xl leading-[1.1] sm:text-5xl">What’s here, and what’s missing</h1>
      <p className="mt-4 max-w-3xl text-lg text-muted sm:text-xl">
        {venues.length} venues at {colleges} colleges and {uniSites} University sites. Everything here is what each one publishes, so where a college publishes nothing, a photo from someone standing there is the only way in.
      </p>

      {/* The four counts, as a row of figures: how much is here, out of how much could be; each leads to its gaps below */}
      <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4" aria-label="What grub.cam has">
        {counts.map((c, i) => <Count key={c.what} c={c} dates={c.dated ? menuWindow(data, true) : undefined} gap={COUNT_GAP[i]} />)}
      </ul>

      <section className="mt-14" aria-labelledby="gaps">
        <h2 id="gaps" className="title text-2xl leading-tight sm:text-3xl">
          {scopeName ? `${scopeName}: ` : ''}
          {rows.length} {rows.length === 1 ? 'venue' : 'venues'} with something missing
        </h2>
        <p className="mt-2 max-w-3xl text-base text-muted sm:text-[1.0625rem]">
          {gapCount} {gapCount === 1 ? 'thing' : 'things'} to send in, most worth having first. Each is a link: from where you are, with your Cambridge account, send a photo of it or type out what it says, and it goes up once someone has checked it.
        </p>

        <div className="card-row mt-5 flex items-center gap-2 overflow-x-auto">
          <SitePicker
            sites={sites}
            value={picked}
            kind={kind}
            onChange={(slugs, k) => update((p) => {
              if (slugs.length) p.set('site', slugs.join(','))
              else p.delete('site')
              if (k) p.set('kind', k)
              else p.delete('kind')
            })}
          />
          <ChipSelect label="Missing" value={missing} onChange={(v) => set('missing', v)} options={GAP_OPTIONS} />
          <ChipSelect label="Order" value={order} onChange={(v) => set('order', v === 'gain' ? undefined : v)} options={[['gain', 'Most to gain first'], ['site', 'By college']]} />
          {filtered && (
            <button type="button" onClick={() => update((p) => { for (const k of ['site', 'kind', 'missing']) p.delete(k) })} className="flex shrink-0 cursor-pointer items-center gap-1 px-2 text-sm text-muted hover:text-ink">
              <Icon of={CloseCircle} />
              Clear
            </button>
          )}
        </div>

        {rows.length ? (
          <ul className="mt-4 divide-y divide-ink/10">
            {visible.map((r) => <GapRow key={r.venue.id} {...r} />)}
          </ul>
        ) : (
          <p className="py-16 text-center text-lg">Nothing’s missing here.</p>
        )}
        {visible.length < rows.length && (
          <div className="flex justify-center py-6">
            <button type="button" onClick={() => setShown(shown + PAGE)} className="btn btn-secondary">
              Show {Math.min(PAGE, rows.length - visible.length)} more
            </button>
          </div>
        )}
      </section>
    </>
  )
}

const weight = (gaps: Gap[]) => gaps.reduce((n, g) => n + g.weight, 0)

/** Which gap each count's shortfall is, in `overallCoverage()`'s order */
const COUNT_GAP: Gap['kind'][] = ['menu', 'prices', 'hours', 'photo']

/** One of the counts: the figure, what it counts (and for which dates), linked to the venues missing it, and a meter. */
function Count({ c, dates, gap }: { c: Counter; dates?: string; gap: Gap['kind'] }) {
  const share = c.of ? c.have / c.of : 0
  return (
    <li>
      <p className="title text-3xl leading-none tabular-nums sm:text-4xl">
        {c.have}
        <span className="text-xl font-normal text-muted sm:text-2xl"> of {c.of}</span>
      </p>
      <p className="mt-2 text-base font-medium sm:text-[1.0625rem]">
        {c.have < c.of ? (
          <Link to={`?missing=${gap}`} replace className="hover:underline" aria-label={`${c.what}: see the ${c.of - c.have} ${c.noun} missing ${gap === 'menu' ? 'theirs' : 'them'}`}>
            {c.what}
          </Link>
        ) : (
          c.what
        )}
      </p>
      <p className="text-[0.9375rem] text-muted">
        {c.noun}
        {dates && `, ${dates}`}
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-sm bg-ink/10" role="meter" aria-valuemin={0} aria-valuemax={c.of} aria-valuenow={c.have} aria-label={`${c.what}: ${c.have} of ${c.of} ${c.noun}`}>
        <div className="h-full" style={{ width: `${Math.round(share * 100)}%`, backgroundColor: meterColour(share) }} />
      </div>
    </li>
  )
}

/** A traffic light for how full a meter is: red when empty, through amber and yellow, to green when full (OKLCH hues; yellow a little lighter, else it reads as olive). */
function meterColour(share: number) {
  const light = 0.68 + 0.14 * (1 - Math.abs(2 * share - 1))
  return `oklch(${light.toFixed(3)} 0.17 ${Math.round(25 + share * 120)})`
}

/**
 * A venue with something missing, as the front page's rows: its picture, its college and name, then what it lacks,
 * each a link to send it in; under a dining hall with no menu, why there's none and whether a script would help.
 */
function GapRow({ venue: v, gaps }: { venue: Venue; gaps: Gap[] }) {
  const note = gaps.some((g) => g.kind === 'menu') ? menuNote(v) : undefined
  return (
    <li className="flex gap-4 py-5 text-base sm:gap-6 sm:text-[1.0625rem]">
      <Link to={venuePath(v)} aria-hidden="true" tabIndex={-1} className="shrink-0 self-start">
        <VenueThumb venue={v} className="size-20 rounded-xl sm:size-24" />
      </Link>
      <div className="min-w-0 flex-1 leading-snug">
        <Link to={sitePath(v.site)} className="text-base font-semibold text-site-ink hover:underline sm:text-lg">
          {siteName(v.site)}
        </Link>
        <h3 className="title mt-0.5 text-xl leading-tight sm:text-[1.625rem]">
          <Link to={venuePath(v)} className="hover:underline">
            {v.name}
          </Link>
        </h3>
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2" aria-label={`Missing from ${v.name}`}>
          {gaps.map((g) => (
            <li key={g.kind}>
              <Link to={sendPath(v, g.send)} className="inline-flex items-center gap-2 font-semibold text-cta hover:underline">
                <Icon of={GAP_ICON[g.kind]} className="size-5" />
                {g.label}
              </Link>
            </li>
          ))}
        </ul>
        {note && (
          <p className="mt-2 text-[0.9375rem] text-muted">
            {note.text}
            {note.script && (
              <>
                {' '}
                <a href={`${REPO_URL}/tree/main/scripts/ingest/sources`} target="_blank" rel="noopener" className="link text-ink">
                  Help write one
                </a>
              </>
            )}
          </p>
        )}
      </div>
    </li>
  )
}
