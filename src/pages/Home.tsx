import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { VenueCard } from '../components/VenueCard.tsx'
import { useReady } from '../lib/data.tsx'
import type { DietTag, Meal, Site, VenueType } from '../lib/types.ts'
import { applyFilters, DEFAULT_FILTERS, dishMatches, DIET_LABEL, MEAL_LABEL, nextService, type Filters, type Ranked } from '../lib/filters.ts'
import { SITE_NAME } from '../lib/site.ts'
import { useNow } from '../lib/useNow.ts'
import type { LocalNow } from '../lib/time/clock.ts'

const TYPE_TABS: [VenueType | undefined, string][] = [
  [undefined, 'All'],
  ['hall', 'Dining'],
  ['cafe', 'Cafés'],
  ['bar', 'Bars'],
]
// Only dining venues have meal times, menus and diet tags, so these filters appear (and apply) only with Dining picked.
const HALL_MEALS: Meal[] = ['breakfast', 'brunch', 'lunch', 'dinner']
const DIET_CHIPS: DietTag[] = ['vegetarian', 'vegan', 'halal', 'gluten_free']

// All filter state lives in the URL (?q=&type=hall&site=jesus&open=1&guests=1&card=1&meal=lunch&diet=vegan,halal) so a search can be shared.
function readFilters(p: URLSearchParams, date: string, sites: Site[]): Filters {
  const type = TYPE_TABS.find(([t]) => t && t === p.get('type'))?.[0]
  const site = sites.find((s) => s.slug === p.get('site'))?.slug
  const meal = HALL_MEALS.find((m) => m === p.get('meal'))
  const diets = (p.get('diet')?.split(',') ?? []).filter((d): d is DietTag => DIET_CHIPS.includes(d as DietTag))
  return {
    ...DEFAULT_FILTERS,
    date,
    q: p.get('q') ?? '',
    type,
    site,
    meal: type === 'hall' ? meal : undefined,
    diets: type === 'hall' ? diets : [],
    openNow: p.has('open'),
    nonMemberOk: p.has('guests'),
    bankCard: p.has('card'),
  }
}

export function Home() {
  const { sites, venues } = useReady()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const f = readFilters(params, now.date, sites)
  const results = applyFilters(venues, f, now)
  const active = params.toString() !== ''

  const update = (fn: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params)
    fn(next)
    setParams(next, { replace: true })
  }
  const set = (key: string, value?: string) => update((p) => (value ? p.set(key, value) : p.delete(key)))
  const toggle = (key: string) => set(key, params.has(key) ? undefined : '1')
  const setType = (type?: VenueType) =>
    update((p) => {
      if (type) p.set('type', type)
      else p.delete('type')
      if (type !== 'hall') ['meal', 'diet'].forEach((k) => p.delete(k))
    })
  const toggleDiet = (tag: DietTag) => {
    const diets = f.diets.includes(tag) ? f.diets.filter((d) => d !== tag) : [...f.diets, tag]
    set('diet', diets.join(','))
  }

  return (
    <>
      <title>{SITE_NAME}</title>
      <div className="sticky top-16 z-10 -mx-4 bg-charcoal px-4 pt-2 pb-4 sm:-mx-6 sm:px-6">
        <label className="flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-5 py-3 focus-within:border-white/40">
          <SearchIcon />
          <input
            type="search"
            value={f.q}
            onChange={(e) => set('q', e.target.value)}
            placeholder="Search colleges, cafés or dishes"
            aria-label="Search colleges, cafés or dishes"
            className="w-full bg-transparent text-white outline-none placeholder:text-white/40"
          />
        </label>

        <ChipRow>
          <div role="group" aria-label="Type" className="flex shrink-0 rounded-full border border-white/15 p-0.5 text-sm">
            {TYPE_TABS.map(([type, label]) => (
              <button
                key={label}
                type="button"
                aria-pressed={f.type === type}
                onClick={() => setType(type)}
                className={`cursor-pointer rounded-full px-3 py-1 transition-colors ${f.type === type ? 'bg-white text-charcoal' : 'text-white/70 hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <SelectChip label="College or site" value={f.site ?? ''} onChange={(v) => set('site', v)}>
            <option value="">Everywhere</option>
            {(['college', 'university'] as const).map((kind) => (
              <optgroup key={kind} label={kind === 'college' ? 'Colleges' : 'University'}>
                {sites
                  .filter((s) => s.kind === kind)
                  .map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.short_name ?? s.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </SelectChip>
        </ChipRow>

        <ChipRow>
          <Chip active={f.openNow} onClick={() => toggle('open')}>
            Open now
          </Chip>
          <Chip active={f.nonMemberOk} onClick={() => toggle('guests')}>
            Guests welcome
          </Chip>
          <Chip active={f.bankCard} onClick={() => toggle('card')}>
            Bank card
          </Chip>
        </ChipRow>

        {f.type === 'hall' && (
          <ChipRow>
            <SelectChip label="Meal" value={f.meal ?? ''} onChange={(v) => set('meal', v)}>
              <option value="">Any meal</option>
              {HALL_MEALS.map((m) => (
                <option key={m} value={m}>
                  {MEAL_LABEL[m]}
                </option>
              ))}
            </SelectChip>
            {DIET_CHIPS.map((tag) => (
              <Chip key={tag} active={f.diets.includes(tag)} onClick={() => toggleDiet(tag)}>
                {DIET_LABEL[tag]}
              </Chip>
            ))}
          </ChipRow>
        )}
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
  // When searching or filtering by diet, show which dishes matched; otherwise what's on at the next service.
  const dishes = f.q.trim() || f.diets.length ? r.days.flatMap((d) => d.items).filter((i) => dishMatches(i, f)) : (nextService(r)?.items ?? [])
  // With one site picked, lead with the venue
  return <VenueCard venue={r.venue} status={r.status} now={now} dishes={dishes.map((i) => i.name)} showSite={!f.site} />
}

/** One line of filters: scrolls sideways on phones, wraps on wider screens. */
function ChipRow({ children }: { children: ReactNode }) {
  return <div className="-mx-4 mt-3 flex items-center gap-2 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">{children}</div>
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

/** A native select styled as a chip; an option with value '' means "any". */
function SelectChip({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <span className={`relative shrink-0 ${value ? 'text-charcoal' : 'text-white/70'}`}>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={`${chipClass(!!value)} appearance-none pr-8`}>
        {children}
      </select>
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-3 -translate-y-1/2">
        <path d="m3 4.5 3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
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
