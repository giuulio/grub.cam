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
 * The widest view: Dry Drayton to Teversham, Histon to Trumpington, every venue well inside. The map never zooms out
 * past fitting it (the minimum zoom follows the map's size), so a phone still sees all of it across.
 */
export const REACH: [[number, number], [number, number]] = [[0.0103, 52.1664], [0.2179, 52.2534]]
export const position = (r: Ranked): [lng: number, lat: number] => [r.venue.longitude!, r.venue.latitude!]
// On a phone, clear of Near me and Show all above and the list button below; wider, clear of what sits over the map
export const fitPadding = (inset: { top?: number; left?: number } = {}) => (window.innerWidth >= 640 ? { top: 60 + (inset.top ?? 0), left: 60 + (inset.left ?? 0), right: 60, bottom: 60 } : { top: 70, bottom: 90, left: 44, right: 44 })

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
