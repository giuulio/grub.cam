import { Routing } from 'reicon-react'
import { directions, onApple, type Point } from '../lib/map.ts'
import { Icon } from './Icon.tsx'
import { AppleMapsIcon, GoogleMapsIcon } from './MapAppIcons.tsx'

/**
 * Walking directions to a venue in Apple Maps and Google Maps: two pills side by side, each with its app's icon, after
 * a word saying what they're for and how long the walk is when it's known (`walk`: "4 min walk"); `inline`, on the line
 * beside them where there's room, else over them, as in a venue page's narrow rail. `onFind`: a way to show the walk
 * here, where your location isn't known yet.
 */
export function Directions({ to, walk, onFind, finding = false, inline = false, className = '' }: { to: Point; walk?: string; onFind?: () => void; finding?: boolean; inline?: boolean; className?: string }) {
  const { apple, google } = directions(to)
  return (
    <div className={`${inline ? 'flex items-center' : 'grid grid-cols-2'} gap-2 ${className}`}>
      <span className={`flex items-center gap-2 text-[0.9375rem] text-muted ${inline ? 'mr-1' : 'col-span-2'}`}>
        <Icon of={Routing} className="size-4" />
        Directions
        {walk ? (
          <span className="text-ink"> · {walk}</span>
        ) : (
          onFind && (
            <>
              {' · '}
              <button type="button" onClick={onFind} disabled={finding} className="cursor-pointer font-medium text-cta hover:underline disabled:cursor-default disabled:no-underline">
                {finding ? 'Finding you…' : 'Show the walk from here'}
              </button>
            </>
          )
        )}
      </span>
      <a href={apple} target="_blank" rel="noopener" aria-label="Walking directions in Apple Maps" className="chip h-9 sm:h-9">
        <AppleMapsIcon className="size-[1.125rem] shrink-0" />
        Apple Maps
      </a>
      <a href={google} target="_blank" rel="noopener" aria-label="Walking directions in Google Maps" className="chip h-9 sm:h-9">
        <GoogleMapsIcon className="h-[1.125rem] shrink-0" />
        Google Maps
      </a>
    </div>
  )
}

/** One round button to walking directions, in the device's own maps: Apple's on an iPhone or a Mac, else Google's. */
export function DirectionsButton({ to, className = '' }: { to: Point; className?: string }) {
  const apple = onApple()
  return (
    <a
      href={directions(to)[apple ? 'apple' : 'google']}
      target="_blank"
      rel="noopener"
      aria-label={`Walking directions in ${apple ? 'Apple' : 'Google'} Maps`}
      title="Directions"
      className={`relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full bg-action text-action-ink transition-opacity hover:opacity-90 ${className}`}
    >
      <Icon of={Routing} className="size-5" />
    </a>
  )
}
