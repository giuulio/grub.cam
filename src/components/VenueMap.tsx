import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type * as MapLibre from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { hasLocation } from '../lib/finder.ts'
import { CAMBRIDGE, findMe, fitPadding, labelPins, mainCluster, MAPKIT_TOKEN, mappable, mapTheme, onThemeChange, position, REACH } from '../lib/mapView.ts'
import { sideBySide, type Point } from '../lib/map.ts'
import { bindSafariPinch } from '../lib/mapGestures.ts'
import { AppleMap } from './AppleMap.tsx'
import { MapActions, MapPin, type MapProps } from './MapParts.tsx'

type Pin = { el: HTMLDivElement; marker: MapLibre.Marker }
type Engine = { M: typeof MapLibre; map: MapLibre.Map; pins: Map<string, Pin>; user?: MapLibre.Marker }

/** Once Apple's map has failed (its token refused, its script blocked), every map after it is OpenFreeMap's. */
let appleFailed = false

/**
 * A map of venues, one pin each (see `MapProps`): Apple's when the site has a MapKit JS token (`VITE_MAPKIT_TOKEN`),
 * else, or if Apple's fails, OpenFreeMap's through MapLibre GL.
 */
export function VenueMap(props: MapProps) {
  const [apple, setApple] = useState(!!MAPKIT_TOKEN && !appleFailed)
  if (apple) return <AppleMap {...props} onFail={() => { appleFailed = true; setApple(false) }} />
  return <OpenMap {...props} />
}

/** OpenFreeMap's vector tiles (Bright, Fiord in the dark) through MapLibre GL, loaded only where a map shows. */
function OpenMap({ results, selected, highlight, onSelect, onBackground, filtered, panel, inset, here, controls = true, core = false, maxZoom = 15, focus, embedded = false }: MapProps) {
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
      const resolvedTheme = mapTheme
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
      unbindTheme = onThemeChange(syncTheme)
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

  const background = useRef(onBackground)
  useEffect(() => { background.current = onBackground }, [onBackground])
  useEffect(() => {
    const e = engine.current
    if (!ready || !e) return
    const click = (ev: MapLibre.MapMouseEvent) => { if (!(ev.originalEvent.target as Element).closest('.venue-pin-target')) background.current?.() }
    e.map.on('click', click)
    return () => { e.map.off('click', click) }
  }, [ready])

  // Inside a page that scrolls, the wheel scrolls the page
  useEffect(() => {
    const e = engine.current
    if (!ready || !e) return
    if (embedded) e.map.scrollZoom.disable()
    else e.map.scrollZoom.enable()
  }, [ready, embedded])

  // One marker per venue, kept while it stays in the results; venues sharing a coordinate sit side by side.
  const mapped = mappable(results)
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
    const fit = `${!!filtered}:${core}:${maxZoom}:${focus}:${key}`
    if (fit === fitKey.current) return
    fitKey.current = fit
    const focused = focus ? mapped.find((r) => r.venue.id === focus) : undefined
    const framed = core ? mainCluster(mapped) : mapped
    if (focused) e.map.jumpTo({ center: position(focused), zoom: maxZoom })
    else if (filtered && framed.length) e.map.fitBounds(framed.reduce((b, r) => b.extend(position(r)), new e.M.LngLatBounds()), { padding: fitPadding(inset), maxZoom, duration: 0 })
    else if (!filtered) e.map.jumpTo({ center: CAMBRIDGE, zoom: 13 })
  }, [ready, key, filtered, core, inset, maxZoom, focus]) // refit only when the matching venues change (fitKey ignores the rest)

  // The selected venue's pin sits above its neighbours, as do highlighted ones.
  const lit = (id: string) => id === selected || !!highlight?.includes(id)
  const litKey = highlight?.join('|')
  useEffect(() => { anchors.forEach((el, id) => { el.style.zIndex = id === selected || litKey?.split('|').includes(id) ? '1' : '' }) }, [anchors, selected, litKey])

  // Pins' names, as Apple's places have: those that fit once zoomed in, the picked one's always
  const name = useRef(() => {})
  useEffect(() => {
    name.current = () => {
      const e = engine.current
      const el = container.current
      if (!e || !el) return
      const at = (id: string) => {
        const r = mapped.find((m) => m.venue.id === id)
        if (!r) return undefined
        const p = e.map.project(position(r))
        const [x, y] = offsets.get(id) ?? [0, 0]
        return { x: p.x + x, y: p.y + y }
      }
      const order = [...(selected ? [selected] : []), ...(highlight ?? []), ...results.map((r) => r.venue.id)]
      labelPins(anchors, at, order, e.map.getZoom(), selected, { width: el.clientWidth, height: el.clientHeight })
    }
  })
  useEffect(() => {
    const e = engine.current
    if (!ready || !e) return
    const moved = () => name.current()
    e.map.on('moveend', moved)
    return () => { e.map.off('moveend', moved) }
  }, [ready])
  useEffect(() => { requestAnimationFrame(() => name.current()) }, [anchors, selected, litKey, key])

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
    setLocating(true)
    setLocationNote('')
    findMe((p, note) => {
      setLocating(false)
      setLocationNote(note ?? '')
      if (p && engine.current) showHere(engine.current, p)
    })
  }
  const showAll = () => {
    const e = engine.current
    if (!e) return
    const bounds = results.filter((r) => hasLocation(r.venue)).reduce((b, r) => b.extend(position(r)), new e.M.LngLatBounds())
    e.map.fitBounds(bounds, { padding: fitPadding(inset), maxZoom, duration: 300 })
  }

  return (
    <>
      <div ref={container} className="venue-map" aria-label="Map of food and drink in Cambridge" />
      {mapped.map((r) => {
        const el = anchors.get(r.venue.id)
        return el && createPortal(<MapPin r={r} selected={lit(r.venue.id)} shared={offsets.has(r.venue.id)} onSelect={onSelect} />, el, r.venue.id)
      })}
      {!loaded && !error && <p className="pointer-events-none absolute top-1/2 right-0 left-0 z-400 text-center text-sm text-muted">Loading map…</p>}
      <MapActions controls={controls} ready={ready} locating={locating} canShowAll={results.some((r) => hasLocation(r.venue))} onLocate={locate} onShowAll={showAll} note={error || locationNote} />
    </>
  )
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
