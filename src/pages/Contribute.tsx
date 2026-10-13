import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { ArrowRight, Camera, ChevronDown, Clock, MenuBoard, Receipt, type IconComponent } from 'reicon-react'
import { ChipSelect, Segmented } from '../components/Controls.tsx'
import { GitHubPill } from '../components/GitHub.tsx'
import { Icon } from '../components/Icon.tsx'
import { VenueThumb } from '../components/VenuePhoto.tsx'
import { ago, scored, SENT, standings, tally } from '../lib/contributors.ts'
import { gapPath, siteProgress, type Gap, type Progress } from '../lib/coverage.ts'
import { useContributions, useReady } from '../lib/data.tsx'
import { BowTie } from '../lib/icons.ts'
import { useNow } from '../lib/useNow.ts'
import { SITE_NAME, sitePath, venuePath } from '../lib/site.ts'
import type { Site } from '../lib/types.ts'

/** Rows of the list, and of the leaderboard, before "Show all" */
const TOP = 10

const GAP_ICON: Record<Gap['kind'], IconComponent> = { menu: MenuBoard, prices: Receipt, hours: Clock, formal: BowTie, photo: Camera }
const WHAT: [Gap['kind'] | '', string][] = [['', 'Everything'], ['menu', 'Menus'], ['prices', 'Prices'], ['hours', 'Opening hours'], ['formal', 'Formal hall'], ['photo', 'Photos']]
type Order = 'most' | 'least' | 'name'
const ORDERS: [Order, string][] = [['most', 'Most complete'], ['least', 'Least complete'], ['name', 'A–Z']]

/**
 * Everything about filling grub.cam in, in one place (the header's Contribute): the way to send something; every
 * college (or University site) by how complete it is, each opening onto what its venues are missing, a link to send
 * each; and beside it who has sent in the most and what just went up, under their names (whoever puts up a wrong menu
 * answers for it). The URL keeps the list's choices (`kind`, `missing`, `order`) and which colleges are open (`site`),
 * so a link can point at one college's gaps.
 */
export function ContributePage() {
  // On a phone the leaderboard and what was just added arrive after the page, over the list: a link's #part stays in view
  const { hash } = useLocation()
  const contributions = useContributions().data
  const arrived = useRef(contributions)
  useEffect(() => {
    if (!arrived.current && contributions && hash) document.getElementById(hash.slice(1))?.scrollIntoView()
    arrived.current = contributions
  }, [contributions, hash])
  return (
    <>
      <title>{`Contribute · ${SITE_NAME}`}</title>
      {/* From a laptop two columns: what to do and the list on the left, the code and who has sent in the most on the
          right; on a phone the leaderboard comes before the long list, and the code last */}
      <div className="grid gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="lg:col-start-1 lg:row-start-1">
          <h1 className="title text-4xl leading-[1.1] sm:text-5xl">Contribute</h1>
          <SendCard />
        </div>
        <div className="space-y-12 lg:col-start-2 lg:row-start-2">
          <Leaderboard />
          <JustAdded />
        </div>
        <div className="lg:col-start-1 lg:row-start-2">
          <Colleges />
        </div>
        <OpenSource />
      </div>
    </>
  )
}

/**
 * The one thing to do here, as the site asks for what's missing everywhere (a venue's GapCard): Light Blue, the camera
 * in a disc, what to send and what happens to it; the whole card the link.
 */
function SendCard() {
  return (
    <Link to="/send" className="group mt-6 flex items-center gap-4 rounded-2xl bg-cta-bg p-5 sm:gap-5 sm:p-6">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-canvas text-cta">
        <Icon of={Camera} className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold text-ink group-hover:underline">Send what you see</span>
        <span className="mt-0.5 block text-muted">A menu, a price list or the opening times: AI reads it, and it’s up in minutes under your name.</span>
      </span>
      <Icon of={ArrowRight} className="size-6 shrink-0 text-cta transition-transform group-hover:translate-x-1" />
    </Link>
  )
}

/** The code, as the header had it (its stars), and what else helps: level with the card on the right, last on a phone. */
function OpenSource() {
  return (
    <aside aria-label="Open source" className="flex flex-wrap items-center gap-x-4 gap-y-3 lg:col-start-2 lg:row-start-1 lg:self-end lg:pb-5">
      <GitHubPill />
      <p className="min-w-0 flex-1 basis-56 text-[0.9375rem] text-muted">grub.cam is open source: star it, or help write the scripts that fetch each college’s menus.</p>
    </aside>
  )
}

/** A section's heading, with what controls it beside it. */
function Heading({ id, title, aside }: { id: string; title: string; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <h2 id={id} className="title text-2xl leading-tight sm:text-3xl">{title}</h2>
      {aside}
    </div>
  )
}

const MEDALS = ['bg-gold text-gold-ink', 'bg-silver text-silver-ink', 'bg-bronze text-bronze-ink']

/** A place in a table, quiet; the leaderboard's first three (`medal`) in gold, silver and bronze. */
const Place = ({ n, medal = false }: { n: number; medal?: boolean }) => (
  <span className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums ${medal && n <= 3 ? MEDALS[n - 1] : 'bg-ink/5 text-muted'}`}>{n}</span>
)

/**
 * The colleges (or the University's sites) by how complete they are, weighed as the gaps are (a menu most), or for one
 * kind of thing by count; most or least complete first, or A–Z. Level ones share a place. Each opens onto its venues'
 * gaps, each a link to send that thing in.
 */
function Colleges() {
  const data = useReady()
  const [params, setParams] = useSearchParams()
  const opened = params.get('site')?.split(',').filter(Boolean) ?? []
  // An old link to one University site's gaps opens that list
  const kind: Site['kind'] = params.get('kind') === 'university' || (!params.get('kind') && data.sites.find((s) => s.slug === opened[0])?.kind === 'university') ? 'university' : 'college'
  const what = WHAT.find(([k]) => k && k === params.get('missing'))?.[0] || ''
  const order: Order = ORDERS.find(([o]) => o === params.get('order'))?.[0] ?? 'most'
  const [all, setAll] = useState(false)
  const set = (key: string, value?: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  const toggle = (slug: string) => set('site', (opened.includes(slug) ? opened.filter((s) => s !== slug) : [...opened, slug]).join(','))

  const share = (p: Progress) => p.have / p.of
  const ranked = siteProgress(data, kind, what || undefined)
  const name = (p: Progress) => p.site.short_name ?? p.site.name
  const rows = order === 'most' ? ranked : [...ranked].sort((a, b) => (order === 'least' ? share(a) - share(b) || b.missing - a.missing : 0) || name(a).localeCompare(name(b)))
  // A college opened from a link is in the list, however far down
  const shown = all || data.snapshot ? rows : rows.filter((p, i) => i < TOP || opened.includes(p.site.slug))
  const missing = rows.reduce((n, p) => n + p.missing, 0)

  // A college opened from a link: in view, once, as the page opens
  const linked = useRef(opened[0])
  useEffect(() => {
    if (linked.current) document.getElementById(`site-${linked.current}`)?.scrollIntoView({ block: 'center' })
  }, [])

  return (
    <section aria-labelledby="coverage-title" id="coverage" className="scroll-mt-[calc(var(--header-h,0px)+1.5rem)]">
      <Heading id="coverage-title" title="Coverage" aside={<Segmented label="Which" options={[['college', 'Colleges'], ['university', 'University sites']]} value={kind} onChange={(k) => set('kind', k === 'college' ? undefined : k)} />} />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ChipSelect label="What" value={what} onChange={(v) => set('missing', v || undefined)} options={WHAT} />
        <ChipSelect label="Order" value={order} onChange={(v) => set('order', v === 'most' ? undefined : v)} options={ORDERS} />
        <span className="ml-1 text-sm text-muted">
          {missing} {missing === 1 ? 'thing' : 'things'} to send in
        </span>
      </div>
      <ol className="mt-3 divide-y divide-ink/10">
        {shown.map((p) => (
          <SiteRow key={p.site.slug} p={p} place={1 + ranked.filter((q) => share(q) > share(p)).length} count={!!what} open={opened.includes(p.site.slug)} onToggle={() => toggle(p.site.slug)} />
        ))}
      </ol>
      {shown.length < rows.length && (
        <button type="button" onClick={() => setAll(true)} className="btn btn-secondary mt-4">
          Show all {rows.length}
        </button>
      )}
    </section>
  )
}

/**
 * A college in the list: its place, name, a meter of how complete it is (a percentage, or "2 of 3" for one kind of
 * thing), and how many things are missing, which opens onto them: venue by venue, each thing a link to send it in.
 */
function SiteRow({ p, place, count, open, onToggle }: { p: Progress; place: number; count: boolean; open: boolean; onToggle: () => void }) {
  const share = p.have / p.of
  const percent = Math.round(share * 100)
  const name = p.site.short_name ?? p.site.name
  return (
    <li id={`site-${p.site.slug}`} className="scroll-mt-[calc(var(--header-h,0px)+1.5rem)]">
      <div className="flex items-center gap-3 py-3 sm:gap-4">
        <Place n={place} />
        <Link to={sitePath(p.site)} className="min-w-0 flex-1 truncate font-semibold hover:underline">
          {name}
        </Link>
        <div className="h-1.5 w-14 shrink-0 overflow-hidden rounded-sm bg-ink/10 sm:w-28" role="meter" aria-valuemin={0} aria-valuemax={p.of} aria-valuenow={p.have} aria-label={`${name}: ${count ? `${p.have} of ${p.of}` : `${percent}%`} here`}>
          <div className="h-full" style={{ width: `${percent}%`, backgroundColor: meterColour(share) }} />
        </div>
        <span className="w-12 shrink-0 text-right text-sm tabular-nums sm:text-base">{count ? `${p.have}/${p.of}` : `${percent}%`}</span>
        {p.missing ? (
          <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-[6.5rem] shrink-0 cursor-pointer items-center justify-end gap-1 text-sm font-semibold text-site-ink hover:underline">
            {p.missing} missing
            <Icon of={ChevronDown} className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        ) : (
          <span className="w-[6.5rem] shrink-0 text-right text-sm text-muted">All here</span>
        )}
      </div>
      {open && p.missing > 0 && (
        <ul className="space-y-3 pb-4 pl-10 sm:pl-11" aria-label={`Missing at ${name}`}>
          {p.venues.map(({ venue: v, gaps }) => (
            <li key={v.id}>
              <Link to={venuePath(v)} className="font-medium hover:underline">
                {v.name}
              </Link>
              <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
                {gaps.map((g) => (
                  <li key={g.kind}>
                    <Link to={gapPath(v, g)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-cta hover:underline">
                      <Icon of={GAP_ICON[g.kind]} className="size-4" />
                      {g.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

/** A traffic light for how full a meter is: red when empty, through amber and yellow, to green when full (OKLCH hues; yellow a little lighter, else it reads as olive). */
function meterColour(share: number) {
  const light = 0.68 + 0.14 * (1 - Math.abs(2 * share - 1))
  return `oklch(${light.toFixed(3)} 0.17 ${Math.round(25 + share * 120)})`
}

/**
 * Who has sent in the most, by points for what went up, each under the name it went up under; the first three in gold,
 * silver and bronze. Loaded in the browser: it changes by the hour.
 */
function Leaderboard() {
  const { venues, snapshot } = useReady()
  const { data, failed } = useContributions()
  const rows = data && standings(scored(data, venues))
  return (
    <section aria-labelledby="leaderboard-title" id="leaderboard" className="scroll-mt-[calc(var(--header-h,0px)+1.5rem)]">
      <Heading id="leaderboard-title" title="Top contributors" />
      {snapshot || !rows ? (
        <p className="mt-4 text-muted">{failed ? 'Couldn’t load who has sent things in.' : 'Loading…'}</p>
      ) : rows.length ? (
        <ol className="mt-4 divide-y divide-ink/10">
          {rows.slice(0, TOP).map((s, i) => (
            <li key={s.member} className="flex items-center gap-3 py-3">
              <Place n={i + 1} medal />
              <div className="min-w-0 flex-1 leading-snug">
                <p className="truncate font-semibold">{s.author}</p>
                <p className="truncate text-sm text-muted">{tally(s.counts)}</p>
              </div>
              <p className="shrink-0 tabular-nums">
                <span className="font-semibold">{s.points}</span> <span className="text-sm text-muted">{s.points === 1 ? 'pt' : 'pts'}</span>
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4">
          Nobody yet.{' '}
          <Link to="/send" className="link">
            Be the first
          </Link>
        </p>
      )}
      <details className="mt-3 text-sm text-muted">
        <summary className="cursor-pointer hover:text-ink">How points work</summary>
        <p className="mt-2">4 for a dining hall’s menu; 3 for a café’s or bar’s price list, or opening times; 1 for anything else. Only the first of each for a venue on a day counts.</p>
      </details>
    </section>
  )
}

/** What members put up most recently, newest first, each under the name of whoever sent it. */
function JustAdded() {
  const { venues, snapshot } = useReady()
  const { data } = useContributions()
  // "5 min ago" moves on
  useNow()
  const byId = new Map(venues.map((v) => [v.id, v]))
  const recent = (data ?? []).filter((r) => byId.has(r.venue_id)).slice(0, 5)
  if (snapshot || !recent.length) return null
  return (
    <section aria-labelledby="recent">
      <Heading id="recent" title="Just added" />
      <ul className="mt-4 space-y-3.5">
        {recent.map((r) => {
          const v = byId.get(r.venue_id)!
          return (
            <li key={r.id} className="flex items-center gap-3">
              <Link to={venuePath(v)} aria-hidden="true" tabIndex={-1} className="shrink-0">
                <VenueThumb venue={v} className="size-10 rounded-lg" />
              </Link>
              <p className="min-w-0 text-[0.9375rem] leading-snug">
                <span className="font-semibold">{r.author}</span> sent {SENT[r.kind]} for{' '}
                <Link to={venuePath(v)} className="link">
                  {v.name}
                </Link>
                <span className="text-muted"> · {ago(r.published_at)}</span>
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
