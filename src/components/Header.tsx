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
import { useMedia } from '../lib/useMedia.ts'

/** Read at build time (vite.config.ts); null when GitHub couldn't be reached. */
const STARS = import.meta.env.VITE_GITHUB_STARS as number | null

/**
 * The same bar on every page, as Airbnb's compact one: the mark and name, the search with the tabs inside it, GitHub,
 * the theme, and sending a photo in; one row on a wide screen, the search on a row of its own under the rest below that,
 * so the front page's map starts right under it on a phone. It stays at the top above a phone; its height
 * (`--header-h`) keeps what else stays in view (a map beside a list, a venue page's rail) clear of it. On the front
 * page's tabs the search is the page's own; elsewhere it opens the front page.
 */
export function Header() {
  const { pathname } = useLocation()
  const data = useData()
  const finder = SCOPES.some((s) => s.path === pathname)
  // On a venue's page, sending a photo is about that venue
  const venue = data.status === 'ready' ? data.venues.find((v) => venuePath(v) === pathname) : undefined
  const header = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = header.current
    if (!el) return
    // Sticky above a phone
    const measure = () => document.documentElement.style.setProperty('--header-h', window.matchMedia('(min-width: 640px)').matches ? `${el.offsetHeight}px` : '0px')
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])
  return (
    <header ref={header} className="border-b border-ink/10 bg-canvas sm:sticky sm:top-0 sm:z-40">
      <Container className="flex flex-wrap items-center gap-x-4 gap-y-3 py-3 sm:py-4 xl:h-24 xl:flex-nowrap xl:gap-x-8 xl:py-0">
        <div className="flex shrink-0 items-end gap-2.5">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo className="size-9 shrink-0 sm:size-11" />
            <span className="title text-2xl sm:text-[1.875rem]">{SITE_NAME}</span>
          </Link>
          {/* Still being built: say so to anyone who lands here */}
          <span title="Still being built: some menus, hours and venues are missing" className="pb-1 text-xs text-muted">beta</span>
        </div>
        <HeaderSearch finder={finder} />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener"
            aria-label={`grub.cam on GitHub${STARS != null ? `, ${STARS} ${STARS === 1 ? 'star' : 'stars'}` : ''}`}
            title="grub.cam on GitHub"
            className="flex h-11 items-center gap-2 rounded-full bg-ink/5 px-4 text-base font-bold text-ink transition-colors hover:bg-ink/10 sm:h-12"
          >
            <GitHubIcon className="size-5 sm:size-6" />
            {STARS != null && <span>{STARS >= 1000 ? `${(STARS / 1000).toFixed(1).replace(/\.0$/, '')}k` : STARS}</span>}
          </a>
          <ThemeToggle className="size-11 rounded-full bg-ink/5 text-ink hover:bg-ink/10 sm:size-12" />
          {pathname !== '/send' && (
            <Link to={venue ? `/send?${new URLSearchParams({ venue: venue.id })}` : '/send'} className="btn btn-primary ml-1 hidden h-12 rounded-full px-6 text-base font-bold sm:inline-flex sm:h-12">
              Send a photo
            </Link>
          )}
        </div>
      </Container>
    </header>
  )
}

/**
 * A tab per kind of venue, inside the search at its end: each its icon, the picked one (in Cambridge Blue) also its
 * name, so they fit beside what's typed even on a phone. A tab keeps the page's shared filters and the phone's list.
 */
function ScopeTabs() {
  const [params] = useSearchParams()
  const keep = new URLSearchParams([...params].filter(([k]) => SHARED_FILTERS.includes(k) || k === 'view')).toString()
  return (
    <nav aria-label="Kinds of venue" className="card-row flex shrink-0 items-center border-l border-ink/10 pl-1 sm:gap-1 sm:pl-2">
      {SCOPES.map((s) => (
        <NavLink
          key={s.scope}
          to={`${s.path}${keep ? `?${keep}` : ''}`}
          end
          aria-label={s.label}
          title={s.label}
          className={({ isActive }) => `flex h-9 min-w-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-1.5 text-sm sm:h-11 sm:min-w-11 sm:gap-2 sm:px-2.5 sm:text-base sm:font-bold font-medium whitespace-nowrap transition-colors ${isActive ? 'bg-accent pr-2.5 text-accent-ink sm:pr-4' : 'text-muted hover:bg-ink/5 hover:text-ink'}`}
        >
          {({ isActive }) => (
            <>
              <Icon of={SCOPE_ICON[s.scope]} className="size-5 sm:size-6" />
              {isActive && s.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

/**
 * The search, one rounded box glowing Cambridge Blue, as Airbnb's: what's typed, the tabs, and a round button at its
 * end (above a phone). On the front page's tabs it's the page's own search (the list under it follows as you type); elsewhere it opens
 * the front page with it.
 */
function HeaderSearch({ finder }: { finder: boolean }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [params, setParams] = useSearchParams()
  const [draft, setDraft] = useState('')
  const scope = SCOPES.find((s) => s.path === pathname) ?? SCOPES[0]
  // On a phone the tabs leave room for a word; the keyboard's own key searches
  const wide = useMedia('(min-width: 640px)')
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
      className="search-box search-glow order-last flex h-12 w-full items-center gap-1.5 rounded-full border bg-canvas pr-1 pl-4 sm:h-14 sm:gap-2 sm:pr-1.5 sm:pl-6 xl:order-none xl:w-auto xl:max-w-3xl xl:min-w-0 xl:flex-1"
    >
      <input
        type="search"
        value={finder ? (params.get('q') ?? '') : draft}
        onChange={(e) => change(e.target.value)}
        enterKeyHint="search"
        placeholder={wide ? scope.placeholder : 'Search'}
        aria-label={scope.scope === 'all' ? 'Search venues, colleges and dishes' : `Search ${scope.label.toLowerCase()}`}
        className="h-full min-w-0 flex-1 bg-transparent text-[17px] text-ink sm:text-lg outline-none placeholder:text-muted"
      />
      <ScopeTabs />
      <button type="submit" aria-label="Search" className="hidden size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-action text-action-ink transition-opacity hover:opacity-90 sm:flex">
        <Icon of={Search} className="size-5" />
      </button>
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
