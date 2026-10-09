import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { coverage, menuWindow } from '../lib/coverage.ts'
import { useData } from '../lib/data.tsx'
import { ISSUES_URL, REPO_URL, SITE_NAME } from '../lib/site.ts'
import { Container } from './Container.tsx'

/** What the site is and how fresh its menus are; where to browse; the project and its terms; who it isn't. */
export function Footer() {
  const data = useData()
  const menus = data.status === 'ready' ? coverage(data)[0] : undefined
  const updated = data.status === 'ready' && data.updated ? new Date(data.updated).toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short' }) : undefined

  return (
    <footer className="mt-16 border-t border-ink/10 text-sm">
      <Container className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="max-w-sm">
          <p className="font-semibold tracking-tight">{SITE_NAME}</p>
          <p className="mt-2 text-muted">Menus, opening hours and who can go in, for Cambridge college and University dining halls, cafés and bars.</p>
          {data.status === 'ready' && menus && (
            <p className="mt-4 text-muted">
              <Link to="/coverage" className="underline decoration-ink/30 underline-offset-4 transition-colors hover:text-ink hover:decoration-ink">
                Menus for {menuWindow(data, true)} from {menus.have} of {menus.of} colleges
              </Link>
              {updated && <span> · updated {updated}</span>}
            </p>
          )}
        </div>
        <FooterLinks title="Browse">
          <Link to="/">Explore</Link>
          <Link to="/directory">Directory</Link>
          <Link to="/coverage">Coverage</Link>
        </FooterLinks>
        <FooterLinks title="Project">
          <Link to="/about">About</Link>
          <a href={ISSUES_URL} target="_blank" rel="noopener">Report an error</a>
          <a href={REPO_URL} target="_blank" rel="noopener">GitHub</a>
          <Link to="/terms">Terms and privacy</Link>
        </FooterLinks>
      </Container>
      <div className="border-t border-ink/10">
        <Container className="flex flex-wrap justify-between gap-x-6 gap-y-2 py-5 text-xs text-muted">
          <span>© {new Date().getFullYear()} {SITE_NAME}</span>
          <span>Independent. Not affiliated with the University of Cambridge or its colleges.</span>
        </Container>
      </div>
    </footer>
  )
}

function FooterLinks({ title, children }: { title: string; children: ReactNode[] }) {
  return (
    <nav aria-label={title}>
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-3 space-y-2 text-muted">
        {children.map((link, i) => (
          <li key={i} className="transition-colors hover:text-ink">
            {link}
          </li>
        ))}
      </ul>
    </nav>
  )
}
