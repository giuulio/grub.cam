import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { DietTags, ProvenanceBadge, TypeChip } from '../components/Badges.tsx'
import { DishList } from '../components/DishList.tsx'
import { ServiceBadge } from '../components/ServiceBadge.tsx'
import { useData } from '../lib/data/useData.tsx'
import type { MenuDay, VenueView } from '../lib/data/types.ts'
import { ACCESS_LABEL, MEAL_LABEL, MEALS } from '../lib/filters.ts'
import { formatDays, formatISODate } from '../lib/time/clock.ts'
import { openStatus } from '../lib/time/openNow.ts'
import { useNow } from '../lib/useNow.ts'

export function CollegePage() {
  const { slug } = useParams()
  const data = useData()
  const now = useNow()
  if (data.status === 'loading') return <p className="py-10 text-center text-stone-500">Loading…</p>
  if (data.status === 'error') return <p className="py-10 text-center text-red-600">{data.error}</p>
  const college = data.bundle.colleges.find((c) => c.slug === slug)
  if (!college) return <p className="py-10 text-center text-stone-500">Unknown college.</p>
  const venues = data.venues.filter((v) => v.college.slug === slug)

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-stone-500 hover:underline">
          ← All venues
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{college.name}</h1>
        <div className="mt-1 flex flex-wrap gap-3 text-sm">
          {college.official_dining_url && (
            <a href={college.official_dining_url} target="_blank" rel="noopener" className="text-grub-600 hover:underline">
              College dining page ↗
            </a>
          )}
          {college.links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener" className="text-grub-600 hover:underline">
              {l.label} ↗
            </a>
          ))}
          <span className="text-xs text-stone-500">Reviewed {formatISODate(college.reviewed, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>
        {college.notice && <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">{college.notice}</p>}
      </div>

      {venues.map((v) => (
        <VenueSection key={v.id} v={v} now={now} />
      ))}

      {college.formal && (
        <section className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
          <h2 className="text-lg font-semibold">Formal Hall</h2>
          <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
            {(
              [
                ['Where', college.formal.where],
                ['Days', college.formal.days_text],
                ['Time', college.formal.time],
                ['Dress', college.formal.dress],
                ['Format', college.formal.format],
                ['Booking', college.formal.booking],
                ['Guests', college.formal.guests],
                ['Cost', college.formal.cost],
              ] as const
            )
              .filter(([, v]) => v)
              .map(([k, val]) => (
                <Row key={k} k={k} v={val!} />
              ))}
          </dl>
        </section>
      )}

      {college.notes.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Notes</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {college.notes.map((n, i) => (
              <li key={i}>
                <Linkified text={n} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function VenueSection({ v, now }: { v: VenueView; now: ReturnType<typeof useNow> }) {
  const status = openStatus(v.slots, now)
  const dates = useMemo(() => [...new Set(v.menu?.days.map((d) => d.date) ?? [])].sort(), [v.menu])
  const [date, setDate] = useState(() => (dates.includes(now.date) ? now.date : (dates.find((d) => d > now.date) ?? dates[0])))
  const days: MenuDay[] = v.menu?.days.filter((d) => d.date === date).sort((a, b) => MEALS.indexOf(a.service) - MEALS.indexOf(b.service)) ?? []
  const menuUrl = v.menu?.source_url ?? v.menu_source?.url
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">
            {v.name} <TypeChip type={v.type} />
          </h2>
          {v.where && <p className="text-sm text-stone-500">{v.where}</p>}
        </div>
        <ServiceBadge status={status} now={now} />
      </div>

      {v.slots.length > 0 && (
        <table className="mt-3 w-full text-sm">
          <tbody>
            {[...v.slots]
              .sort((a, b) => a.start.localeCompare(b.start))
              .map((s, i) => (
                <tr key={i} className="border-t border-stone-100 dark:border-stone-800">
                  <td className="py-1 pr-3 font-medium">{MEAL_LABEL[s.meal]}</td>
                  <td className="py-1 pr-3 text-stone-600 dark:text-stone-400">{formatDays(s.days)}</td>
                  <td className="py-1 pr-3 tabular-nums">
                    {s.start}–{s.end}
                  </td>
                  <td className="py-1 text-xs text-stone-500">
                    {s.period !== 'all' && <span className="mr-2 rounded bg-stone-100 px-1 dark:bg-stone-800">{s.period}</span>}
                    {s.note}
                    {s.prov.source_kind !== 'official' || s.prov.confidence !== 'high' ? (
                      <>
                        {' '}
                        <ProvenanceBadge prov={s.prov} />
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
      {v.hours_text && <p className="mt-2 text-xs text-stone-500">{v.hours_text}</p>}

      <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
        <Row k="Access" v={<><span>{ACCESS_LABEL[v.access.level]}</span>{v.access.text && <span className="text-stone-500"> — <Linkified text={v.access.text} /></span>} <ProvenanceBadge prov={v.access.prov} /></>} />
        {v.payment.text && <Row k="Payment" v={v.payment.text} />}
        {v.prices && <Row k="Prices" v={v.prices.text} />}
        {v.serves && <Row k="Serves" v={v.serves} />}
        {(v.dietary.text || v.dietary.tags.length > 0) && <Row k="Dietary" v={<><DietTags tags={v.dietary.tags} compact={false} /> {v.dietary.text && <span className="text-stone-500">{v.dietary.text}</span>}</>} />}
      </dl>

      {v.menu_source && (
        <div className="mt-4 border-t border-stone-100 pt-3 dark:border-stone-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Menu</h3>
            <span className="text-xs text-stone-500">
              {v.menu_source.status === 'live' ? 'public' : v.menu_source.status.replace('_', ' ')} · {v.menu_source.kind}
              {v.menu_source.platform ? ` (${v.menu_source.platform})` : ''} · {v.menu_source.cadence ?? ''}
              {menuUrl && (
                <>
                  {' · '}
                  <a href={menuUrl} target="_blank" rel="noopener" className="text-grub-600 hover:underline">
                    source ↗
                  </a>
                </>
              )}
            </span>
          </div>
          {v.menu ? (
            <>
              <div className="mt-2 flex flex-wrap gap-1">
                {dates.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDate(d)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${d === date ? 'bg-grub-600 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300'}`}
                  >
                    {d === now.date ? 'Today' : formatISODate(d)}
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <DishList days={days} collapsed={false} showService />
              </div>
              {v.menu.note && <p className="mt-2 text-xs text-stone-500">{v.menu.note}</p>}
              <p className="mt-1 text-[11px] text-stone-400">
                Captured {v.menu.method === 'script' ? 'automatically' : 'by hand'} {new Date(v.menu.fetched_at).toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short' })}.
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-stone-500">{v.menu_source.notes ?? 'Not public.'}</p>
          )}
        </div>
      )}
    </section>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <>
      <dt className="text-stone-500">{k}</dt>
      <dd>{typeof v === 'string' ? <Linkified text={v} /> : v}</dd>
    </>
  )
}

/** Render markdown-style [label](url) links and bare URLs as anchors. */
function Linkified({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  const re = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s)]+)/g
  let last = 0
  for (const m of text.matchAll(re)) {
    parts.push(text.slice(last, m.index))
    const label = m[1] ?? m[3]
    const url = m[2] ?? m[3]
    parts.push(
      <a key={m.index} href={url} target="_blank" rel="noopener" className="text-grub-600 hover:underline">
        {label}
      </a>,
    )
    last = m.index! + m[0].length
  }
  parts.push(text.slice(last))
  return <>{parts}</>
}
