import { Link, NavLink } from 'react-router'
import { SITE_NAME } from '../lib/site.ts'
import { ThemeToggle } from './ThemeToggle.tsx'
import { Container } from './Container.tsx'

export function Header() {
  return (
    <header className="border-b border-ink/10 bg-canvas">
      <Container className="flex min-h-16 flex-wrap items-center gap-x-6 gap-y-0">
        <Link to="/" className="py-5 font-semibold tracking-tight text-ink">{SITE_NAME}</Link>
        <nav aria-label="Main navigation" className="order-3 flex w-full gap-6 sm:order-none sm:ml-4 sm:w-auto">
          {([['/', 'Explore'], ['/colleges', 'Colleges'], ['/university', 'University']] as const).map(([to, label]) => (
            <NavLink key={to} to={to} end className={({ isActive }) => `border-b-2 py-3 text-sm transition-colors sm:py-5 ${isActive ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'}`}>{label}</NavLink>
          ))}
        </nav>
        <div className="ml-auto"><ThemeToggle /></div>
      </Container>
    </header>
  )
}
