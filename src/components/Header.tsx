import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router'
import { AddCircle } from 'reicon-react'
import { SCOPES, SHARED_FILTERS } from '../lib/finder.ts'
import { SITE_NAME } from '../lib/site.ts'
import { AccountButton } from './Account.tsx'
import { Container } from './Container.tsx'
import { Icon } from './Icon.tsx'
import { SCOPE_ICON } from '../lib/icons.ts'
import { ThemeToggle } from './ThemeToggle.tsx'
import { useMedia } from '../lib/useMedia.ts'

/**
 * The same bar on every page, as Airbnb's compact one: the name (no mark), the search with the tabs inside it,
 * Contribute (the one thing we ask of everyone, so in the action colour), the theme and your account (signing in with a
 * Cambridge account, `AccountButton`), all as tall as the search; GitHub is in the footer; one 112px row on a wide screen, the search on a row of its own under the rest below that. On a phone's
 * front page the search is over the map instead (the Finder draws it there), so the bar is one row and the map starts
 * right under it. It stays at the top above a phone; its height (`--header-h`) keeps what else stays in view (a map
 * beside a list, a venue page's rail) clear of it. On the front page's tabs the search is the page's own; elsewhere it
 * opens the front page.
 */
export function Header() {
  const { pathname } = useLocation()
  const finder = SCOPES.some((s) => s.path === pathname)
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
      {/* From 1280px, three columns, so the search sits in the middle of the page whatever is either side of it */}
      <Container className="flex flex-wrap items-center gap-x-4 gap-y-3.5 py-3.5 sm:py-5 xl:grid xl:h-28 xl:grid-cols-[1fr_minmax(0,46rem)_1fr] xl:gap-x-8 xl:py-0">
        <div className="flex shrink-0 items-center gap-3">
          {/* Up a tenth of its size: its letters are mostly lowercase, so its box centred leaves them low beside the
              search, and the Beta pill, centred on the row, high beside them */}
          <Link to="/" className="title -translate-y-[0.1em] text-2xl sm:text-[1.875rem]">
            {SITE_NAME}
          </Link>
          {/* Still being built: say so to anyone who lands here */}
          <span title="Still being built: some menus, hours and venues are missing" className="beta-pill">Beta</span>
        </div>
        {/* On a phone's front page, the search is over the map */}
        <HeaderSearch finder={finder} className={`order-last w-full xl:order-none ${finder ? 'max-md:hidden' : ''}`} />
        <div className="ml-auto flex shrink-0 items-center gap-2 xl:justify-self-end">
          <NavLink
            to="/contribute"
            aria-label="Contribute"
            title="Add what you see, and see who has"
            className="header-pill w-12 gap-2.5 bg-action text-action-ink hover:bg-action hover:opacity-90 sm:w-auto sm:px-6"
          >
            <Icon of={AddCircle} className="size-6" />
            <span className="max-sm:hidden">Contribute</span>
          </NavLink>
          <ThemeToggle className="header-pill w-12 sm:w-14" />
          <AccountButton />
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
 * The search, one rounded box glowing Cambridge Blue, as Airbnb's: what's typed, then the tabs; the keyboard's key
 * searches. On the front page's tabs it's the page's own search (the list and map follow as you type); elsewhere it
 * opens the front page with it. `className` places it: in the header, or over a phone's map.
 */
export function HeaderSearch({ finder, className = '' }: { finder: boolean; className?: string }) {
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
      className={`search-box search-glow flex h-12 items-center gap-1.5 rounded-full border bg-canvas pr-1.5 pl-4 sm:h-14 sm:gap-2 sm:pl-6 ${className}`}
    >
      <input
        type="search"
        value={finder ? (params.get('q') ?? '') : draft}
        onChange={(e) => change(e.target.value)}
        enterKeyHint="search"
        placeholder={wide ? scope.placeholder : 'Search'}
        aria-label={scope.scope === 'all' ? 'Search venues, colleges and dishes' : `Search ${scope.label.toLowerCase()}`}
        className="h-full min-w-0 flex-1 bg-transparent text-[1.0625rem] text-ink sm:text-lg outline-none placeholder:text-muted"
      />
      <ScopeTabs />
    </form>
  )
}
