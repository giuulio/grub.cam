import type { IconComponent } from 'reicon-react'

/** A reicon (reicon.dev) icon, decorative: whatever it sits next to (or an aria-label) carries the meaning. */
export function Icon({ of: Of, className }: { of: IconComponent; className?: string }) {
  return <Of aria-hidden="true" focusable="false" className={`shrink-0 ${className ?? 'size-4'}`} />
}
