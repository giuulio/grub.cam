import { useEffect, useState } from 'react'
import type { Point } from './map.ts'

// A walking route from where you are to a venue, by OpenStreetMap's routing (FOSSGIS's OSRM, foot profile: free, no key,
// meant for light use). Asked for only for the venue picked, once your location is known; each answer kept for the
// visit, so going back to a venue asks nothing.

/** The way there as [longitude, latitude] points, how far it is and how long it takes on foot. */
export type Route = { line: [number, number][]; metres: number; seconds: number }

const SERVER = 'https://routing.openstreetmap.de/routed-foot/route/v1/driving'
const kept = new Map<string, Route | null>()
// Where you are moves a little between fixes: to the nearest ten metres or so, it's the same walk
const key = (from: Point, to: Point) => [from.latitude, from.longitude, to.latitude, to.longitude].map((n) => n.toFixed(4)).join(',')

/** The route, or nothing when there's none (the server down or refusing, no path on foot). */
export async function walkingRoute(from: Point, to: Point, signal?: AbortSignal): Promise<Route | undefined> {
  const k = key(from, to)
  if (kept.has(k)) return kept.get(k) ?? undefined
  try {
    const res = await fetch(`${SERVER}/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson`, { signal })
    const body = res.ok ? await res.json() : undefined
    const r = body?.code === 'Ok' ? body.routes?.[0] : undefined
    const route: Route | null = r ? { line: r.geometry.coordinates, metres: r.distance, seconds: r.duration } : null
    kept.set(k, route)
    return route ?? undefined
  } catch {
    // Aborted (another venue picked) or offline: not kept, so it's asked again next time
    return undefined
  }
}

/** "4 min walk", never under a minute. */
export const walkTime = (r: Route) => `${Math.max(1, Math.round(r.seconds / 60))} min walk`

/** The walking route between two points while both are known, fetched as they change (and the last one let go). */
export function useWalkingRoute(from?: Point, to?: Point): Route | undefined {
  const [got, setGot] = useState<{ key: string; route?: Route }>()
  const want = from && to ? key(from, to) : undefined
  const [fLat, fLon, tLat, tLon] = [from?.latitude, from?.longitude, to?.latitude, to?.longitude]
  useEffect(() => {
    if (fLat == null || fLon == null || tLat == null || tLon == null) return
    const a = { latitude: fLat, longitude: fLon }
    const b = { latitude: tLat, longitude: tLon }
    const stop = new AbortController()
    walkingRoute(a, b, stop.signal).then((route) => {
      if (!stop.signal.aborted) setGot({ key: key(a, b), route })
    })
    return () => stop.abort()
  }, [fLat, fLon, tLat, tLon])
  return got && got.key === want ? got.route : undefined
}
