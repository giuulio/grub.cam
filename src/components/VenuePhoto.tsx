import { useState, type ReactNode } from 'react'
import { TYPE_LABEL } from '../lib/filters.ts'
import { TYPE_ICON } from '../lib/icons.ts'
import { licenceUrl, photoSrc, sourceUrl, venuePhoto } from '../lib/photos.ts'
import type { Photo, Venue, VenueType } from '../lib/types.ts'
import { Icon } from './Icon.tsx'

/**
 * A venue's picture, in a box the caller shapes (`className`): its photo, cropped to fill, its average colour showing
 * until it loads; or, when it has none or the photo can't load, its type's tile (the type's tint, its icon in the
 * middle, `icon` sized). `sizes` is how wide it's shown, so the browser picks the smallest file that's sharp enough.
 * `decorative` when text beside it already names the venue; `overlay` sits over a photo, never over the tile.
 */
export function VenueImage({ venue, sizes, className = '', icon = 'size-[40%]', eager = false, decorative = false, overlay }: { venue: Venue; sizes: string; className?: string; icon?: string; eager?: boolean; decorative?: boolean; overlay?: ReactNode }) {
  const photo = venuePhoto(venue)
  const [failed, setFailed] = useState<string>()
  if (!photo || failed === photo.path)
    return (
      <span className={`type-tile shrink-0 ${className}`} data-type={venue.type}>
        <Icon of={TYPE_ICON[venue.type]} className={icon} />
      </span>
    )
  const img = (
    <img
      src={photoSrc(photo, photo.widths.find((w) => w >= 960) ?? photo.widths.at(-1)!)}
      srcSet={photo.widths.map((w) => `${photoSrc(photo, w)} ${w}w`).join(', ')}
      sizes={sizes}
      width={photo.width}
      height={photo.height}
      alt={decorative ? '' : photo.alt}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : undefined}
      // A prerendered page's image can fail before the app is there to hear it: check once it is
      ref={(el) => { if (el?.complete && !el.naturalWidth) setFailed(photo.path) }}
      onError={() => setFailed(photo.path)}
      style={{ backgroundColor: photo.color ?? undefined }}
      className={`object-cover ${overlay ? 'size-full rounded-[inherit]' : className}`}
    />
  )
  if (!overlay) return img
  return (
    <span className={`relative shrink-0 ${className}`}>
      {img}
      {overlay}
    </span>
  )
}

/** A type's colour with its icon, as on the map: chips, headings and the directory use it, so they read as its key. `label` when its name is already written beside it (or read out by the row it sits in). */
export function TypeMark({ type, className = 'size-5', label = false }: { type: VenueType; className?: string; label?: boolean }) {
  return (
    <span className={`type-mark ${className}`} data-type={type} title={label ? undefined : TYPE_LABEL[type]}>
      <Icon of={TYPE_ICON[type]} className="size-[60%]" />
      {!label && <span className="sr-only">{TYPE_LABEL[type]}</span>}
    </span>
  )
}

/** A venue in a list: a small square of its photo with its type's mark in the corner, or its type's tile. */
export function VenueThumb({ venue, className = 'size-16' }: { venue: Venue; className?: string }) {
  return (
    <VenueImage
      venue={venue}
      sizes="4rem"
      decorative
      className={`rounded-lg ${className}`}
      // The photo doesn't say what kind of venue it is: its mark does
      overlay={<TypeMark type={venue.type} className="absolute -right-1 -bottom-1 size-5 ring-2 ring-canvas" label />}
    />
  )
}

/** The venue page's banner: its photo across the page, credited under it; its type's tile until it has one. */
export function VenueBanner({ venue }: { venue: Venue }) {
  const photo = venuePhoto(venue)
  return (
    <figure className="-mx-4 mb-8 sm:mx-0">
      <VenueImage venue={venue} sizes="(min-width: 1280px) 78rem, 100vw" eager icon="size-12" className="block aspect-5/2 w-full sm:rounded-xl lg:aspect-4/1" />
      {photo && <PhotoCredit photo={photo} className="mt-2 px-4 sm:px-0" />}
    </figure>
  )
}

/** "Photo: Kim Fyson, CC BY-SA 2.0, Wikimedia Commons", linking the licence's deed and the photo's page. */
export function PhotoCredit({ photo, className = '' }: { photo: Photo; className?: string }) {
  const deed = licenceUrl(photo.licence)
  const page = sourceUrl(photo)
  if (!photo.credit && !photo.licence) return null
  const link = 'underline underline-offset-2 hover:text-ink'
  return (
    <p className={`text-xs text-muted ${className}`}>
      Photo{photo.credit && `: ${photo.credit}`}
      {photo.licence && (
        <>
          {', '}
          {deed ? <a href={deed} target="_blank" rel="noopener license" className={link}>{photo.licence}</a> : photo.licence}
        </>
      )}
      {page && (
        <>
          {', '}
          <a href={page} target="_blank" rel="noopener" className={link}>{/commons\.wikimedia\.org/.test(page) ? 'Wikimedia Commons' : new URL(page).hostname}</a>
        </>
      )}
    </p>
  )
}
