import { MARK_PATH, MARK_VIEWBOX } from '../lib/mark.ts'

/** The ermine fork, in the text colour unless given one; decorative, so hidden from screen readers. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox={MARK_VIEWBOX} aria-hidden="true" className={className}>
      <path d={MARK_PATH} fill="currentColor" />
    </svg>
  )
}
