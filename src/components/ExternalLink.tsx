import { ArrowRightUp } from 'reicon-react'
import { Icon } from './Icon.tsx'

/** A link off the site, labelled with its host ("sel.cam.ac.uk ↗"). */
export function ExternalLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink">
      {new URL(href).hostname.replace(/^www\./, '')}
      <Icon of={ArrowRightUp} className="size-3.5" />
    </a>
  )
}
