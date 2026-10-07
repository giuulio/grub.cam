import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { FilterBar } from '../components/FilterBar.tsx'
import { VenueCard } from '../components/VenueCard.tsx'
import { useData } from '../lib/data/useData.tsx'
import type { DietTag, Meal, VenueType } from '../lib/data/types.ts'
import { applyFilters, DEFAULT_FILTERS, DIETS, MEALS, type Filters, type Ranked } from '../lib/filters.ts'
import { formatISODate, type LocalNow } from '../lib/time/clock.ts'
import { defaultMealFor } from '../lib/time/openNow.ts'
import { useNow } from '../lib/useNow.ts'

const TYPES: VenueType[] = ['hall', 'cafe', 'bar', 'other']

export function Home() {
  const data = useData()
  const now = useNow()
  const [params, setParams] = useSearchParams()

  const filters: Filters = useMemo(() => {
    const mealParam = params.get('meal')
    const meal = mealParam === 'any' ? undefined : MEALS.includes(mealParam as Meal) ? (mealParam as Meal) : mealParam === null ? defaultMealFor(now) : undefined
    return {
      ...DEFAULT_FILTERS,
      meal,
      date: params.get('date') ?? now.date,
      diets: (params.get('diet')?.split(',').filter((d) => DIETS.includes(d as DietTag)) as DietTag[]) ?? [],
      types: (params.get('type')?.split(',').filter((t) => TYPES.includes(t as VenueType)) as VenueType[]) ?? [],
      nonMemberOk: params.get('guest') === '1',
      bankCard: params.get('card') === '1',
      liveMenu: params.get('menu') === '1',
      openNow: params.get('open') === '1',
      q: params.get('q') ?? '',
    }
  }, [params, now])

  const onChange = (patch: Partial<Filters>) => {
    const f = { ...filters, ...patch }
    const p = new URLSearchParams()
    p.set('meal', f.meal ?? 'any')
    if (f.date !== now.date) p.set('date', f.date)
    if (f.diets.length) p.set('diet', f.diets.join(','))
    if (f.types.length) p.set('type', f.types.join(','))
    if (f.nonMemberOk) p.set('guest', '1')
    if (f.bankCard) p.set('card', '1')
    if (f.liveMenu) p.set('menu', '1')
    if (f.openNow) p.set('open', '1')
    if (f.q) p.set('q', f.q)
    setParams(p, { replace: true })
  }

  const results = useMemo(() => (data.status === 'ready' ? applyFilters(data.venues, filters, now) : []), [data, filters, now])

  if (data.status === 'loading') return <p className="py-10 text-center text-stone-500">Loading…</p>
  if (data.status === 'error') return <p className="py-10 text-center text-red-600">Could not load data: {data.error}</p>

  const open = results.filter((r) => r.status.kind === 'open')
  const later = results.filter((r) => r.status.kind === 'opening')
  const closed = results.filter((r) => r.status.kind === 'closed')
  const unknown = results.filter((r) => r.status.kind === 'unknown')
  const viewingToday = filters.date === now.date

  const sectionProps = { now, diets: filters.diets, viewingDate: filters.date }

  return (
    <div className="space-y-4">
      <FilterBar filters={filters} onChange={onChange} now={now} resultCount={results.length} />
      {!results.length && <p className="py-10 text-center text-stone-500">Nothing matches. Try removing a filter.</p>}
      {viewingToday ? (
        <>
          <Section title="Open now" items={open} {...sectionProps} />
          <Section title="Opening later today" items={later} {...sectionProps} />
          <Section title="Closed now" items={closed} {...sectionProps} />
          <Section title="Hours not published" items={unknown} {...sectionProps} />
        </>
      ) : (
        <Section title={`Menus and venues for ${formatISODate(filters.date, { weekday: 'long', day: 'numeric', month: 'long' })}`} items={results} {...sectionProps} />
      )}
    </div>
  )
}

function Section({ title, items, now, diets, viewingDate }: { title: string; items: Ranked[]; now: LocalNow; diets: DietTag[]; viewingDate: string }) {
  if (!items.length) return null
  return (
    <section className="space-y-3">
      <h2 className="pt-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
        {title} <span className="font-normal">({items.length})</span>
      </h2>
      {items.map((r) => (
        <VenueCard key={r.venue.id} item={r} now={now} diets={diets} viewingDate={viewingDate} />
      ))}
    </section>
  )
}
