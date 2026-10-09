import { Link } from 'react-router'
import { Instagram } from 'reicon-react'
import { GitHubIcon } from '../components/Header.tsx'
import { Icon } from '../components/Icon.tsx'
import { ISSUES_URL, SITE_NAME } from '../lib/site.ts'

export function About() {
  return (
    <>
      <title>{`About · ${SITE_NAME}`}</title>
      <div className="max-w-2xl space-y-6 leading-relaxed">
        <h1 className="text-3xl font-semibold tracking-tight">About</h1>
        <p>Cambridge college and University halls, cafés and bars: when they're open and what's on.</p>
        <p className="text-muted">grub.cam is built by Giulio Orlandi. I'm looking for contributors to help with menus, opening hours, prices and code. If you'd like to help, get in touch through any of the links below.</p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Giulio's social profiles">
          <li>
            <a href="https://github.com/giuulio" target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-2 text-muted transition-colors hover:text-ink">
              <GitHubIcon className="size-5" />
              GitHub
            </a>
          </li>
          <li>
            <a href="https://www.linkedin.com/in/giulioorlandi/" target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-2 text-muted transition-colors hover:text-ink">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" className="size-5 shrink-0">
                <path d="M20.45 2H3.55C2.69 2 2 2.68 2 3.52v16.96c0 .84.69 1.52 1.55 1.52h16.9c.86 0 1.55-.68 1.55-1.52V3.52c0-.84-.69-1.52-1.55-1.52ZM7.93 18.75H4.98V9.2h2.95v9.55ZM6.46 7.89a1.71 1.71 0 1 1 0-3.42 1.71 1.71 0 0 1 0 3.42Zm12.29 10.86H15.8v-4.64c0-1.1-.02-2.53-1.54-2.53-1.54 0-1.78 1.21-1.78 2.45v4.72H9.53V9.2h2.83v1.3h.04c.39-.74 1.36-1.52 2.79-1.52 2.98 0 3.56 1.96 3.56 4.51v5.26Z" />
              </svg>
              LinkedIn
            </a>
          </li>
          <li>
            <a href="https://www.instagram.com/giulio.o/" target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-2 text-muted transition-colors hover:text-ink">
              <Icon of={Instagram} className="size-5" />
              Instagram
            </a>
          </li>
        </ul>
        <p className="text-muted">Hours and menus come from each college's and the University's own pages. They change times at short notice.</p>
        <p className="text-muted">
          Not every college publishes everything.{' '}
          <Link to="/coverage" className="text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
            See what's missing
          </Link>
          .
        </p>
        <p className="text-muted">
          Something wrong?{' '}
          <a href={ISSUES_URL} target="_blank" rel="noopener" className="text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
            Report it on GitHub
          </a>
          .
        </p>
      </div>
    </>
  )
}
