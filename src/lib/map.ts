/**
 * Pixel offsets that set venues sharing a coordinate (several venues in one building) side by side around it: one row
 * of up to three, a centred grid beyond that. Only those venues are listed; every other one stays exactly on its point,
 * and nothing is ever merged.
 */
export function sideBySide<T extends { id: string; latitude: number; longitude: number }>(points: T[], spacing = 30): Map<string, [number, number]> {
  const groups = new Map<string, T[]>()
  for (const p of points) {
    const key = `${p.latitude},${p.longitude}`
    groups.set(key, [...(groups.get(key) ?? []), p])
  }
  const offsets = new Map<string, [number, number]>()
  for (const group of groups.values()) {
    if (group.length < 2) continue
    const cols = group.length <= 3 ? group.length : Math.ceil(Math.sqrt(group.length))
    const rows = Math.ceil(group.length / cols)
    group.forEach((p, i) => {
      const row = Math.floor(i / cols)
      const inRow = Math.min(cols, group.length - row * cols)
      offsets.set(p.id, [(i % cols - (inRow - 1) / 2) * spacing, (row - (rows - 1) / 2) * spacing])
    })
  }
  return offsets
}

export type Point = { latitude: number; longitude: number }

/** Metres between two points as the crow flies (haversine): enough to put the nearest venue first. */
export function metresBetween(a: Point, b: Point): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.latitude - a.latitude)
  const dLon = rad(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

/** "350 m", "1.2 km": straight-line, so rounded. */
export const formatDistance = (m: number) => (m < 950 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1)} km`)

/** Cambridge, roughly: a location outside it isn't used for nearest first. */
export const inCambridge = (p: Point) => p.latitude > 52.14 && p.latitude < 52.26 && p.longitude > -0.01 && p.longitude < 0.2
