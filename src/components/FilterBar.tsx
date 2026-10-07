import type { DietTag, Meal, VenueType } from '../lib/data/types.ts'
import { DIET_LABEL, DIETS, MEAL_LABEL, MEALS, TYPE_LABEL, type Filters } from '../lib/filters.ts'
import { addDaysISO, formatISODate, type LocalNow } from '../lib/time/clock.ts'

type Props = { filters: Filters; onChange: (patch: Partial<Filters>) => void; now: LocalNow; resultCount: number }

function Chip({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? 'border-grub-600 bg-grub-600 text-white'
          : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300'
      }`}
    >
      {children}
    </button>
  )
}

export function FilterBar({ filters: f, onChange, now, resultCount }: Props) {
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const dates = [0, 1, 2, 3, 4, 5, 6].map((i) => addDaysISO(now.date, i))
  return (
    <div className="sticky top-0 z-10 -mx-3 space-y-2 border-b border-stone-200 bg-stone-50/95 px-3 py-3 backdrop-blur sm:-mx-6 sm:px-6 dark:border-stone-800 dark:bg-stone-950/95">
      <div className="flex gap-2">
        <input
          type="search"
          value={f.q}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder="Search colleges, venues, dishes…"
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-grub-500 dark:border-stone-700 dark:bg-stone-900"
        />
        <select
          value={f.date}
          onChange={(e) => onChange({ date: e.target.value })}
          className="rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
          aria-label="Day"
        >
          {dates.map((d, i) => (
            <option key={d} value={d}>
              {i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : formatISODate(d)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip active={!f.meal} onClick={() => onChange({ meal: undefined })}>
          Any meal
        </Chip>
        {MEALS.map((m: Meal) => (
          <Chip key={m} active={f.meal === m} onClick={() => onChange({ meal: f.meal === m ? undefined : m })}>
            {MEAL_LABEL[m]}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip active={f.openNow} onClick={() => onChange({ openNow: !f.openNow })} title="Only venues serving right now">
          Open now
        </Chip>
        {DIETS.map((d: DietTag) => (
          <Chip key={d} active={f.diets.includes(d)} onClick={() => onChange({ diets: toggle(f.diets, d) })}>
            {DIET_LABEL[d]}
          </Chip>
        ))}
        <span className="mx-1 hidden self-center text-stone-300 sm:inline">|</span>
        <Chip active={f.nonMemberOk} onClick={() => onChange({ nonMemberOk: !f.nonMemberOk })} title="Open to members of other colleges or the public">
          I'm not a member
        </Chip>
        <Chip active={f.bankCard} onClick={() => onChange({ bankCard: !f.bankCard })}>
          Bank card
        </Chip>
        <Chip active={f.liveMenu} onClick={() => onChange({ liveMenu: !f.liveMenu })}>
          Has menu
        </Chip>
        {(['hall', 'cafe', 'bar'] as VenueType[]).map((t) => (
          <Chip key={t} active={f.types.includes(t)} onClick={() => onChange({ types: toggle(f.types, t) })}>
            {TYPE_LABEL[t]}
          </Chip>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-stone-500">
        <span>
          {resultCount} venue{resultCount === 1 ? '' : 's'} · {formatISODate(now.date, { weekday: 'long', day: 'numeric', month: 'long' })}, {String(Math.floor(now.minutes / 60)).padStart(2, '0')}:{String(now.minutes % 60).padStart(2, '0')} Cambridge time
        </span>
        <button type="button" className="hover:underline" onClick={() => onChange({ meal: undefined, diets: [], types: [], nonMemberOk: false, bankCard: false, liveMenu: false, openNow: false, q: '', date: now.date })}>
          Reset
        </button>
      </div>
    </div>
  )
}
