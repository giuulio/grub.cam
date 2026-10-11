import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { hasLocation } from '../lib/finder.ts'
import type { Ranked } from '../lib/filters.ts'
import { CAMBRIDGE, findMe, fitPadding, mainCluster, MAPKIT_TOKEN, mappable, mapTheme, onThemeChange, REACH } from '../lib/mapView.ts'
import { sideBySide, type Point } from '../lib/map.ts'
import { MapActions, MapPin, type MapProps } from './MapParts.tsx'

declare global {
  interface Window { grubMapKitLoaded?: () => void }
}

/** Apple's own food and drink places, left off so they don't compete with the venues' pins. */
const HIDDEN_PLACES = ['Bakery', 'Brewery', 'Cafe', 'FoodMarket', 'Nightlife', 'Restaurant', 'Winery'] as const

// MapKit JS loads once, from Apple, the first time a map shows; a refused token or a failed load is reported to every
// map showing, which then falls back to OpenFreeMap's.
let loading: Promise<void> | undefined
const failures = new Set<(why?: unknown) => void>()
function loadMapKit(): Promise<void> {
  loading ??= new Promise<void>((resolve, reject) => {
    window.grubMapKitLoaded = () => {
      mapkit.init({ authorizationCallback: (done) => done(MAPKIT_TOKEN!), language: 'en-GB' })
      mapkit.addEventListener('error', (e) => failures.forEach((fail) => fail(e)))
      resolve()
    }
    const script = document.createElement('script')
    script.src = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.core.js'
    script.crossOrigin = 'anonymous'
    script.async = true
    script.dataset.callback = 'grubMapKitLoaded'
    script.dataset.libraries = 'map,annotations'
    script.onerror = () => reject(new Error('MapKit JS could not load'))
    document.head.append(script)
  })
  return loading
}

const coordinate = (p: Point) => new mapkit.Coordinate(p.latitude, p.longitude)
const venuePoint = (r: Ranked): Point => ({ latitude: r.venue.latitude!, longitude: r.venue.longitude! })
/** What a zoom level (web mercator, 256px tiles, as MapLibre's) shows in a map this size: MapKit is given spans. */
function spanAt(zoom: number, el: HTMLElement, latitude: number) {
  const degreesPerPixel = 360 / 2 ** zoom / 256
  return new mapkit.CoordinateSpan(el.clientHeight * degreesPerPixel * Math.cos((latitude * Math.PI) / 180), el.clientWidth * degreesPerPixel)
}
const regionAt = (p: Point, zoom: number, el: HTMLElement) => new mapkit.CoordinateRegion(coordinate(p), spanAt(zoom, el, p.latitude))
const [[west, south], [east, north]] = REACH

type Pin = { el: HTMLDivElement; annotation: mapkit.Annotation }
type Engine = { map: mapkit.Map; pins: Map<string, Pin>; user?: mapkit.Annotation }

/**
 * Apple's map (MapKit JS, its muted style, light or dark with the theme), with the same pins and behaviour as
 * OpenFreeMap's (`MapProps`). `onFail`: Apple's map couldn't load or refused the token.
 */
export function AppleMap({ results, selected, highlight, onSelect, onBackground, filtered, panel, inset, here, controls = true, core = false, maxZoom = 15, focus, embedded = false, onFail }: MapProps & { onFail: () => void }) {
  const container = useRef<HTMLDivElement>(null)
  const engine = useRef<Engine | null>(null)
  const fitKey = useRef('')
  const [ready, setReady] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locationNote, setLocationNote] = useState('')
  const [anchors, setAnchors] = useState<Map<string, HTMLDivElement>>(() => new Map())
  // Read by listeners made once
  const latest = useRef({ onFail, onBackground, onSelect, embedded })
  useEffect(() => { latest.current = { onFail, onBackground, onSelect, embedded } })

  useEffect(() => {
    let disposed = false
    const cleanups: (() => void)[] = []
    const failed = (why?: unknown) => {
      if (disposed) return
      console.warn('Apple’s map couldn’t show, so this is OpenFreeMap’s:', why)
      latest.current.onFail()
    }
    failures.add(failed)
    loadMapKit().then(() => {
      const el = container.current
      if (disposed || !el) return
      const scheme = () => (mapTheme() === 'dark' ? mapkit.Map.ColorSchemes.Dark : mapkit.Map.ColorSchemes.Light)
      const map = new mapkit.Map(el, {
        mapType: mapkit.Map.MapTypes.MutedStandard,
        colorScheme: scheme(),
        showsCompass: mapkit.FeatureVisibility.Hidden,
        showsScale: mapkit.FeatureVisibility.Hidden,
        showsMapTypeControl: false,
        showsUserLocationControl: false,
        // Pinch on a touch screen; the buttons elsewhere
        showsZoomControl: !window.matchMedia('(pointer: coarse)').matches,
        isRotationEnabled: false,
        pointOfInterestFilter: mapkit.PointOfInterestFilter.excluding(HIDDEN_PLACES.map((c) => mapkit.PointOfInterestCategory[c])),
        region: regionAt({ latitude: CAMBRIDGE[1], longitude: CAMBRIDGE[0] }, 13, el),
      })
      // Never wander, or zoom out, far past REACH
      // (MapKit takes the region itself, whatever its published types say)
      map.cameraBoundary = new mapkit.CoordinateRegion(new mapkit.Coordinate((north + south) / 2, (east + west) / 2), new mapkit.CoordinateSpan(north - south, east - west)) as unknown as mapkit.CameraBoundaryDescription
      map.cameraZoomRange = new mapkit.CameraZoomRange(100, 16000)
      el.dataset.mapTheme = mapTheme()
      cleanups.push(onThemeChange(() => {
        map.colorScheme = scheme()
        el.dataset.mapTheme = mapTheme()
      }))
      // A pin picked, by tap or keyboard (its own button also says so); the map itself, not a pin: let go
      map.addEventListener('select', (e) => {
        const id = (e.annotation?.data as { id?: string } | undefined)?.id
        if (id) latest.current.onSelect(id)
        map.selectedAnnotation = null
      })
      let onPin = false
      const down = (e: PointerEvent) => { onPin = !!(e.target as Element).closest('.venue-pin-target') }
      el.addEventListener('pointerdown', down, true)
      map.addEventListener('single-tap', () => { if (!onPin) latest.current.onBackground?.() })
      // Inside a page that scrolls, the wheel scrolls the page; a trackpad's pinch (a wheel with ctrl) still zooms
      const wheel = (e: WheelEvent) => { if (latest.current.embedded && !e.ctrlKey) e.stopPropagation() }
      el.addEventListener('wheel', wheel, true)
      cleanups.push(() => {
        el.removeEventListener('pointerdown', down, true)
        el.removeEventListener('wheel', wheel, true)
      })
      engine.current = { map, pins: new Map() }
      setReady(true)
    }).catch(failed)
    return () => {
      disposed = true
      failures.delete(failed)
      cleanups.forEach((c) => c())
      engine.current?.map.destroy()
      engine.current = null
    }
  }, [])

  // One annotation per venue, kept while it stays in the results; venues sharing a coordinate sit side by side.
  const mapped = mappable(results)
  const offsets = sideBySide(mapped.map((r) => ({ id: r.venue.id, ...venuePoint(r) })))
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
        const annotation = new mapkit.Annotation(coordinate(venuePoint(r)), () => el, { calloutEnabled: false, animates: false, data: { id: r.venue.id } })
        e.map.addAnnotation(annotation)
        return { el, annotation }
      })()
      // MapKit hangs an element from its bottom centre; a pin's 44px target is centred on its point, as on OpenFreeMap's
      const [x, y] = offsets.get(r.venue.id) ?? [0, 0]
      pin.annotation.anchorOffset = new DOMPoint(x, y + 22)
      next.set(r.venue.id, pin)
    }
    for (const [id, pin] of e.pins) if (!next.has(id)) e.map.removeAnnotation(pin.annotation)
    e.pins = next
    setAnchors(new Map([...next].map(([id, pin]) => [id, pin.el])))
  }, [ready, key])

  // Fit the venues (central Cambridge until the list is narrowed), or centre on the one this page is about
  useEffect(() => {
    const e = engine.current
    const el = container.current
    if (!ready || !e || !el) return
    const { mapped } = pins.current
    const fit = `${!!filtered}:${core}:${maxZoom}:${focus}:${key}`
    if (fit === fitKey.current) return
    fitKey.current = fit
    const focused = focus ? mapped.find((r) => r.venue.id === focus) : undefined
    const framed = (core ? mainCluster(mapped) : mapped).map((r) => e.pins.get(r.venue.id)?.annotation).filter((a): a is mapkit.Annotation => !!a)
    if (focused) e.map.region = regionAt(venuePoint(focused), maxZoom, el)
    else if (filtered && framed.length) showItems(e, framed, el, inset, maxZoom, false)
    else if (!filtered) e.map.region = regionAt({ latitude: CAMBRIDGE[1], longitude: CAMBRIDGE[0] }, 13, el)
  }, [ready, key, filtered, core, inset, maxZoom, focus])

  // The selected venue's pin sits above its neighbours, as do highlighted ones.
  const lit = (id: string) => id === selected || !!highlight?.includes(id)
  const litKey = highlight?.join('|')
  useEffect(() => { anchors.forEach((el, id) => { el.style.zIndex = id === selected || litKey?.split('|').includes(id) ? '1' : '' }) }, [anchors, selected, litKey])

  // A picked venue stays in view, clear of its panel: if it's near an edge or under the panel, the map moves it to the
  // middle of what the panel leaves free.
  useEffect(() => {
    const e = engine.current
    const el = container.current
    const row = results.find((r) => r.venue.id === selected)
    if (!e || !el || !row || !hasLocation(row.venue)) return
    const box = el.getBoundingClientRect()
    const centre = e.map.convertCoordinateToPointOnPage(e.map.center)
    const pin = e.map.convertCoordinateToPointOnPage(coordinate(venuePoint(row)))
    const x = pin.x - centre.x + box.width / 2
    const y = pin.y - centre.y + box.height / 2
    const cover = panel?.current?.getBoundingClientRect()
    // Beside the map (narrower than half of it) it covers the left; on a phone, the foot
    const left = cover && cover.width < box.width / 2 ? cover.right - box.left : 0
    const bottom = cover && !left ? box.bottom - cover.top : 0
    if (x < left + 75 || x > box.width - 75 || y < 75 || y > box.height - bottom - 75)
      e.map.setCenterAnimated(e.map.convertPointOnPageToCoordinate(new DOMPoint(pin.x - left / 2, pin.y + bottom / 2)), true)
  }, [ready, results, selected, panel])

  // Nearest first, asked for by the page: you on the map, and the map on you
  useEffect(() => {
    const e = engine.current
    const el = container.current
    if (!ready || !e || !el) return
    if (here) showHere(e, here, el)
    else if (e.user) {
      e.map.removeAnnotation(e.user)
      e.user = undefined
    }
  }, [ready, here])

  const locate = () => {
    setLocating(true)
    setLocationNote('')
    findMe((p, note) => {
      setLocating(false)
      setLocationNote(note ?? '')
      if (p && engine.current && container.current) showHere(engine.current, p, container.current)
    })
  }
  const showAll = () => {
    const e = engine.current
    if (e && container.current) showItems(e, [...e.pins.values()].map((p) => p.annotation), container.current, inset, maxZoom, true)
  }

  return (
    <>
      <div ref={container} className="venue-map" aria-label="Map of food and drink in Cambridge" />
      {mapped.map((r) => {
        const el = anchors.get(r.venue.id)
        return el && createPortal(<MapPin r={r} selected={lit(r.venue.id)} shared={offsets.has(r.venue.id)} onSelect={onSelect} />, el, r.venue.id)
      })}
      {!ready && <p className="pointer-events-none absolute top-1/2 right-0 left-0 z-400 text-center text-sm text-muted">Loading map…</p>}
      <MapActions controls={controls} ready={ready} locating={locating} canShowAll={mapped.length > 0} onLocate={locate} onShowAll={showAll} note={locationNote} />
    </>
  )
}

/** Fit these pins, clear of what sits over the map, never closer than `maxZoom`. */
function showItems(e: Engine, items: mapkit.Annotation[], el: HTMLElement, inset: MapProps['inset'], maxZoom: number, animate: boolean) {
  const pad = fitPadding(inset)
  e.map.showItems(items, { animate, padding: new mapkit.Padding(pad.top, pad.right, pad.bottom, pad.left), minimumSpan: spanAt(maxZoom, el, CAMBRIDGE[1]) })
}

/** You, as a dot, with the map moved to you. */
function showHere(e: Engine, p: Point, el: HTMLElement) {
  if (e.user) e.map.removeAnnotation(e.user)
  const dot = document.createElement('span')
  dot.className = 'map-user-location'
  dot.setAttribute('aria-label', 'Your location')
  e.user = new mapkit.Annotation(coordinate(p), () => dot, { calloutEnabled: false, enabled: false, anchorOffset: new DOMPoint(0, 9) })
  e.map.addAnnotation(e.user)
  e.map.setRegionAnimated(regionAt(p, 15, el), true)
}
