import { Gallery } from 'reicon-react'
import { photoSrc, venuePhoto } from '../lib/photos.ts'
import type { Photo, Venue } from '../lib/types.ts'
import { Icon } from './Icon.tsx'

/**
 * A photo at 3:2, cropped to fill, its dominant colour showing until it loads. `sizes` is how wide it's shown, so the
 * browser picks the smallest file that's sharp enough.
 */
export function PhotoImg({ photo, sizes, className = '', eager = false }: { photo: Photo; sizes: string; className?: string; eager?: boolean }) {
  return (
    <img
      src={photoSrc(photo, photo.widths.find((w) => w >= 960) ?? photo.widths.at(-1)!)}
      srcSet={photo.widths.map((w) => `${photoSrc(photo, w)} ${w}w`).join(', ')}
      sizes={sizes}
      width={photo.width}
      height={photo.height}
      alt={photo.alt}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : undefined}
      style={{ backgroundColor: photo.color ?? undefined }}
      className={`aspect-[3/2] w-full object-cover ${className}`}
    />
  )
}

/** The venue page's photo, with its credit; until there is one, a place for it. */
export function VenuePhoto({ venue }: { venue: Venue }) {
  const photo = venuePhoto(venue)
  if (!photo)
    return (
      <div className="flex h-16 items-center justify-center gap-2 rounded-2xl border border-dashed border-ink/15 text-sm text-muted md:aspect-[3/1] md:h-auto">
        <Icon of={Gallery} />
        No photo yet
      </div>
    )
  return (
    <figure>
      <PhotoImg photo={photo} sizes="(min-width: 1024px) 20rem, (min-width: 768px) 17rem, 100vw" eager className="rounded-2xl" />
      {photo.credit && <figcaption className="mt-1.5 text-xs text-muted">Photo: {photo.credit}</figcaption>}
    </figure>
  )
}
