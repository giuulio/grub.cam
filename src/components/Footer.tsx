import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useData } from '../lib/data.tsx'
import { ISSUES_URL, REPO_URL, SITE_NAME } from '../lib/site.ts'
import { Container } from './Container.tsx'
import { GitHubIcon } from './Header.tsx'

const YEAR = new Date().getFullYear()
const linkClass = 'text-white/50 transition-colors hover:text-white'

export function Footer() {
  const data = useData()
  const updated =
    data.status === 'ready' && data.updated ? new Date(data.updated).toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'long', year: 'numeric' }) : undefined

  return (
    <footer className="mt-24 border-t border-white/10 text-sm">
      <Container className="grid gap-10 py-12 sm:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          <p className="font-semibold tracking-tight text-white">{SITE_NAME}</p>
          <p className="max-w-xs text-white/50">Opening hours and menus for Cambridge college dining halls, cafés and bars.</p>
        </div>
        <Column title="Links">
          <Link to="/about" className={linkClass}>
            About
          </Link>
          <a href={REPO_URL} target="_blank" rel="noopener" className={`${linkClass} inline-flex items-center gap-2`}>
            <GitHubIcon className="size-4" />
            GitHub
          </a>
          <a href={ISSUES_URL} target="_blank" rel="noopener" className={linkClass}>
            Report an error
          </a>
        </Column>
      </Container>
      <div className="border-t border-white/10">
        <Container className="flex flex-col gap-2 py-6 text-xs text-white/40 sm:flex-row sm:justify-between">
          <p>
            © {YEAR} {SITE_NAME}. Not affiliated with the University of Cambridge or its colleges.
          </p>
          {updated && <p>Data updated {updated}</p>}
        </Container>
      </div>
    </footer>
  )
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-3 text-xs font-medium tracking-wider text-white/40 uppercase">{title}</p>
      <div className="flex flex-col items-start gap-2">{children}</div>
    </div>
  )
}
