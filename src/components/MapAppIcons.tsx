// The maps apps' own icons, to label the links to them: Apple Maps' as watchOS draws it (a blue arrow on a map), in an
// app icon's rounded square, and Google Maps' pin (2020). Both public domain on Wikimedia Commons; the marks are Apple's
// and Google's, used only to name their apps.
import { useId } from 'react'

export function AppleMapsIcon({ className = '' }: { className?: string }) {
  // An id of its own for each, of characters a url() takes
  const tile = `apple-maps-${useId().replace(/[^\w-]/g, '')}`
  return (
    <svg viewBox="0 0 512 512" aria-hidden="true" className={className}>
      <clipPath id={tile}>
        <rect width="512" height="512" rx="115" />
      </clipPath>
      <g clipPath={`url(#${tile})`}>
        <rect width="512" height="512" fill="#fff" />
        <rect width="173" height="512" fill="#beb99e" />
        <rect width="170" height="512" fill="#e4ddc9" />
        <rect x="337" width="175" height="173" fill="#88ad58" />
        <rect x="340" width="172" height="170" fill="#76c63b" />
        <rect x="337" y="339" width="175" height="173" fill="#caada2" />
        <rect x="340" y="342" width="172" height="170" fill="#fbc6d1" />
        <circle cx="256" cy="256" r="128" fill="#007aff" />
        <polygon points="256 171.5 203.5 341 256 282 308.5 341" fill="#fff" />
      </g>
      <rect x="0.5" y="0.5" width="511" height="511" rx="115" fill="none" stroke="#0000001f" strokeWidth="8" />
    </svg>
  )
}

export function GoogleMapsIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 92.3 132.3" aria-hidden="true" className={className}>
      <path fill="#1a73e8" d="M60.2 2.2C55.8.8 51 0 46.1 0 32 0 19.3 6.4 10.8 16.5l21.8 18.3L60.2 2.2z" />
      <path fill="#ea4335" d="M10.8 16.5C4.1 24.5 0 34.9 0 46.1c0 8.7 1.7 15.7 4.6 22l28-33.3-21.8-18.3z" />
      <path fill="#4285f4" d="M46.2 28.5c9.8 0 17.7 7.9 17.7 17.7 0 4.3-1.6 8.3-4.2 11.4 0 0 13.9-16.6 27.5-32.7-5.6-10.8-15.3-19-27-22.7L32.6 34.8c3.3-3.8 8.1-6.3 13.6-6.3" />
      <path fill="#fbbc04" d="M46.2 63.8c-9.8 0-17.7-7.9-17.7-17.7 0-4.3 1.5-8.3 4.1-11.3l-28 33.3c4.8 10.6 12.8 19.2 21 29.9l34.1-40.5c-3.3 3.9-8.1 6.3-13.5 6.3" />
      <path fill="#34a853" d="M59.1 109.2c15.4-24.1 33.3-35 33.3-63 0-7.7-1.9-14.9-5.2-21.3L25.6 98c2.6 3.4 5.3 7.3 7.9 11.3 9.4 14.5 6.8 23.1 12.8 23.1s3.4-8.7 12.8-23.2" />
    </svg>
  )
}
