import { Link, NavLink, useLocation } from 'react-router'
import { REPO_URL, SITE_NAME } from '../lib/site.ts'
import { Container } from './Container.tsx'
import { ThemeToggle } from './ThemeToggle.tsx'

/** Read at build time (vite.config.ts); null when GitHub couldn't be reached. */
const STARS = import.meta.env.VITE_GITHUB_STARS as number | null

/** Pages that aren't part of the directory; anything else under a slug is a site or a venue in it. */
const NOT_DIRECTORY = ['/', '/about', '/coverage', '/terms']

export function Header() {
  const { pathname } = useLocation()
  const inDirectory = pathname === '/directory' || !NOT_DIRECTORY.includes(pathname)
  const tab = (active: boolean) => `border-b-2 py-3 text-sm transition-colors sm:py-5 ${active ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'}`
  return (
    <header className="border-b border-ink/10 bg-canvas">
      <Container className="flex min-h-16 flex-wrap items-center gap-x-6 gap-y-0">
        <div className="flex items-center gap-2">
          <Link to="/" className="py-5 font-semibold tracking-tight text-ink">{SITE_NAME}</Link>
          {/* Still being built: say so to anyone who lands here */}
          <span title="Still being built: some menus, hours and places are missing" className="rounded-full border border-ink/20 px-1.5 text-[10px] leading-4 font-medium tracking-wide text-muted uppercase">Beta</span>
        </div>
        <nav aria-label="Main navigation" className="order-3 flex w-full gap-6 sm:order-0 sm:ml-4 sm:w-auto">
          <NavLink to="/" end className={({ isActive }) => tab(isActive)}>Explore</NavLink>
          <NavLink to="/directory" className={() => tab(inDirectory)}>Directory</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener"
            aria-label={`grub.cam on GitHub${STARS != null ? `, ${STARS} ${STARS === 1 ? 'star' : 'stars'}` : ''}`}
            title="grub.cam on GitHub"
            className="flex h-9 items-center gap-2 rounded-full bg-ink/8 px-3.5 text-sm font-medium text-ink transition-colors hover:bg-ink/14"
          >
            <GitHubIcon className="size-4.5" />
            {STARS != null && <span>{STARS >= 1000 ? `${(STARS / 1000).toFixed(1).replace(/\.0$/, '')}k` : STARS}</span>}
          </a>
          <ThemeToggle />
        </div>
      </Container>
    </header>
  )
}

/** GitHub's mark (octicon "mark-github"). */
export function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  )
}
