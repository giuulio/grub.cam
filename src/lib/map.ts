/** Group nearby projected points, retaining the original venues for zooming and selection. */
export function clusterPoints<T extends { x: number; y: number }>(points: T[], radius = 36): T[][] {
  const groups: T[][] = []
  for (const point of points) {
    const group = groups.find((g) => Math.hypot(g[0].x - point.x, g[0].y - point.y) < radius)
    if (group) group.push(point)
    else groups.push([point])
  }
  return groups
}
