import { Link } from 'react-router'
import { ISSUES_URL, SITE_NAME } from '../lib/site.ts'

export function About() {
  return (
    <>
      <title>{`About · ${SITE_NAME}`}</title>
      <div className="max-w-2xl space-y-6 leading-relaxed">
        <h1 className="text-3xl font-semibold tracking-tight">About</h1>
        <p>Cambridge college and University halls, cafés and bars: when they're open and what's on.</p>
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
