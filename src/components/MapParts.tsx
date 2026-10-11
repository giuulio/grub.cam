import type { RefObject } from 'react'
import { TYPE_LABEL, type Ranked } from '../lib/filters.ts'
import type { Point } from '../lib/map.ts'
import { pinFill } from '../lib/mapView.ts'
import { venueTypes } from '../lib/types.ts'

// What both maps share (Apple's, `AppleMap.tsx`, and the OpenFreeMap one in `VenueMap.tsx`): their props, the pins,
// and Near me / Show all; how they frame the venues is in `lib/mapView.ts`.

/**
 * `panel`: what covers part of the map (a list down its left side, or a sheet at its foot on a phone): a picked pin is
 * moved clear of it. `highlight`: venues drawn as picked without being picked, as a list does for the row under the
 * pointer. `inset`: what sits over the map's edges (a list on the left, filters along the top), kept clear when it fits
 * the venues in. `here`: where you are, when you've asked for nearest first, shown and moved to. `controls`: its own
 * Near me and Show all, for a map with nothing else to do that. `core`: fit the main cluster (central Cambridge: the
 * venues within 1.5 km of the middle of them all) rather than every outlier, for a list nothing has narrowed yet.
 * `maxZoom`: the closest fitting the venues zooms in: streets around a city-wide list (15), a college's grounds for a
 * site's few venues (17). `focus`: a venue to centre on at `maxZoom` instead of fitting them all, for a venue's own
 * page, where the others are context. `embedded`: a small map inside a page that scrolls, so the wheel scrolls the
 * page, not the map (the zoom buttons and pinching still zoom). `onBackground`: a click on the map itself, not a pin
 * (to let go of the picked one).
 */
export type MapProps = { results: Ranked[]; selected?: string; highlight?: string[]; onSelect: (id: string) => void; onBackground?: () => void; filtered?: boolean; panel?: RefObject<HTMLElement | null>; inset?: { top?: number; left?: number }; here?: Point; controls?: boolean; core?: boolean; maxZoom?: number; focus?: string; embedded?: boolean }

/** A venue's pin: a disc in its type's colour (or its two types'). Venues side by side get narrower targets so none overlap. */
export function MapPin({ r, selected, shared, onSelect }: { r: Ranked; selected: boolean; shared: boolean; onSelect: (id: string) => void }) {
  const v = r.venue
  const types = venueTypes(v)
  const label = `${v.site.short_name ?? v.site.name}: ${v.name} (${types.map((t) => TYPE_LABEL[t]).join(' and ')}${r.status.kind === 'open' ? ', open now' : ''})`
  return (
    <button type="button" className={`venue-pin-target ${shared ? 'is-shared' : ''}`} title={label} aria-label={label} aria-pressed={selected}
      onClick={(event) => { event.stopPropagation(); onSelect(v.id) }}>
      <span className={`venue-pin ${selected ? 'is-selected' : ''}`} style={{ background: pinFill(types) }} />
    </button>
  )
}

/** Near me and Show all, for a map with nothing else to do that (`controls`), and what went wrong. */
export function MapActions({ controls, ready, locating, canShowAll, onLocate, onShowAll, note }: { controls: boolean; ready: boolean; locating: boolean; canShowAll: boolean; onLocate: () => void; onShowAll: () => void; note: string }) {
  return (
    <div className="map-actions absolute top-4 left-4 z-500 max-w-[calc(100%-5rem)]">
      {controls && (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!ready || locating} onClick={onLocate} className="btn raised h-9 px-3.5 font-normal sm:h-9">{locating ? 'Finding you…' : 'Near me'}</button>
          <button type="button" disabled={!ready || !canShowAll} onClick={onShowAll} className="btn raised h-9 px-3.5 font-normal sm:h-9">Show all</button>
        </div>
      )}
      {note && <p role="status" className="raised mt-2 max-w-xs rounded-lg px-4 py-3 text-sm text-ink">{note}</p>}
    </div>
  )
}
