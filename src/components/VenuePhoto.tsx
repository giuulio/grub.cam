import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Buildings, Camera, GraduationCap } from 'reicon-react'
import { TYPE_LABEL } from '../lib/filters.ts'
import { TYPE_ICON } from '../lib/icons.ts'
import { byMember, licenceUrl, photoSrc, sitePhoto, sourceUrl, venuePhoto } from '../lib/photos.ts'
import { sendPath } from '../lib/site.ts'
import type { Photo, Site, Venue, VenueType } from '../lib/types.ts'
import { Icon } from './Icon.tsx'

/**
 * A photo, cropped to fill its box (`className`), its average colour showing until it loads. `sizes` is how wide it's
 * shown, so the browser picks the smallest file that's sharp enough; `eager` for the one at the top of a page.
 * `decorative` when text beside it already says what it shows. `onFail` when it can't load, so the caller can stand
 * something in for it.
 */
function PhotoImg({ photo, sizes, className = '', eager = false, decorative = false, onFail }: { photo: Photo; sizes: string; className?: string; eager?: boolean; decorative?: boolean; onFail: () => void }) {
  return (
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
      ref={(el) => { if (el?.complete && !el.naturalWidth) onFail() }}
      onError={onFail}
      style={{ backgroundColor: photo.color ?? undefined }}
      className={`object-cover ${className}`}
    />
  )
}

/**
 * A venue's picture, in a box the caller shapes (`className`): its photo, or, when it has none or the photo can't
 * load, its type's tile (the type's tint, its icon in the middle, `icon` sized). `overlay` sits over a photo, never
 * over the tile.
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
  const img = <PhotoImg photo={photo} sizes={sizes} eager={eager} decorative={decorative} onFail={() => setFailed(photo.path)} className={overlay ? 'size-full rounded-[inherit]' : className} />
  if (!overlay) return img
  return (
    <span className={`relative shrink-0 ${className}`}>
      {img}
      {overlay}
    </span>
  )
}

/** A type's colour with its icon, as on the map: cards and headings use it, so they read as its key. `label` when its name is already written beside it (or read out by the row it sits in). */
export function TypeMark({ type, className = 'size-5', label = false }: { type: VenueType; className?: string; label?: boolean }) {
  return (
    <span className={`type-mark ${className}`} data-type={type} title={label ? undefined : TYPE_LABEL[type]}>
      <Icon of={TYPE_ICON[type]} className="size-[60%]" />
      {!label && <span className="sr-only">{TYPE_LABEL[type]}</span>}
    </span>
  )
}

/** A type's mark with its name beside it, "● Dining": a venue's kind is written the same way wherever it's written. */
export function TypeLabel({ type, className = '', mark = 'size-5' }: { type: VenueType; className?: string; mark?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <TypeMark type={type} className={mark} label />
      {TYPE_LABEL[type]}
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

/**
 * A site's picture, in a box the caller shapes (`className`): its photo; or, until it has one or when it can't load, a
 * plain tile with a mortarboard for a college and a building for a University site (`icon` sized). Decorative: the
 * row or page names the site. `sizes` is how wide it's shown; `eager` for a page's banner.
 */
export function SiteImage({ site, sizes, className = '', icon = 'size-[40%]', eager = false }: { site: Site; sizes: string; className?: string; icon?: string; eager?: boolean }) {
  const photo = sitePhoto(site)
  const [failed, setFailed] = useState<string>()
  if (!photo || failed === photo.path)
    return (
      <span className={`flex shrink-0 items-center justify-center bg-ink/6 text-muted ${className}`}>
        <Icon of={site.kind === 'college' ? GraduationCap : Buildings} className={icon} />
      </span>
    )
  return <PhotoImg photo={photo} sizes={sizes} eager={eager} decorative onFail={() => setFailed(photo.path)} className={`shrink-0 ${className}`} />
}

/** A site in a list: a small square of its photo, rounded as `className` says (a list's thumbnail is `rounded-lg`). */
export function SiteThumb({ site, className = 'size-16 rounded-lg', sizes = '4rem' }: { site: Site; className?: string; sizes?: string }) {
  return <SiteImage site={site} sizes={sizes} className={className} />
}

// A page's banner, venue's or site's: across the page's column (76rem), as wide as Luma's against its height
const BANNER = 'block aspect-5/2 w-full sm:rounded-[20px] lg:aspect-7/2'
const BANNER_SIZES = '(min-width: 1312px) 76rem, 100vw'

/**
 * The venue page's banner: its photo across the page, credited under it (a member's by name, over its foot); its
 * type's tile until it has one. In its top corner, the way to send a better one, which replaces it once checked.
 */
export function VenueBanner({ venue }: { venue: Venue }) {
  const photo = venuePhoto(venue)
  const member = photo && byMember(photo)
  return (
    <figure className="relative -mx-4 mb-8 sm:mx-0">
      <VenueImage venue={venue} sizes={BANNER_SIZES} eager icon="size-12" className={BANNER} overlay={member && <MemberCredit photo={photo} />} />
      <Link
        to={sendPath(venue, 'photo')}
        className="absolute top-3 right-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-canvas/90 px-3.5 text-sm font-semibold text-ink shadow-sm backdrop-blur transition-colors hover:bg-canvas sm:top-4 sm:right-4"
      >
        <Icon of={Camera} className="size-4" />
        {photo ? (
          <span>
            Have a better photo?<span className="max-sm:hidden"> Send it</span>
          </span>
        ) : (
          'Add a photo'
        )}
      </Link>
      {photo && !member && <PhotoCredit photo={photo} className="mt-2 px-4 sm:px-0" />}
    </figure>
  )
}

/** A member's name over the foot of their photo, with its licence: "Jane Smith · CC BY 4.0". */
function MemberCredit({ photo }: { photo: Photo }) {
  const deed = licenceUrl(photo.licence)
  return (
    <span className="absolute bottom-3 left-3 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-md bg-black/55 px-2.5 py-1 text-xs text-white backdrop-blur sm:bottom-4 sm:left-4">
      <Icon of={Camera} className="size-3.5 shrink-0" />
      <span className="truncate">{photo.credit ?? 'A member'}</span>
      {photo.licence && (
        <>
          <span aria-hidden="true">·</span>
          {deed ? <a href={deed} target="_blank" rel="noopener license" className="shrink-0 underline underline-offset-2">{photo.licence}</a> : <span className="shrink-0">{photo.licence}</span>}
        </>
      )}
    </span>
  )
}

/** A site's page banner, as a venue's: its photo across the top, credited under it; a plain tile until it has one. */
export function SiteBanner({ site }: { site: Site }) {
  const photo = sitePhoto(site)
  return (
    <figure className="-mx-4 mb-8 sm:mx-0">
      <SiteImage site={site} sizes={BANNER_SIZES} eager icon="size-12" className={BANNER} />
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
