/**
 * Pixel offsets that set places sharing a coordinate (several venues in one building) side by side around it: one row
 * of up to three, a centred grid beyond that. Only those places are listed; every other one stays exactly on its point,
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
