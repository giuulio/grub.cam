import type { MenuDay } from './types.ts'

/** An explicit cancellation, stored as a meal's note rather than a dish. Missing menus aren't cancellations. */
export function mealCancelled(day: Pick<MenuDay, 'service' | 'note'>): boolean {
  return new RegExp(`^No ${day.service}(?:\\s*$|\\s*[–—:-])`, 'i').test(day.note?.trim() ?? '')
}

/** A meal the source says something about: its dishes, or a note alone (a cancellation, or "European Night, see posters"). */
export function mealPosted(day: Pick<MenuDay, 'items' | 'note'>): boolean {
  return day.items.length > 0 || !!day.note?.trim()
}

/** Served, with its menu posted somewhere we don't have it: a note and no dishes, which a member's photo can fill in. */
export function mealElsewhere(day: Pick<MenuDay, 'service' | 'items' | 'note'>): boolean {
  return !day.items.length && !!day.note?.trim() && !mealCancelled(day)
}
