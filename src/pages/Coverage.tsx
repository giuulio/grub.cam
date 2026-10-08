import { ArrowRightUp } from 'reicon-react'
import { Link } from 'react-router'
import { Icon } from '../components/Icon.tsx'
import { coverage, menuWindow, type Category } from '../lib/coverage.ts'
import { useReady } from '../lib/data.tsx'
import { ISSUES_URL, SITE_NAME, sitePath, venuePath } from '../lib/site.ts'

// Until there's a way to send things in
const HELP_URL = ISSUES_URL

/** What grub.cam has for each college, and what's missing. */
export function CoveragePage() {
  const data = useReady()
  const dates = menuWindow(data)

  return (
    <>
      <title>{`Coverage · ${SITE_NAME}`}</title>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Coverage</h1>
        <a href={HELP_URL} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink">
          Know something missing?
          <Icon of={ArrowRightUp} className="size-3.5" />
        </a>
      </div>
      <p className="text-muted">Colleges only. Menus count what's published for {dates}; prices, a posted price list or priced dishes on those menus.</p>

      {coverage(data).map((c) => (
        <Section key={c.title} category={c} dates={dates} />
      ))}
    </>
  )
}

function Section({ category: c, dates }: { category: Category; dates: string }) {
  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 className="font-medium">
          {c.title}
          {c.dated && <span className="ml-2 text-sm font-normal text-muted">{dates}</span>}
        </h2>
        <p className="text-sm text-muted tabular-nums">
          {c.have} of {c.of} {c.unit}
        </p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/15" aria-hidden="true">
        <div className="h-full rounded-full bg-ink" style={{ width: `${(100 * c.have) / c.of}%` }} />
      </div>
      {c.missing.length > 0 && (
        <>
          <h3 className="mt-4 mb-2 text-sm text-muted">Missing</h3>
          {c.unit === 'colleges' ? (
            <p className="leading-7">
              {c.missing.map((m, i) => (
                <span key={m.site.slug}>
                  {i > 0 && <span className="text-muted">, </span>}
                  <Link to={m.venues.length === 1 ? venuePath(m.venues[0]) : sitePath(m.site)} className="whitespace-nowrap transition-colors hover:text-muted">
                    {m.site.short_name ?? m.site.name}
                  </Link>
                </span>
              ))}
            </p>
          ) : (
            <ul className="divide-y divide-ink/10 border-t border-ink/10 text-sm">
              {c.missing.map((m) => (
                <li key={m.site.slug} className="grid grid-cols-[8rem_1fr] gap-4 py-2 sm:grid-cols-[11rem_1fr]">
                  <Link to={sitePath(m.site)} className="truncate transition-colors hover:text-muted">
                    {m.site.short_name ?? m.site.name}
                  </Link>
                  <span className="text-muted">
                    {m.venues.map((v, i) => (
                      <span key={v.id}>
                        {i > 0 && ', '}
                        <Link to={venuePath(v)} className="transition-colors hover:text-ink">
                          {v.name}
                        </Link>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
