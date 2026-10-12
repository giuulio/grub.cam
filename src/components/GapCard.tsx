import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { NoteAdd, type IconComponent } from 'reicon-react'
import { Icon } from './Icon.tsx'

/**
 * What a venue's page doesn't have yet, where it would be, loud enough to see and act on: Light Blue (an invitation, not
 * an error, so not red), what's missing in a line, how to help (a photo or the text, either does), and one pill to send
 * it. `children`: anything else to say under the line (where the menu is published, say).
 */
export function GapCard({ title, body, to, action, icon = NoteAdd, children }: { title: string; body: ReactNode; to: string; action: string; icon?: IconComponent; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-cta-bg p-5 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-canvas text-cta">
        <Icon of={icon} className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold text-ink">{title}</p>
        <p className="mt-1 text-muted">{body}</p>
        {children}
      </div>
      <Link to={to} className="btn btn-primary h-12 shrink-0 self-start rounded-full px-6 text-base font-bold sm:h-12 sm:self-center">
        {action}
      </Link>
    </div>
  )
}

/**
 * A gap in something the page does show, said in a line at the top of it: Light Blue, as a GapCard, what's missing,
 * and the link to send it (a Dining menu without its prices).
 */
export function GapLine({ children, to, action }: { children: ReactNode; to: string; action: string }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-cta-bg px-4 py-3 text-[0.9375rem]">
      <Icon of={NoteAdd} className="size-5 text-cta" />
      <span className="min-w-0 flex-1">{children}</span>
      <Link to={to} className="font-semibold text-cta underline-offset-2 hover:underline">
        {action}
      </Link>
    </p>
  )
}

/** How anything gets in, said once: a photo or the text, either does. */
export const SEND_EITHER = 'Send a photo of it, or type out what it says.'
