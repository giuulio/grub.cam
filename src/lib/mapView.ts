// What both maps (Apple's and OpenFreeMap's) share about framing Cambridge's venues, their theme and pins, and finding
// where you are.
import { hasLocation } from './finder.ts'
import type { Ranked } from './filters.ts'
import { metresBetween, type Point } from './map.ts'
import type { VenueType } from './types.ts'

/**
 * MapKit JS tokens, made in the Apple Developer account (Services → Maps → Tokens), comma-separated: Apple makes one
 * per domain (grub.cam, www.grub.cam). Maps are Apple's with one, OpenFreeMap's without (`VenueMap`).
 */
const MAPKIT_TOKENS = String(import.meta.env.VITE_MAPKIT_TOKEN ?? '').split(',').map((t) => t.trim()).filter(Boolean)

/** The domain a token was made for (its `origin` claim); none for an unrestricted one. */
export function tokenOrigin(token: string): string | undefined {
  try {
    const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { origin?: string }
    return claims.origin?.replace(/^https?:\/\//, '').replace(/:\d+$/, '')
  } catch {
    return undefined
  }
}

/** The token for the domain this page is on, else one with no domain (for local development), else none. */
export function pickToken(tokens: string[], host: string): string | undefined {
  return tokens.find((t) => tokenOrigin(t) === host) ?? tokens.find((t) => !tokenOrigin(t))
}

export const MAPKIT_TOKEN: string | undefined = typeof window === 'undefined' ? undefined : pickToken(MAPKIT_TOKENS, window.location.hostname)

export const CAMBRIDGE: [lng: number, lat: number] = [0.117, 52.205]
/**
 * The widest view: the venues and about 600 m round them, Madingley Hall to the Biomedical Campus, Girton to
 * Addenbrooke's. Neither map zooms out past fitting it (at the map's size, so a phone still sees all of it across), and
 * Apple's keeps its middle inside it. A venue further out needs this widened.
 */
export const REACH: [[number, number], [number, number]] = [[0.028, 52.17], [0.151, 52.235]]
export const position = (r: Ranked): [lng: number, lat: number] => [r.venue.longitude!, r.venue.latitude!]
// On a phone, clear of Near me and Show all above and the list button below; wider, clear of what sits over the map;
// both, clear of what else the page puts over it (`inset`: the search and filters above, a card below)
export const fitPadding = (inset: { top?: number; left?: number; bottom?: number } = {}) =>
  window.innerWidth >= 640
    ? { top: 60 + (inset.top ?? 0), left: 60 + (inset.left ?? 0), right: 60, bottom: 60 + (inset.bottom ?? 0) }
    : { top: 70 + (inset.top ?? 0), bottom: 90 + (inset.bottom ?? 0), left: 44, right: 44 }

/** You are here: a dot hung from a point of no size (`.map-user-origin`), as a pin is, so either map places it the same. */
export function userDot(): HTMLElement {
  const origin = document.createElement('div')
  origin.className = 'map-user-origin'
  origin.setAttribute('role', 'img')
  origin.setAttribute('aria-label', 'Your location')
  origin.append(Object.assign(document.createElement('span'), { className: 'map-user-location' }))
  return origin
}

const TYPE_ORDER: VenueType[] = ['hall', 'cafe', 'bar']
/** The venues with a point, in a fixed order (so venues sharing one sit side by side the same way every time). */
export const mappable = (results: Ranked[]) =>
  results.filter((r) => hasLocation(r.venue)).sort((a, b) => TYPE_ORDER.indexOf(a.venue.type) - TYPE_ORDER.indexOf(b.venue.type) || a.venue.name.localeCompare(b.venue.name) || a.venue.id.localeCompare(b.venue.id))

/** The venues within 1.5 km of the middle of them all (the median point): central Cambridge; all of them when that's under three. */
export function mainCluster(rows: Ranked[]): Ranked[] {
  const median = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)]
  const middle = { latitude: median(rows.map((r) => r.venue.latitude!)), longitude: median(rows.map((r) => r.venue.longitude!)) }
  const near = rows.filter((r) => metresBetween(middle, { latitude: r.venue.latitude!, longitude: r.venue.longitude! }) <= 1500)
  return near.length >= 3 ? near : rows
}

/** The light or dark map, following the theme toggle and else the system. */
export const mapTheme = (): 'light' | 'dark' =>
  document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'

/** Calls `change` whenever the map's theme might have changed; returns the unsubscribe. */
export function onThemeChange(change: () => void): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const observer = new MutationObserver(change)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  media.addEventListener('change', change)
  return () => {
    observer.disconnect()
    media.removeEventListener('change', change)
  }
}

/**
 * A pin's fill: its type's colour; a venue that's two things (a café that's a bar by night) is both, split diagonally,
 * its own type top left. Open or not, every pin looks the same: the list says what's open.
 */
export function pinFill(types: VenueType[]): string {
  const [a, b = a] = types.map((t) => `var(--type-${t})`)
  return a === b ? a : `linear-gradient(135deg, ${a} 50%, ${b} 50%)`
}

/** Where you are, for Near me: a note instead when the browser won't say or you're outside Cambridge. */
export function findMe(done: (p?: Point, note?: string) => void) {
  if (!navigator.geolocation) return done(undefined, 'Your browser doesn’t support location.')
  navigator.geolocation.getCurrentPosition(({ coords }) => {
    if (coords.latitude < 52.14 || coords.latitude > 52.26 || coords.longitude < -0.01 || coords.longitude > 0.2) return done(undefined, 'You’re outside Cambridge. Move the map to explore venues here.')
    done({ latitude: coords.latitude, longitude: coords.longitude })
  }, (err) => done(undefined, err.code === 1 ? 'Location access was denied. You can move the map instead.' : 'Couldn’t find your location. Try again or move the map.'), { timeout: 10000, maximumAge: 60000 })
}

/** Zoomed in this far (web mercator, as MapLibre's), pins get their names beside them, as Apple's places do. */
export const LABEL_ZOOM = 15

/** The zoom a map this wide is at when it spans this many degrees of longitude. */
export const zoomFor = (widthPx: number, longitudeDelta: number) => Math.log2((360 * widthPx) / (256 * longitudeDelta))

const GENERIC = new Set(['hall', 'dining', 'servery', 'cafe', 'café', 'bar', 'buttery', 'kitchen', 'coffee', 'shop', 'canteen', 'cafeteria', 'refectory', 'room', 'and', 'the', '&', '/', 'great'])
/** A pin's name on the map: the venue's, with its college's first where the name alone says nothing ("Pembroke · Hall"). */
export function pinLabel(v: { name: string; site: { name: string; short_name?: string | null } }): string {
  const words = v.name.toLowerCase().replace(/[()"']/g, '').split(/\s+/).filter(Boolean)
  return words.every((w) => GENERIC.has(w)) ? `${v.site.short_name ?? v.site.name} · ${v.name}` : v.name
}

export type LabelSide = 'right' | 'left'
type Box = { l: number; r: number; t: number; b: number; id: string }
const DISC = 12
const LABEL_H = 16
const LABEL_GAP = 4

/**
 * Which pins get their name beside them, and on which side: in priority order (the picked one first), each to the
 * right of its pin, else to its left, where it overlaps no other pin and no name already placed and stays inside the
 * map; the rest go without, as Apple's labels do. `x`/`y` are the pin's centre in the map, `width` its name's;
 * `only`: the pins that may have one (every pin is still in the way).
 */
export function placeLabels(pins: { id: string; x: number; y: number; width: number; height?: number }[], map: { width: number; height: number }, only?: Set<string>): Map<string, LabelSide> {
  const taken: Box[] = pins.map((p) => ({ l: p.x - DISC, r: p.x + DISC, t: p.y - DISC, b: p.y + DISC, id: p.id }))
  const placed = new Map<string, LabelSide>()
  const overlaps = (a: Box, b: Omit<Box, 'id'>) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b
  for (const p of pins) {
    if ((only && !only.has(p.id)) || p.x < 0 || p.y < 0 || p.x > map.width || p.y > map.height) continue
    for (const side of ['right', 'left'] as const) {
      const l = side === 'right' ? p.x + DISC + LABEL_GAP : p.x - DISC - LABEL_GAP - p.width
      const h = p.height ?? LABEL_H
      const box = { l, r: l + p.width, t: p.y - h / 2, b: p.y + h / 2 }
      if (box.l < 0 || box.r > map.width || taken.some((o) => o.id !== p.id && overlaps(o, box))) continue
      taken.push({ ...box, id: p.id })
      placed.set(p.id, side)
      break
    }
  }
  return placed
}

/**
 * Names the pins a map shows (`anchors`, each holding a MapPin): where each is (`at`, in the map's pixels), in priority
 * order (the picked pin, those picked out, then the list's order); every pin that fits once zoomed in to LABEL_ZOOM,
 * only the picked one before. Marks each anchor's `data-label` with the side, for the CSS.
 */
export function labelPins(anchors: Map<string, HTMLElement>, at: (id: string) => { x: number; y: number } | undefined, order: string[], zoom: number, picked: string | undefined, size: { width: number; height: number }) {
  const pins = [...new Set(order)].flatMap((id) => {
    const el = anchors.get(id)
    const p = el && at(id)
    const label = el?.querySelector<HTMLElement>('.venue-pin-label')
    return el && p ? [{ id, ...p, width: label?.offsetWidth ?? 0, height: label?.offsetHeight }] : []
  })
  const sides = placeLabels(pins, size, zoom >= LABEL_ZOOM ? undefined : new Set(picked ? [picked] : []))
  anchors.forEach((el, id) => {
    const side = sides.get(id)
    if (side) el.dataset.label = side
    else delete el.dataset.label
  })
}
