import { useCallback, useEffect, useState } from 'react'
import { inCambridge, type Point } from './map.ts'

// Where you are, for nearest first, the map's dot and the walk to a venue. Asked for when you say so; found as the page
// opens when this browser already lets grub.cam know (no prompt then), unless you turned nearest first off. Kept in
// memory only, for the visit: a venue page knows where you are once the front page does.

let last: Point | undefined

/** What the browser says about sharing location with grub.cam; `unknown` where it won't say (older Safari). */
export type Permission = 'granted' | 'prompt' | 'denied' | 'unknown'

// Per-browser conveniences: nearest first turned off, and the offer to turn it on put away
const OFF = 'grub-near-off'
const DISMISSED = 'grub-near-offer-dismissed'
const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const write = (key: string, on: boolean) => {
  try {
    if (on) localStorage.setItem(key, '1')
    else localStorage.removeItem(key)
  } catch {
    // Private windows can refuse storage: it's only a convenience
  }
}

/** Which settings a message points to: a phone's are its own, not the browser's */
function device(): 'ios' | 'android' | 'mac' | 'other' {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return /Macintosh/.test(ua) ? 'mac' : 'other'
}

/** Why there's no location, and where to change that on this device. */
function failure(code: number): string {
  const on = device()
  if (code === 1)
    return on === 'ios' ? 'Your iPhone didn’t share your location. In Settings › Privacy & Security › Location Services, turn it on and set your browser (Safari Websites, or Chrome) to While Using; then try again and allow grub.cam.'
    : on === 'android' ? 'Location is blocked for grub.cam. Tap the icon left of the address, allow Location under Permissions, and check your phone’s location is on; then try again.'
    : on === 'mac' ? 'Location is blocked for grub.cam. Allow it in your browser’s settings for this site, and for your browser in System Settings › Privacy & Security › Location Services; then try again.'
    : 'Location is blocked for grub.cam. Allow it in your browser’s settings for this site, then try again.'
  if (code === 2)
    return on === 'ios' ? 'Your iPhone couldn’t tell where you are. Check Location Services is on in Settings › Privacy & Security.'
    : on === 'android' ? 'Your phone couldn’t tell where you are. Check its location is on.'
    : on === 'mac' ? 'Your Mac couldn’t tell where you are. Check Location Services is on for your browser (System Settings › Privacy & Security › Location Services) and Wi-Fi is on.'
    : 'Your device couldn’t tell where you are. Check its location services are on.'
  return 'Finding you took too long. Try again, with Wi-Fi on or near a window.'
}

const position = (options: PositionOptions) => new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, options))

/**
 * A rough fix first (Wi-Fi, quick, often already known); when that fails or takes too long, GPS, which a phone indoors
 * can take a while to get. A refusal isn't asked again.
 */
async function findHere(): Promise<Point> {
  let p: GeolocationPosition
  try {
    p = await position({ timeout: 10_000, maximumAge: 5 * 60_000 })
  } catch (e) {
    if ((e as GeolocationPositionError).code === 1) throw e
    p = await position({ enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 })
  }
  return { latitude: p.coords.latitude, longitude: p.coords.longitude }
}

/**
 * Where you are (`here`), whether it's being found, what went wrong (`note`), and the browser's answer so far
 * (`permission`). `toggle` turns nearest first on (asking, the first time) or off; `offer` is whether to offer it
 * unasked: the browser would ask, and the offer hasn't been put away (`dismiss`).
 */
export function useHere() {
  const [here, setHereState] = useState<Point | undefined>(() => last)
  const setHere = (p?: Point) => {
    last = p
    setHereState(p)
  }
  const [locating, setLocating] = useState(false)
  const [note, setNote] = useState('')
  // Not known until the browser answers, so nothing is offered to someone who's already said yes
  const [permission, setPermission] = useState<Permission | undefined>(() => (typeof navigator !== 'undefined' && !navigator.permissions ? 'unknown' : undefined))
  const [dismissed, setDismissed] = useState(() => typeof window !== 'undefined' && read(DISMISSED) === '1')

  // `quiet`: as the page opens, a failure says nothing
  const locate = useCallback(async (quiet = false) => {
    if (!navigator.geolocation) return quiet || setNote('Your browser doesn’t share its location.')
    setLocating(true)
    setNote('')
    try {
      const p = await findHere()
      if (inCambridge(p)) setHere(p)
      else if (!quiet) setNote('You’re outside Cambridge, so the list stays as it is.')
    } catch (e) {
      if (!quiet) setNote(failure((e as GeolocationPositionError).code))
    } finally {
      setLocating(false)
    }
  }, [])

  useEffect(() => {
    let status: PermissionStatus | undefined
    let gone = false
    if (!navigator.permissions) return
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((s) => {
        if (gone) return
        status = s
        setPermission(s.state)
        s.onchange = () => setPermission(s.state)
        // Already allowed: nearest first from the start, as it was left
        if (s.state === 'granted' && read(OFF) !== '1' && !last) locate(true)
      })
      .catch(() => !gone && setPermission('unknown'))
    return () => {
      gone = true
      if (status) status.onchange = null
    }
  }, [locate])

  const toggle = () => {
    write(OFF, !!here)
    if (here) setHere(undefined)
    else locate()
  }
  const dismiss = () => {
    write(DISMISSED, true)
    setDismissed(true)
  }
  const offer = !here && !dismissed && (permission === 'prompt' || permission === 'unknown')
  return { here, locating, note, clearNote: () => setNote(''), permission, toggle, offer, dismiss }
}
