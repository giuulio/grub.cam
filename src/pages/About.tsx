import { ISSUES_URL, SITE_NAME } from '../lib/site.ts'

export function About() {
  return (
    <>
      <title>{`About · ${SITE_NAME}`}</title>
      <div className="max-w-2xl space-y-6 leading-relaxed">
        <h1 className="text-3xl font-semibold tracking-tight">About</h1>
        <p>Cambridge college halls, cafés and bars: when they're open and what's on.</p>
        <p className="text-white/60">Hours and menus come from each college's own pages. Colleges change times at short notice.</p>
        <p className="text-white/60">
          Something wrong?{' '}
          <a href={ISSUES_URL} target="_blank" rel="noopener" className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">
            Report it on GitHub
          </a>
          .
        </p>
      </div>
    </>
  )
}
