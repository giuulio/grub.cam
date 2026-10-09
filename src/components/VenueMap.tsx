import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type * as MapLibre from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { hasLocation } from '../lib/explore.ts'
import { TYPE_LABEL, type Ranked } from '../lib/filters.ts'
import { sideBySide } from '../lib/map.ts'
import { bindSafariPinch } from '../lib/mapGestures.ts'
import type { VenueType } from '../lib/types.ts'

type Props = { results: Ranked[]; selected?: string; onSelect: (id: string) => void; snapshot?: boolean; filtered?: boolean }
type Pin = { el: HTMLDivElement; marker: MapLibre.Marker }
type Engine = { M: typeof MapLibre; map: MapLibre.Map; pins: Map<string, Pin>; user?: MapLibre.Marker }
const TYPE_ORDER: VenueType[] = ['hall', 'cafe', 'bar']
const CAMBRIDGE: [number, number] = [0.117, 52.205]
const position = (r: Ranked): [number, number] => [r.venue.longitude!, r.venue.latitude!]
const fitPadding = (map: MapLibre.Map) => {
  if (window.innerWidth >= 640) return 60
  const container = map.getContainer()
  const controlsHeight = parseFloat(getComputedStyle(container).getPropertyValue('--explore-controls-height')) || 110
  return { top: Math.min(controlsHeight + 85, container.clientHeight * 0.45), bottom: 90, left: 44, right: 44 }
}

export function VenueMap({ results, selected, onSelect, snapshot, filtered }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const engine = useRef<Engine | null>(null)
  const fitKey = useRef('')
  const [ready, setReady] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [locating, setLocating] = useState(false)
  const [locationNote, setLocationNote] = useState('')
  const [anchors, setAnchors] = useState<Map<string, HTMLDivElement>>(() => new Map())

  useEffect(() => {
    let disposed = false
    let observer: ResizeObserver | undefined
    let unbindPinch: (() => void) | undefined
    let unbindTheme: (() => void) | undefined
    void import('maplibre-gl').then((M) => {
      if (disposed || !container.current) return
      M.setWorkerUrl(workerUrl)
      const media = window.matchMedia('(prefers-color-scheme: dark)')
      const resolvedTheme = () => document.documentElement.dataset.theme === 'dark' || !document.documentElement.dataset.theme && media.matches ? 'dark' : 'light'
      const styleFor = (theme: 'light' | 'dark') => (theme === 'dark' ? import.meta.env.VITE_MAP_DARK_STYLE_URL : import.meta.env.VITE_MAP_LIGHT_STYLE_URL) || import.meta.env.VITE_MAP_STYLE_URL || `https://tiles.openfreemap.org/styles/${theme === 'dark' ? 'fiord' : 'bright'}`
      let style = styleFor(resolvedTheme())
      container.current.dataset.mapTheme = resolvedTheme()
      const map = new M.Map({
        container: container.current,
        style,
        center: CAMBRIDGE, zoom: 13, minZoom: 9, maxZoom: 19,
        // This page is primarily a map: wheel/trackpad and touch gestures act directly on it.
        scrollZoom: true, touchZoomRotate: true, cooperativeGestures: false,
        dragRotate: false, touchPitch: false, pitchWithRotate: false,
        attributionControl: false,
      })
      engine.current = { M, map, pins: new Map() }
      map.touchZoomRotate.disableRotation()
      map.keyboard.disableRotation()
      map.addControl(new M.NavigationControl({ showCompass: false }), 'top-right')
      map.addControl(new M.AttributionControl({ compact: true }), 'bottom-right')
      map.getCanvas().setAttribute('aria-label', 'Food and drink in Cambridge. Drag to pan; scroll or pinch to zoom. Use arrow keys to pan, plus and minus to zoom.')
      map.on('load', () => { if (!disposed) { setLoaded(true); setError('') } })
      map.on('error', () => { if (!disposed) setError('The map couldn’t fully load. You can still use the list.') })
      const syncTheme = () => {
        const theme = resolvedTheme()
        if (container.current) container.current.dataset.mapTheme = theme
        const next = styleFor(theme)
        if (style === next) return
        style = next
        setError('')
        map.setStyle(style)
      }
      const themeObserver = new MutationObserver(syncTheme)
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
      media.addEventListener('change', syncTheme)
      unbindTheme = () => { themeObserver.disconnect(); media.removeEventListener('change', syncTheme) }
      if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        unbindPinch = bindSafariPinch(map.getCanvasContainer(), {
          getZoom: () => map.getZoom(), stop: () => { map.stop() },
          zoomAround: (zoom, x, y) => {
            const rect = map.getCanvas().getBoundingClientRect()
            map.zoomTo(Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), zoom)), {
              around: map.unproject([x - rect.left, y - rect.top]), duration: 0,
            })
          },
        })
      }
      observer = new ResizeObserver(() => map.resize())
      observer.observe(container.current)
      setReady(true)
    }).catch(() => { if (!disposed) setError('The map couldn’t load. You can still use the list.') })
    return () => {
      disposed = true
      observer?.disconnect()
      unbindPinch?.()
      unbindTheme?.()
      engine.current?.map.remove()
      engine.current = null
    }
  }, [])

  // One marker per place, kept while it stays in the results; places sharing a coordinate sit side by side.
  const mapped = results.filter((r) => hasLocation(r.venue)).sort((a, b) => TYPE_ORDER.indexOf(a.venue.type) - TYPE_ORDER.indexOf(b.venue.type) || a.venue.name.localeCompare(b.venue.name) || a.venue.id.localeCompare(b.venue.id))
  const offsets = sideBySide(mapped.map((r) => ({ id: r.venue.id, latitude: r.venue.latitude!, longitude: r.venue.longitude! })))
  const key = mapped.map((r) => r.venue.id).join('|')
  const places = useRef({ mapped, offsets })
  useEffect(() => { places.current = { mapped, offsets } }, [mapped, offsets])
  useEffect(() => {
    const e = engine.current
    if (!ready || !e) return
    const { mapped, offsets } = places.current
    const next = new Map<string, Pin>()
    for (const r of mapped) {
      const pin = e.pins.get(r.venue.id) ?? (() => {
        const el = document.createElement('div')
        el.className = 'venue-pin-anchor'
        return { el, marker: new e.M.Marker({ element: el, anchor: 'center' }).setLngLat(position(r)).addTo(e.map) }
      })()
      pin.marker.setOffset(offsets.get(r.venue.id) ?? [0, 0])
      next.set(r.venue.id, pin)
    }
    for (const [id, pin] of e.pins) if (!next.has(id)) pin.marker.remove()
    e.pins = next
    setAnchors(new Map([...next].map(([id, pin]) => [id, pin.el])))
  }, [ready, key]) // `key` names the mapped places, so their offsets too

  useEffect(() => {
    const e = engine.current
    if (!ready || !e) return
    const { mapped } = places.current
    const fit = `${!!filtered}:${key}`
    if (fit === fitKey.current) return
    fitKey.current = fit
    if (filtered && mapped.length) e.map.fitBounds(mapped.reduce((b, r) => b.extend(position(r)), new e.M.LngLatBounds()), { padding: fitPadding(e.map), maxZoom: 15, duration: 0 })
    if (!filtered) e.map.jumpTo({ center: CAMBRIDGE, zoom: 13 })
  }, [ready, key, filtered]) // refit only when the matching places change

  // The selected place's pin sits above its neighbours.
  useEffect(() => { anchors.forEach((el, id) => { el.style.zIndex = id === selected ? '1' : '' }) }, [anchors, selected])

  useEffect(() => {
    const e = engine.current
    const row = results.find((r) => r.venue.id === selected)
    if (!e || !row || !hasLocation(row.venue)) return
    const point = e.map.project(position(row))
    const { clientWidth: width, clientHeight: height } = e.map.getContainer()
    if (point.x < 75 || point.x > width - 75 || point.y < 75 || point.y > height - 75) e.map.easeTo({ center: position(row), duration: 250 })
  }, [ready, results, selected])

  const locate = () => {
    if (!navigator.geolocation) { setLocationNote('Your browser doesn’t support location.'); return }
    setLocating(true)
    setLocationNote('')
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setLocating(false)
      const e = engine.current
      if (!e) return
      if (coords.latitude < 52.14 || coords.latitude > 52.26 || coords.longitude < -0.01 || coords.longitude > 0.2) {
        setLocationNote('You’re outside Cambridge. Move the map to explore places here.')
        return
      }
      e.user?.remove()
      const dot = document.createElement('span')
      dot.className = 'map-user-location'
      dot.setAttribute('aria-label', 'Your location')
      e.user = new e.M.Marker({ element: dot }).setLngLat([coords.longitude, coords.latitude]).addTo(e.map)
      e.map.easeTo({ center: [coords.longitude, coords.latitude], zoom: 15, duration: 300 })
    }, (err) => {
      setLocating(false)
      setLocationNote(err.code === 1 ? 'Location access was denied. You can move the map instead.' : 'Couldn’t find your location. Try again or move the map.')
    }, { timeout: 10000, maximumAge: 60000 })
  }

  return (
    <>
      <div ref={container} className="venue-map" aria-label="Map of food and drink in Cambridge" />
      {mapped.map((r) => {
        const el = anchors.get(r.venue.id)
        return el && createPortal(<MapPin r={r} selected={r.venue.id === selected} open={!snapshot && r.status.kind === 'open'} shared={offsets.has(r.venue.id)} onSelect={onSelect} />, el, r.venue.id)
      })}
      {!loaded && !error && <p className="pointer-events-none absolute top-1/2 right-0 left-0 z-[400] text-center text-sm text-muted">Loading map…</p>}
      <div className="map-actions absolute top-4 left-4 z-[500] max-w-[calc(100%-5rem)]">
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!ready || locating} onClick={locate} className="map-action disabled:opacity-60">{locating ? 'Finding you…' : 'Near me'}</button>
          <button type="button" disabled={!ready || !results.some((r) => hasLocation(r.venue))} onClick={() => {
            const e = engine.current
            if (e) {
              const bounds = results.filter((r) => hasLocation(r.venue)).reduce((b, r) => b.extend(position(r)), new e.M.LngLatBounds())
              e.map.fitBounds(bounds, { padding: fitPadding(e.map), maxZoom: 15, duration: 300 })
            }
          }} className="map-action disabled:opacity-60">Show all</button>
        </div>
        {(error || locationNote) && <p role="status" className="mt-2 max-w-xs rounded-xl bg-canvas px-4 py-3 text-sm text-ink shadow-sm">{error || locationNote}</p>}
      </div>
    </>
  )
}

/** A place's pin: a dot in its type's colour, filled while it's open now. Places side by side get narrower targets so none overlap. */
function MapPin({ r, selected, open, shared, onSelect }: { r: Ranked; selected: boolean; open: boolean; shared: boolean; onSelect: (id: string) => void }) {
  const v = r.venue
  const label = `${v.site.short_name ?? v.site.name}: ${v.name} (${TYPE_LABEL[v.type]}${open ? ', open now' : ''})`
  return (
    <button type="button" className={`venue-pin-target ${shared ? 'is-shared' : ''}`} title={label} aria-label={label} aria-pressed={selected}
      onClick={(event) => { event.stopPropagation(); onSelect(v.id) }}>
      <span className={`venue-pin ${selected ? 'is-selected' : ''} ${open ? 'is-open' : ''}`} data-type={v.type} />
    </button>
  )
}
