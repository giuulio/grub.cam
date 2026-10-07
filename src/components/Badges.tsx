import type { DietTag, Provenance, VenueType } from '../lib/data/types.ts'
import { DIET_LABEL, DIET_SHORT, TYPE_LABEL } from '../lib/filters.ts'

export function DietTags({ tags, compact = true }: { tags: DietTag[]; compact?: boolean }) {
  if (!tags.length) return null
  const shown = tags.filter((t) => (t !== 'plant_based' || !tags.includes('vegan')) && (t !== 'vegetarian' || !tags.includes('vegan')))
  return (
    <span className="inline-flex flex-wrap gap-1">
      {shown.map((t) => (
        <span key={t} title={DIET_LABEL[t]} className={`rounded px-1.5 py-0.5 text-[11px] font-semibold leading-none ${color(t)}`}>
          {compact ? DIET_SHORT[t] : DIET_LABEL[t]}
        </span>
      ))}
    </span>
  )
}

function color(t: DietTag) {
  switch (t) {
    case 'vegan':
    case 'plant_based':
      return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200'
    case 'vegetarian':
      return 'bg-lime-100 text-lime-800 dark:bg-lime-900/50 dark:text-lime-200'
    case 'halal':
      return 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200'
    case 'gluten_free':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
    default:
      return 'bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-200'
  }
}

export function TypeChip({ type }: { type: VenueType }) {
  return <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-medium text-stone-700 dark:bg-stone-800 dark:text-stone-300">{TYPE_LABEL[type]}</span>
}

export function ProvenanceBadge({ prov, label }: { prov?: Provenance; label?: string }) {
  if (!prov) return null
  const text =
    prov.source_kind === 'official'
      ? prov.observed_at
        ? `official, checked ${fmt(prov.observed_at)}`
        : 'official'
      : prov.source_kind === 'reported'
        ? `reported ${prov.observed_at?.slice(0, 4) ?? ''}`.trim()
        : prov.source_kind === 'google_maps'
          ? 'Google Maps'
          : prov.source_kind === 'lead'
            ? 'unconfirmed'
            : prov.source_kind === 'unknown'
              ? 'unknown'
              : prov.source_kind
  const tone = prov.confidence === 'high' ? 'text-green-700 dark:text-green-300' : prov.confidence === 'medium' ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300'
  return (
    <span className={`text-[11px] ${tone}`} title={prov.note}>
      {label ? `${label}: ` : ''}
      {text}
    </span>
  )
}

function fmt(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: y === new Date().getFullYear() ? undefined : 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)))
}
