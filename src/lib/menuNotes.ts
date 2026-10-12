import type { MenuDay } from './types.ts'

/** An explicit cancellation, stored as a meal's note rather than a dish. Missing menus aren't cancellations. */
export function mealCancelled(day: Pick<MenuDay, 'service' | 'note'>): boolean {
  return new RegExp(`^No ${day.service}(?:\\s*$|\\s*[–—:-])`, 'i').test(day.note?.trim() ?? '')
}
