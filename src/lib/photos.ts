import type { Photo, Site, Venue } from './types.ts'

/** Where photo files are served: the site's own /photos (public/photos in the repo), unless VITE_PHOTOS_URL moves them. */
const PHOTOS_URL = (import.meta.env.VITE_PHOTOS_URL as string | undefined) ?? '/photos'

/** A photo's file at one of its widths: `<path>-<width>.webp`. */
export const photoSrc = (p: Photo, width: number) => `${PHOTOS_URL}/${p.path}-${width}.webp`

/** The venue's first photo: the one it's shown with. */
export const venuePhoto = (v: Venue): Photo | undefined => v.photos?.[0]
/** The site's first photo: the one its directory row and page show. */
export const sitePhoto = (s: Site): Photo | undefined => s.photos?.[0]

/** The deed a licence names ("CC BY-SA 2.0", "CC BY 2.0 uk", "CC0"), for crediting a photo; none for public domain. */
export function licenceUrl(licence: string | null): string | undefined {
  if (!licence) return
  if (/^CC0/i.test(licence)) return 'https://creativecommons.org/publicdomain/zero/1.0/'
  const m = licence.match(/^CC (BY(?:-SA)?) (\d\.\d)(?: ([a-z]{2,3}))?$/i)
  return m ? `https://creativecommons.org/licenses/${m[1].toLowerCase()}/${m[2]}/${m[3] ? `${m[3].toLowerCase()}/` : ''}` : undefined
}

/** A link to where the photo came from, when that's a page (Wikimedia Commons); "own photo" isn't one. */
export const sourceUrl = (p: Photo) => (p.source && /^https:\/\//.test(p.source) ? p.source : undefined)
