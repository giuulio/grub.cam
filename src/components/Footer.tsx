import { Link } from 'react-router'
import { coverage, menuWindow } from '../lib/coverage.ts'
import { useData } from '../lib/data.tsx'
import { ISSUES_URL, REPO_URL } from '../lib/site.ts'
import { Container } from './Container.tsx'

export function Footer() {
  const data = useData()
  const menus = data.status === 'ready' ? coverage(data)[0] : undefined
  const updated = data.status === 'ready' && data.updated ? new Date(data.updated).toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short' }) : undefined

  return (
    <footer className="mt-10 border-t border-ink/10 text-xs text-muted">
      <Container className="flex flex-wrap items-center gap-x-5 gap-y-2 py-6">
        <Link to="/about" className="hover:text-ink">About</Link>
        <a href={REPO_URL} target="_blank" rel="noopener" className="hover:text-ink">GitHub</a>
        <a href={ISSUES_URL} target="_blank" rel="noopener" className="transition-colors hover:text-ink">
          Report an error
        </a>
        {data.status === 'ready' && menus && (
          <Link to="/coverage" className="transition-colors hover:text-ink">
            Menus for {menuWindow(data, true)} from {menus.have} of {menus.of} colleges
          </Link>
        )}
        {updated && <span>Menus updated {updated}</span>}
        <span className="sm:ml-auto">Not affiliated with the University of Cambridge or its colleges.</span>
      </Container>
    </footer>
  )
}
