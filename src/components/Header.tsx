import { Link, NavLink } from 'react-router'
import { SITE_NAME } from '../lib/site.ts'
import { ThemeToggle } from './ThemeToggle.tsx'
import { Container } from './Container.tsx'

export function Header() {
  return (
    <header className="border-b border-ink/10 bg-canvas">
      <Container className="flex min-h-16 flex-wrap items-center gap-x-6 gap-y-0">
        <div className="flex items-center gap-2">
          <Link to="/" className="py-5 font-semibold tracking-tight text-ink">{SITE_NAME}</Link>
          {/* Still being built: say so to anyone who lands here */}
          <span title="Still being built: some menus, hours and places are missing" className="rounded-full border border-ink/20 px-1.5 text-[10px] leading-4 font-medium tracking-wide text-muted uppercase">Beta</span>
        </div>
        <nav aria-label="Main navigation" className="order-3 flex w-full gap-6 sm:order-0 sm:ml-4 sm:w-auto">
          {([['/', 'Explore'], ['/colleges', 'Colleges'], ['/university', 'University']] as const).map(([to, label]) => (
            <NavLink key={to} to={to} end className={({ isActive }) => `border-b-2 py-3 text-sm transition-colors sm:py-5 ${isActive ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'}`}>{label}</NavLink>
          ))}
        </nav>
        <div className="ml-auto"><ThemeToggle /></div>
      </Container>
    </header>
  )
}
