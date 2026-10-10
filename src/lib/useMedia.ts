import { useSyncExternalStore } from 'react'

/** Whether a media query matches, following it as the window changes; false when rendered at build time. */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (change) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', change)
      return () => media.removeEventListener('change', change)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
