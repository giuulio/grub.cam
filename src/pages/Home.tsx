import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { Card, ChevronDown, CloseCircle, Pin, Search, Users, type IconComponent } from 'reicon-react'
import { Icon } from '../components/Icon.tsx'
import { VenueCard } from '../components/VenueCard.tsx'
import { useReady } from '../lib/data.tsx'
import { TYPE_ICON } from '../lib/icons.ts'
import type { DietTag, Meal, Site, VenueType } from '../lib/types.ts'
import { applyFilters, DEFAULT_FILTERS, dishMatches, DIET_LABEL, MEAL_LABEL, nextService, SECTION_LABEL, SECTIONS, sectionOf, type Filters, type Ranked } from '../lib/filters.ts'
import { SITE_NAME } from '../lib/site.ts'
import { useNow } from '../lib/useNow.ts'
import type { LocalNow } from '../lib/time/clock.ts'

const TYPE_CHIPS: [VenueType, string][] = [
  ['hall', 'Dining'],
  ['cafe', 'Cafés'],
  ['bar', 'Bars'],
]
// Only dining venues have meal times, menus and diet tags, so these filters appear (and apply) only with Dining picked.
const HALL_MEALS: Meal[] = ['breakfast', 'brunch', 'lunch', 'dinner']
const DIET_CHIPS: DietTag[] = ['vegetarian', 'vegan', 'halal', 'gluten_free']
// Without a search, places that aren't open today wait behind "Show more" (?more keeps them shown on the way back).
const FOLDED = new Set(['other', 'unknown'])

// All filter state lives in the URL (?q=&type=hall&site=jesus&guests=1&card=1&meal=lunch&diet=vegan,halal) so a search can be shared.
function readFilters(p: URLSearchParams, date: string, sites: Site[]): Filters {
  const type = TYPE_CHIPS.find(([t]) => t === p.get('type'))?.[0]
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
  const filtered = [...params.keys()].some((k) => k !== 'more')

  const groups = SECTIONS.map((section) => ({ section, rows: results.filter((r) => sectionOf(r.status) === section) })).filter((g) => g.rows.length)
  const fold = !f.q.trim() && !params.has('more') && groups.some((g) => !FOLDED.has(g.section))
  const shown = fold ? groups.filter((g) => !FOLDED.has(g.section)) : groups
  const hidden = results.length - shown.reduce((n, g) => n + g.rows.length, 0)

  const update = (fn: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params)
    fn(next)
    setParams(next, { replace: true })
  }
  const set = (key: string, value?: string) => update((p) => (value ? p.set(key, value) : p.delete(key)))
  const toggle = (key: string) => set(key, params.has(key) ? undefined : '1')
  const toggleType = (type: VenueType) =>
    update((p) => {
      if (f.type === type) p.delete('type')
      else p.set('type', type)
      // Meal and diet only apply to dining
      if (f.type === 'hall' || type !== 'hall') ['meal', 'diet'].forEach((k) => p.delete(k))
    })
  const toggleDiet = (tag: DietTag) => set('diet', (f.diets.includes(tag) ? f.diets.filter((d) => d !== tag) : [...f.diets, tag]).join(','))

  return (
    <>
      <title>{SITE_NAME}</title>
      <div className="sticky top-16 z-10 -mx-4 bg-charcoal px-4 pt-2 pb-4 sm:-mx-6 sm:px-6">
        <label className="flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-white/40 focus-within:border-white/40">
          <Icon of={Search} className="size-5" />
          <input
            type="search"
            value={f.q}
            onChange={(e) => set('q', e.target.value)}
            placeholder="Search places or dishes"
            aria-label="Search places or dishes"
            className="w-full bg-transparent text-white outline-none placeholder:text-white/40"
          />
        </label>

        <ChipRow>
          {TYPE_CHIPS.map(([type, label]) => (
            <Chip key={type} icon={TYPE_ICON[type]} active={f.type === type} onClick={() => toggleType(type)}>
              {label}
            </Chip>
          ))}
          <SelectChip icon={Pin} label="College or site" value={f.site ?? ''} onChange={(v) => set('site', v)}>
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
          <Chip icon={Users} active={f.nonMemberOk} onClick={() => toggle('guests')}>
            Guests
          </Chip>
          <Chip icon={Card} active={f.bankCard} onClick={() => toggle('card')}>
            Card
          </Chip>
          {filtered && (
            <button type="button" onClick={() => setParams({}, { replace: true })} className="flex shrink-0 cursor-pointer items-center gap-1.5 px-2 py-1.5 text-sm text-white/50 hover:text-white">
              <Icon of={CloseCircle} />
              Clear
            </button>
          )}
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

      {!results.length && <p className="mt-6 text-white/50">Nothing matches.</p>}
      {shown.map((g) => (
        <section key={g.section} aria-labelledby={`section-${g.section}`} className="mt-6">
          <h2 id={`section-${g.section}`} className="flex items-baseline justify-between pb-2 text-sm text-white/40">
            {SECTION_LABEL[g.section]}
            <span className="tabular-nums">{g.rows.length}</span>
          </h2>
          <ul className="divide-y divide-white/10 border-t border-white/10">
            {g.rows.map((r) => (
              <ResultRow key={r.venue.id} r={r} f={f} now={now} />
            ))}
          </ul>
        </section>
      ))}
      {fold && hidden > 0 && (
        <button type="button" onClick={() => set('more', '1')} className="mt-4 flex cursor-pointer items-center gap-1.5 text-sm text-white/50 hover:text-white">
          <Icon of={ChevronDown} />
          {hidden} more
        </button>
      )}
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
  `flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
    active ? 'border-white bg-white text-charcoal' : 'border-white/15 text-white/70 hover:border-white/40 hover:text-white'
  }`

function Chip({ icon, active, onClick, children }: { icon?: IconComponent; active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={chipClass(active)}>
      {icon && <Icon of={icon} />}
      {children}
    </button>
  )
}

/** A native select styled as a chip; an option with value '' means "any". */
function SelectChip({ icon, label, value, onChange, children }: { icon?: IconComponent; label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <span className={`relative shrink-0 ${value ? 'text-charcoal' : 'text-white/70'}`}>
      {icon && (
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
          <Icon of={icon} />
        </span>
      )}
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={`${chipClass(!!value)} appearance-none pr-8 ${icon ? 'pl-8' : ''}`}>
        {children}
      </select>
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
        <Icon of={ChevronDown} className="size-3.5" />
      </span>
    </span>
  )
}
