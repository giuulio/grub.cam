import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { DietTag, Meal } from '../lib/data/types.ts'
import { useReady } from '../lib/data/useData.tsx'
import { applyFilters, DEFAULT_FILTERS, dishMatches, DIET_LABEL, MEAL_LABEL, MEALS, type Filters, type Ranked } from '../lib/filters.ts'
import { SITE_NAME } from '../lib/site.ts'
import { useNow } from '../lib/useNow.ts'
import { dayOfISO, dayLabel, type LocalNow } from '../lib/time/clock.ts'
import type { OpenStatus } from '../lib/time/openNow.ts'

const DIET_CHIPS: DietTag[] = ['vegetarian', 'vegan', 'halal', 'gluten_free']

// All filter state lives in the URL (?q=&open=1&meal=&diet=vegan,halal&guests=1&card=1) so a search can be shared.
function readFilters(p: URLSearchParams, date: string): Filters {
  const meal = p.get('meal') as Meal | null
  return {
    ...DEFAULT_FILTERS,
    date,
    q: p.get('q') ?? '',
    meal: meal && MEALS.includes(meal) ? meal : undefined,
    diets: (p.get('diet')?.split(',') ?? []).filter((d): d is DietTag => DIET_CHIPS.includes(d as DietTag)),
    openNow: p.has('open'),
    nonMemberOk: p.has('guests'),
    bankCard: p.has('card'),
  }
}

export function Home() {
  const { venues } = useReady()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const f = readFilters(params, now.date)
  const results = applyFilters(venues, f, now)
  const active = params.toString() !== ''

  const update = (fn: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params)
    fn(next)
    setParams(next, { replace: true })
  }
  const toggle = (key: string) => update((p) => (p.has(key) ? p.delete(key) : p.set(key, '1')))
  const toggleDiet = (tag: DietTag) =>
    update((p) => {
      const diets = f.diets.includes(tag) ? f.diets.filter((d) => d !== tag) : [...f.diets, tag]
      if (diets.length) p.set('diet', diets.join(','))
      else p.delete('diet')
    })

  return (
    <>
      <title>{SITE_NAME}</title>
      <div className="sticky top-16 z-10 -mx-4 bg-charcoal px-4 pt-2 pb-4 sm:-mx-6 sm:px-6">
        <label className="flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-5 py-3 focus-within:border-white/40">
          <SearchIcon />
          <input
            type="search"
            value={f.q}
            onChange={(e) => update((p) => (e.target.value ? p.set('q', e.target.value) : p.delete('q')))}
            placeholder="Search colleges or dishes"
            aria-label="Search colleges or dishes"
            className="w-full bg-transparent text-white outline-none placeholder:text-white/40"
          />
        </label>
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <Chip active={f.openNow} onClick={() => toggle('open')}>
            Open now
          </Chip>
          <span className={`relative shrink-0 ${f.meal ? 'text-charcoal' : 'text-white/70'}`}>
            <select
              value={f.meal ?? ''}
              onChange={(e) => update((p) => (e.target.value ? p.set('meal', e.target.value) : p.delete('meal')))}
              aria-label="Meal"
              className={`${chipClass(!!f.meal)} appearance-none pr-8`}
            >
              <option value="">Any meal</option>
              {MEALS.map((m) => (
                <option key={m} value={m}>
                  {MEAL_LABEL[m]}
                </option>
              ))}
            </select>
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-3 -translate-y-1/2">
              <path d="m3 4.5 3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <Chip active={f.nonMemberOk} onClick={() => toggle('guests')}>
            Guests welcome
          </Chip>
          <Chip active={f.bankCard} onClick={() => toggle('card')}>
            Bank card
          </Chip>
          {DIET_CHIPS.map((tag) => (
            <Chip key={tag} active={f.diets.includes(tag)} onClick={() => toggleDiet(tag)}>
              {DIET_LABEL[tag]}
            </Chip>
          ))}
        </div>
      </div>

      <div className="mt-4 mb-2 flex items-baseline justify-between text-sm text-white/40">
        <p>
          {results.length} {results.length === 1 ? 'result' : 'results'}
        </p>
        {active && (
          <button type="button" onClick={() => setParams({}, { replace: true })} className="cursor-pointer hover:text-white">
            Clear
          </button>
        )}
      </div>

      <ul className="divide-y divide-white/10 border-t border-white/10">
        {results.map((r) => (
          <ResultRow key={r.venue.id} r={r} f={f} now={now} />
        ))}
      </ul>
    </>
  )
}

function ResultRow({ r, f, now }: { r: Ranked; f: Filters; now: LocalNow }) {
  const { venue } = r
  // When searching or filtering by diet, show which dishes matched.
  const dishes = f.q.trim() || f.diets.length ? r.days.flatMap((d) => d.items).filter((i) => dishMatches(i, f)).map((i) => i.name) : []

  return (
    <li>
      <Link to={`/${venue.college.slug}#${venue.slug}`} className="-mx-3 flex items-start gap-4 rounded-md px-3 py-4 transition-colors hover:bg-white/5">
        <div className="min-w-0 flex-1">
          <p className="truncate">
            <span className="font-medium">{venue.college.short_name ?? venue.college.name}</span>
            <span className="ml-2 text-white/50">{venue.name}</span>
          </p>
          {dishes.length > 0 && <p className="mt-1 truncate text-sm text-white/50">{dishes.slice(0, 3).join(' · ')}</p>}
        </div>
        <StatusText s={r.status} now={now} />
      </Link>
    </li>
  )
}

function StatusText({ s, now }: { s: OpenStatus; now: LocalNow }) {
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

const chipClass = (active: boolean) =>
  `shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
    active ? 'border-white bg-white text-charcoal' : 'border-white/15 text-white/70 hover:border-white/40 hover:text-white'
  }`

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={chipClass(active)}>
      {children}
    </button>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" className="size-5 shrink-0 text-white/40">
      <circle cx="8.5" cy="8.5" r="5.75" />
      <path d="m13 13 4.5 4.5" strokeLinecap="round" />
    </svg>
  )
}
