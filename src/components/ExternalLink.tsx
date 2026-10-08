/** A link off the site, labelled with its host ("sel.cam.ac.uk ↗"). */
export function ExternalLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener" className="text-sm text-white/50 transition-colors hover:text-white">
      {new URL(href).hostname.replace(/^www\./, '')} ↗
    </a>
  )
}
