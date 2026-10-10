import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type * as MapLibre from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { hasLocation } from '../lib/finder.ts'
import { TYPE_LABEL, type Ranked } from '../lib/filters.ts'
import { metresBetween, sideBySide, type Point } from '../lib/map.ts'
import { bindSafariPinch } from '../lib/mapGestures.ts'
import { venueTypes, type VenueType } from '../lib/types.ts'

/**
 * `panel`: what covers part of the map (a list down its left side, or a sheet at its foot on a phone): a picked pin is
 * moved clear of it. `highlight`: venues drawn as picked without being picked, as a list does for the row under the
 * pointer. `inset`: what sits over the map's edges (a list on the left, filters along the top), kept clear when it fits
 * the venues in. `here`: where you are, when you've asked for nearest first, shown and moved to. `controls`: its own
 * Near me and Show all, for a map with nothing else to do that. `core`: fit the main cluster (central Cambridge: the
 * venues within 1.5 km of the middle of them all) rather than every outlier, for a list nothing has narrowed yet.
 */
type Props = { results: Ranked[]; selected?: string; highlight?: string[]; onSelect: (id: string) => void; filtered?: boolean; panel?: RefObject<HTMLElement | null>; inset?: { top?: number; left?: number }; here?: Point; controls?: boolean; core?: boolean }
type Pin = { el: HTMLDivElement; marker: MapLibre.Marker }
type Engine = { M: typeof MapLibre; map: MapLibre.Map; pins: Map<string, Pin>; user?: MapLibre.Marker }
const TYPE_ORDER: VenueType[] = ['hall', 'cafe', 'bar']
const CAMBRIDGE: [number, number] = [0.117, 52.205]
/**
 * The widest view: Dry Drayton to Teversham, Histon to Trumpington, every venue well inside. The map never zooms out
 * past fitting it (the minimum zoom follows the map's size), so a phone still sees all of it across.
 */
const REACH: [[number, number], [number, number]] = [[0.0103, 52.1664], [0.2179, 52.2534]]
const position = (r: Ranked): [number, number] => [r.venue.longitude!, r.venue.latitude!]
// On a phone, clear of Near me and Show all above and the list button below; wider, clear of what sits over the map
const fitPadding = (inset: Props['inset'] = {}) => (window.innerWidth >= 640 ? { top: 60 + (inset.top ?? 0), left: 60 + (inset.left ?? 0), right: 60, bottom: 60 } : { top: 70, bottom: 90, left: 44, right: 44 })

export function VenueMap({ results, selected, highlight, onSelect, filtered, panel, inset, here, controls = true, core = false }: Props) {
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
        center: CAMBRIDGE, zoom: 13, minZoom: 10, maxZoom: 19,
        // This page is primarily a map: wheel/trackpad and touch gestures act directly on it.
        scrollZoom: true, touchZoomRotate: true, cooperativeGestures: false,
        dragRotate: false, touchPitch: false, pitchWithRotate: false,
        attributionControl: false,
      })
      engine.current = { M, map, pins: new Map() }
      // Never zoom out past fitting REACH at the map's current size
      const limitZoom = () => {
        const zoom = map.cameraForBounds(REACH)?.zoom
        if (zoom != null && Number.isFinite(zoom)) map.setMinZoom(zoom)
      }
      limitZoom()
      map.on('resize', limitZoom)
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

  // One marker per venue, kept while it stays in the results; venues sharing a coordinate sit side by side.
  const mapped = results.filter((r) => hasLocation(r.venue)).sort((a, b) => TYPE_ORDER.indexOf(a.venue.type) - TYPE_ORDER.indexOf(b.venue.type) || a.venue.name.localeCompare(b.venue.name) || a.venue.id.localeCompare(b.venue.id))
  const offsets = sideBySide(mapped.map((r) => ({ id: r.venue.id, latitude: r.venue.latitude!, longitude: r.venue.longitude! })))
  const key = mapped.map((r) => r.venue.id).join('|')
  const pins = useRef({ mapped, offsets })
  useEffect(() => { pins.current = { mapped, offsets } }, [mapped, offsets])
  useEffect(() => {
    const e = engine.current
    if (!ready || !e) return
    const { mapped, offsets } = pins.current
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
  }, [ready, key]) // `key` names the mapped venues, so their offsets too

  useEffect(() => {
    const e = engine.current
    if (!ready || !e) return
    const { mapped } = pins.current
    const fit = `${!!filtered}:${core}:${key}`
    if (fit === fitKey.current) return
    fitKey.current = fit
    const framed = core ? mainCluster(mapped) : mapped
    if (filtered && framed.length) e.map.fitBounds(framed.reduce((b, r) => b.extend(position(r)), new e.M.LngLatBounds()), { padding: fitPadding(inset), maxZoom: 15, duration: 0 })
    if (!filtered) e.map.jumpTo({ center: CAMBRIDGE, zoom: 13 })
  }, [ready, key, filtered, core, inset]) // refit only when the matching venues change (fitKey ignores the rest)

  // The selected venue's pin sits above its neighbours, as do highlighted ones.
  const lit = (id: string) => id === selected || !!highlight?.includes(id)
  const litKey = highlight?.join('|')
  useEffect(() => { anchors.forEach((el, id) => { el.style.zIndex = id === selected || litKey?.split('|').includes(id) ? '1' : '' }) }, [anchors, selected, litKey])

  // A picked venue stays in view, clear of its panel: if it's near an edge or under the panel, the map moves it to the
  // middle of what the panel leaves free.
  useEffect(() => {
    const e = engine.current
    const row = results.find((r) => r.venue.id === selected)
    if (!e || !row || !hasLocation(row.venue)) return
    const point = e.map.project(position(row))
    const box = e.map.getContainer().getBoundingClientRect()
    const cover = panel?.current?.getBoundingClientRect()
    // Beside the map (narrower than half of it) it covers the left; on a phone, the foot
    const left = cover && cover.width < box.width / 2 ? cover.right - box.left : 0
    const bottom = cover && !left ? box.bottom - cover.top : 0
    if (point.x < left + 75 || point.x > box.width - 75 || point.y < 75 || point.y > box.height - bottom - 75)
      e.map.easeTo({ center: position(row), offset: [left / 2, -bottom / 2], duration: 250 })
  }, [ready, results, selected, panel])

  // Nearest first, asked for by the page: you on the map, and the map on you
  useEffect(() => {
    const e = engine.current
    if (!ready || !e) return
    if (here) showHere(e, here)
    else e.user?.remove()
  }, [ready, here])

  const locate = () => {
    if (!navigator.geolocation) { setLocationNote('Your browser doesn’t support location.'); return }
    setLocating(true)
    setLocationNote('')
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setLocating(false)
      const e = engine.current
      if (!e) return
      if (coords.latitude < 52.14 || coords.latitude > 52.26 || coords.longitude < -0.01 || coords.longitude > 0.2) {
        setLocationNote('You’re outside Cambridge. Move the map to explore venues here.')
        return
      }
      showHere(e, { latitude: coords.latitude, longitude: coords.longitude })
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
        return el && createPortal(<MapPin r={r} selected={lit(r.venue.id)} shared={offsets.has(r.venue.id)} onSelect={onSelect} />, el, r.venue.id)
      })}
      {!loaded && !error && <p className="pointer-events-none absolute top-1/2 right-0 left-0 z-400 text-center text-sm text-muted">Loading map…</p>}
      <div className="map-actions absolute top-4 left-4 z-500 max-w-[calc(100%-5rem)]">
        {controls && <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!ready || locating} onClick={locate} className="btn raised h-9 px-3.5 font-normal sm:h-9">{locating ? 'Finding you…' : 'Near me'}</button>
          <button type="button" disabled={!ready || !results.some((r) => hasLocation(r.venue))} onClick={() => {
            const e = engine.current
            if (e) {
              const bounds = results.filter((r) => hasLocation(r.venue)).reduce((b, r) => b.extend(position(r)), new e.M.LngLatBounds())
              e.map.fitBounds(bounds, { padding: fitPadding(inset), maxZoom: 15, duration: 300 })
            }
          }} className="btn raised h-9 px-3.5 font-normal sm:h-9">Show all</button>
        </div>}
        {(error || locationNote) && <p role="status" className="raised mt-2 max-w-xs rounded-lg px-4 py-3 text-sm text-ink">{error || locationNote}</p>}
      </div>
    </>
  )
}

/** The venues within 1.5 km of the middle of them all (the median point): central Cambridge; all of them when that's under three. */
function mainCluster(rows: Ranked[]): Ranked[] {
  const median = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)]
  const middle = { latitude: median(rows.map((r) => r.venue.latitude!)), longitude: median(rows.map((r) => r.venue.longitude!)) }
  const near = rows.filter((r) => metresBetween(middle, { latitude: r.venue.latitude!, longitude: r.venue.longitude! }) <= 1500)
  return near.length >= 3 ? near : rows
}

/** You, as a dot, with the map moved to you. */
function showHere(e: Engine, p: Point) {
  e.user?.remove()
  const dot = document.createElement('span')
  dot.className = 'map-user-location'
  dot.setAttribute('aria-label', 'Your location')
  e.user = new e.M.Marker({ element: dot }).setLngLat([p.longitude, p.latitude]).addTo(e.map)
  e.map.easeTo({ center: [p.longitude, p.latitude], zoom: 15, duration: 300 })
}

/**
 * A pin's fill: its type's colour; a venue that's two things (a café that's a bar by night) is both, split diagonally,
 * its own type top left. Open or not, every pin looks the same: the list says what's open.
 */
export function pinFill(types: VenueType[]): string {
  const [a, b = a] = types.map((t) => `var(--type-${t})`)
  return a === b ? a : `linear-gradient(135deg, ${a} 50%, ${b} 50%)`
}

/** A venue's pin: a disc in its type's colour (or its two types'). Venues side by side get narrower targets so none overlap. */
function MapPin({ r, selected, shared, onSelect }: { r: Ranked; selected: boolean; shared: boolean; onSelect: (id: string) => void }) {
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
