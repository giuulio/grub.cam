import type { Photo, Venue } from './types.ts'

/** Where photo files are served (the R2 bucket's public URL, VITE_PHOTOS_URL); without it, no photos are shown. */
const PHOTOS_URL = import.meta.env.VITE_PHOTOS_URL as string | undefined

/** A photo's file at one of its widths: `<path>-<width>.webp`. */
export const photoSrc = (p: Photo, width: number) => `${PHOTOS_URL}/${p.path}-${width}.webp`

/** The venue's first photo, if photos are served. */
export const venuePhoto = (v: Venue): Photo | undefined => (PHOTOS_URL ? v.photos?.[0] : undefined)
