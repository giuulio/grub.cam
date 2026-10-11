import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router'
import { Search } from 'reicon-react'
import { useData } from '../lib/data.tsx'
import { SCOPES, SHARED_FILTERS } from '../lib/finder.ts'
import { REPO_URL, SITE_NAME, venuePath } from '../lib/site.ts'
import { Container } from './Container.tsx'
import { Icon } from './Icon.tsx'
import { Logo } from './Logo.tsx'
import { SCOPE_ICON } from '../lib/icons.ts'
import { ThemeToggle } from './ThemeToggle.tsx'

/** Read at build time (vite.config.ts); null when GitHub couldn't be reached. */
const STARS = import.meta.env.VITE_GITHUB_STARS as number | null

/**
 * The mark and name, a search box, GitHub, the theme, and sending a photo in. On the front page's tabs it stays at the
 * top and spans the window, as Airbnb's does: from a tablet up it holds the tabs (in its top row between the name and
 * the rest, under the search when that's too narrow) and the page's search, wide and glowing Cambridge Blue (on a phone
 * they're the page's own, and it gains the tabs once they've scrolled away); its height (`--header-h`) keeps the map
 * beside the list clear of it. Elsewhere the search box opens the front page.
 */
export function Header() {
  const { pathname } = useLocation()
  const data = useData()
  const status = data.status
  const finder = SCOPES.some((s) => s.path === pathname)
  // On a venue's page, sending a photo is about that venue
  const venue = data.status === 'ready' ? data.venues.find((v) => venuePath(v) === pathname) : undefined
  const header = useRef<HTMLElement>(null)
  const [heroGone, setHeroGone] = useState(false)
  useEffect(() => {
    const hero = finder && document.getElementById('hero-search')
    if (!hero) return
    // Gone once it's above the header (72px), not merely under it
    const observer = new IntersectionObserver(([e]) => setHeroGone(!e.isIntersecting && e.boundingClientRect.top < 0), { rootMargin: '-72px 0px 0px 0px' })
    observer.observe(hero)
    return () => observer.disconnect()
  }, [finder, pathname, status])
  useEffect(() => {
    const el = header.current
    if (!el) return
    // Sticky only on the tabs, and above a phone
    const measure = () => document.documentElement.style.setProperty('--header-h', finder && window.matchMedia('(min-width: 640px)').matches ? `${el.offsetHeight}px` : '0px')
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [finder])
  const [params] = useSearchParams()
  const keep = new URLSearchParams([...params].filter(([k]) => SHARED_FILTERS.includes(k))).toString()
  const tabs = (className: string) => (
    <nav aria-label="Kinds of venue" className={`card-row gap-8 overflow-x-auto text-base font-medium xl:gap-11 ${className}`}>
      {SCOPES.map((s) => (
        <NavLink key={s.scope} to={`${s.path}${keep ? `?${keep}` : ''}`} end className={({ isActive }) => `flex shrink-0 items-center gap-3 border-b-[3px] py-3 whitespace-nowrap transition-colors ${isActive ? 'border-ink text-ink' : 'border-transparent text-muted hover:border-ink/25 hover:text-ink'}`}>
          <Icon of={SCOPE_ICON[s.scope]} className="size-8" />
          {s.label}
        </NavLink>
      ))}
    </nav>
  )
  return (
    <header ref={header} className={finder ? 'header-wash border-b border-ink/10 sm:sticky sm:top-0 sm:z-40' : 'bg-canvas'}>
      {/* On the front page's tabs, as Airbnb's: the name, the tabs in the middle, the rest at the right; the search
          under them. Elsewhere the search sits in the one row. */}
      <Container wide={finder} className={`flex min-h-18 items-center gap-x-6 ${finder ? 'md:min-h-24 md:pt-2 lg:grid lg:grid-cols-[1fr_auto_1fr]' : ''}`}>
        <div className="flex items-center gap-2.5">
          <Link to="/" className="flex items-center gap-2.5 py-4">
            <Logo className={`size-9 shrink-0 ${finder ? 'md:size-10' : ''}`} />
            <span className={`title text-2xl ${finder ? 'md:text-[1.75rem]' : ''}`}>{SITE_NAME}</span>
          </Link>
          {/* Still being built: say so to anyone who lands here */}
          <span title="Still being built: some menus, hours and venues are missing" className="self-end pb-5 text-xs text-muted">beta</span>
        </div>
        {finder ? tabs('hidden justify-center lg:flex') : <HeaderSearch finder={false} />}
        <div className="ml-auto flex items-center gap-2 lg:justify-self-end">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener"
            aria-label={`grub.cam on GitHub${STARS != null ? `, ${STARS} ${STARS === 1 ? 'star' : 'stars'}` : ''}`}
            title="grub.cam on GitHub"
            className="flex h-11 items-center gap-2 rounded-full bg-ink/5 px-4 text-[15px] font-medium text-ink transition-colors hover:bg-ink/10"
          >
            <GitHubIcon className="size-5" />
            {STARS != null && <span>{STARS >= 1000 ? `${(STARS / 1000).toFixed(1).replace(/\.0$/, '')}k` : STARS}</span>}
          </a>
          <ThemeToggle className="size-11 rounded-full bg-ink/5 text-ink hover:bg-ink/10" />
          {pathname !== '/send' && (
            <Link to={venue ? `/send?${new URLSearchParams({ venue: venue.id })}` : '/send'} className="btn btn-primary ml-1 hidden h-11 rounded-full px-5 text-[15px] font-semibold sm:inline-flex sm:h-11">
              Send a photo
            </Link>
          )}
        </div>
      </Container>
      {finder && (
        <Container wide className="hidden pt-3 pb-8 md:block">
          <HeaderSearch finder />
        </Container>
      )}
      {/* Narrower, the tabs go under the search (on a phone, once the page's own have scrolled away) */}
      {finder && <Container wide className={heroGone ? 'hidden sm:block lg:hidden' : 'hidden md:block lg:hidden'}>{tabs('flex justify-center')}</Container>}
    </header>
  )
}

/**
 * On the front page's tabs, the page's own search (the list under it follows as you type); elsewhere a search that
 * opens the front page with it.
 */
function HeaderSearch({ finder }: { finder: boolean }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [params, setParams] = useSearchParams()
  const [draft, setDraft] = useState('')
  const value = finder ? (params.get('q') ?? '') : draft
  const change = (q: string) => {
    if (!finder) return setDraft(q)
    const next = new URLSearchParams(params)
    if (q) next.set('q', q)
    else next.delete('q')
    setParams(next, { replace: true })
  }
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        if (finder) (document.activeElement as HTMLElement | null)?.blur()
        else navigate(draft.trim() ? `/?${new URLSearchParams({ q: draft.trim() })}` : '/')
      }}
      className={`field hidden rounded-full md:flex ${finder ? 'search-glow mx-auto h-16 max-w-[53rem] pr-2 pl-7 text-base sm:h-16' : 'md:w-64 lg:w-96'}`}
    >
      {!finder && <Icon of={Search} />}
      <input type="search" value={value} onChange={(e) => change(e.target.value)} placeholder={SCOPES.find((s) => s.path === pathname)?.placeholder ?? 'Search'} aria-label="Search venues, colleges and dishes" />
      {/* As Airbnb's: a round button at the end of the search */}
      {finder && (
        <button type="submit" aria-label="Search" className="flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-action text-action-ink transition-opacity hover:opacity-90">
          <Icon of={Search} className="size-5" />
        </button>
      )}
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
