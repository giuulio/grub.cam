import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router'
import { Search } from 'reicon-react'
import { useData } from '../lib/data.tsx'
import { REPO_URL, SITE_NAME } from '../lib/site.ts'
import { Container } from './Container.tsx'
import { Icon } from './Icon.tsx'
import { ThemeToggle } from './ThemeToggle.tsx'

/** Read at build time (vite.config.ts); null when GitHub couldn't be reached. */
const STARS = import.meta.env.VITE_GITHUB_STARS as number | null

/** Pages that aren't part of the directory; anything else under a slug is a site or a venue in it. */
const NOT_DIRECTORY = ['/', '/explore', '/about', '/coverage', '/terms', '/credits', '/send']

/** The kinds of venue, as the front page's tabs: the header lists them once those have scrolled away. */
const TYPE_LINKS: [string, string][] = [['/explore?type=hall', 'Dining'], ['/explore?type=cafe', 'Cafés'], ['/explore?type=bar', 'Bars'], ['/explore?type=hall&meal=formal', 'Formal hall'], ['/directory', 'Colleges and sites']]

/**
 * The name, Explore and the Directory, GitHub, the theme, and sending a photo in. On the front page it stays at the
 * top, as Tripadvisor's does, and once the page's own search has scrolled away it gains a search box and the kinds
 * of venue.
 */
export function Header() {
  const { pathname } = useLocation()
  const status = useData().status
  const home = pathname === '/'
  const inDirectory = pathname === '/directory' || !NOT_DIRECTORY.includes(pathname)
  const [heroGone, setHeroGone] = useState(false)
  useEffect(() => {
    const hero = home && document.getElementById('hero-search')
    if (!hero) return
    // Gone once it's above the header (64px), not merely under it
    const observer = new IntersectionObserver(([e]) => setHeroGone(!e.isIntersecting && e.boundingClientRect.top < 0), { rootMargin: '-64px 0px 0px 0px' })
    observer.observe(hero)
    return () => observer.disconnect()
  }, [home, status])
  const compact = home && heroGone
  const tab = (active: boolean) => `border-b-2 py-3 text-sm transition-colors sm:py-5 ${active ? 'border-ink font-medium text-ink' : 'border-transparent text-muted hover:text-ink'}`
  return (
    <header className={`border-b border-ink/10 bg-canvas ${home ? 'sm:sticky sm:top-0 sm:z-40' : ''}`}>
      <Container className="flex min-h-16 flex-wrap items-center gap-x-6 gap-y-0">
        <div className="flex items-baseline gap-2">
          <Link to="/" className="title py-4 text-xl">{SITE_NAME}</Link>
          {/* Still being built: say so to anyone who lands here */}
          <span title="Still being built: some menus, hours and venues are missing" className="text-xs text-muted">beta</span>
        </div>
        {compact && <HeaderSearch />}
        <nav aria-label="Main navigation" className="order-3 flex w-full gap-6 sm:order-0 sm:ml-4 sm:w-auto">
          <NavLink to="/explore" className={({ isActive }) => tab(isActive)}>Explore</NavLink>
          <NavLink to="/directory" className={() => tab(inDirectory)}>Directory</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener"
            aria-label={`grub.cam on GitHub${STARS != null ? `, ${STARS} ${STARS === 1 ? 'star' : 'stars'}` : ''}`}
            title="grub.cam on GitHub"
            className="flex h-10 items-center gap-2 rounded-lg px-3 text-sm text-muted transition-colors hover:bg-ink/8 hover:text-ink"
          >
            <GitHubIcon className="size-4.5" />
            {STARS != null && <span>{STARS >= 1000 ? `${(STARS / 1000).toFixed(1).replace(/\.0$/, '')}k` : STARS}</span>}
          </a>
          <ThemeToggle />
          {pathname !== '/send' && (
            <Link to="/send" className="btn btn-primary ml-1 hidden rounded-full px-5 sm:inline-flex">
              Send a photo
            </Link>
          )}
        </div>
      </Container>
      {compact && (
        <Container className="hidden sm:block">
          <nav aria-label="Kinds of venue" className="card-row flex gap-7 overflow-x-auto pb-3 text-[15px] font-medium">
            {TYPE_LINKS.map(([to, label]) => (
              <Link key={to} to={to} className="shrink-0 whitespace-nowrap underline-offset-[6px] hover:underline">
                {label}
              </Link>
            ))}
          </nav>
        </Container>
      )}
    </header>
  )
}

/** A search box that opens Explore: the list for words (they find dishes too), the map without. */
function HeaderSearch() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        navigate(q.trim() ? `/explore?${new URLSearchParams({ q: q.trim(), view: 'list' })}` : '/explore')
      }}
      className="field hidden rounded-full md:flex md:w-64 lg:w-96"
    >
      <Icon of={Search} />
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search venues, colleges and dishes" />
    </form>
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
