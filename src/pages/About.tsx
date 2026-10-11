import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Code, Flag, Instagram, NoteAdd, type IconComponent } from 'reicon-react'
import { GitHubIcon } from '../components/Header.tsx'
import { Icon } from '../components/Icon.tsx'
import { menuGap, menuWindow, overallCoverage } from '../lib/coverage.ts'
import { useReady } from '../lib/data.tsx'
import { ISSUES_URL, REPO_URL, SITE_NAME } from '../lib/site.ts'

/**
 * What grub.cam is, where what it shows comes from (with the live numbers), the three ways to help build it, and who
 * makes it. Set as the front page's rows are: Figtree titles, 17px text, what's missing in Light Blue with the way
 * to send it in the action colour.
 */
export function About() {
  const data = useReady()
  const { venues, sites } = data
  const colleges = sites.filter((s) => s.kind === 'college').length
  const [menus] = overallCoverage(venues)
  const dishes = venues.reduce((n, v) => n + v.menu.reduce((m, d) => m + d.items.length, 0), 0)
  // Dining venues whose menu is online but not yet fetched by a script: each is a scraper someone could write
  const byHand = venues.filter((v) => v.type === 'hall' && menuGap(v) === 'online' && !v.menu_scripted).length

  return (
    <>
      <title>{`About · ${SITE_NAME}`}</title>
      <article className="max-w-3xl text-base leading-relaxed sm:text-[1.0625rem]">
        <h1 className="title text-4xl leading-[1.1] sm:text-5xl">About {SITE_NAME}</h1>
        <p className="mt-5 text-xl leading-snug text-muted sm:text-2xl">
          Every Cambridge college and University dining hall, café and bar: when it’s open, what’s on and what it costs, as each one publishes it.
        </p>

        <h2 className="title mt-12 text-2xl leading-tight sm:text-3xl">Where it comes from</h2>
        <p className="mt-4">
          The venues’ own pages. Where a college publishes its menu in a form a script can read, grub.cam fetches it every two hours; where it’s a PDF or a design, someone copies it in each week; where it’s only on a noticeboard, someone standing there sends it in. Nothing is predicted or filled in: a day with no menu here is a day the venue hasn’t published one.
        </p>
        <p className="mt-4">
          Right now: {venues.length} venues at {colleges} colleges and {sites.length - colleges} University sites, and {menus.have} of {menus.of} dining halls have their menu for {menuWindow(data, true)}, {dishes.toLocaleString('en-GB')} dishes.{' '}
          <Link to="/coverage" className="link">
            See what’s missing
          </Link>
          .
        </p>
        <p className="mt-4 text-muted">Hours and prices change at short notice, and allergens are the venue’s to confirm. grub.cam is independent, and not affiliated with the University of Cambridge or its colleges.</p>

        <h2 className="title mt-12 text-2xl leading-tight sm:text-3xl">Help build it</h2>
        <ul className="mt-6 space-y-6">
          <Way icon={NoteAdd} action="Send something in" to="/send">
            In a hall, café or bar? Its board, price list or opening times, as a photo or typed out, with your Cambridge account. A model reads it, you check what it read, and it goes up once a person has looked.
          </Way>
          <Way icon={Code} action="Write a scraper" href={`${REPO_URL}/tree/main/scripts/ingest/sources`}>
            {byHand} dining {byHand === 1 ? 'venue publishes' : 'venues publish'} a menu online that’s copied in by hand each week. An adapter in <code className="rounded bg-ink/6 px-1.5 py-0.5 text-[0.9em]">scripts/ingest/sources</code> would keep it current; the code, and how each venue publishes, is on GitHub.
          </Way>
          <Way icon={Flag} action="Report what’s wrong" href={ISSUES_URL}>
            A wrong time, a venue that isn’t here, something the page gets wrong: open an issue, or use “Report a change” on the venue’s page.
          </Way>
        </ul>

        <h2 className="title mt-12 text-2xl leading-tight sm:text-3xl">Who makes it</h2>
        <p className="mt-4">Giulio Orlandi, in Cambridge. To help with menus, hours, prices or code, get in touch through any of these:</p>
        <ul className="mt-4 flex flex-wrap gap-x-7 gap-y-2 font-medium" aria-label="Giulio’s profiles">
          <li>
            <a href="https://github.com/giuulio" target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-2 hover:underline">
              <GitHubIcon className="size-5" />
              GitHub
            </a>
          </li>
          <li>
            <a href="https://www.linkedin.com/in/giulioorlandi/" target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-2 hover:underline">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" className="size-5 shrink-0">
                <path d="M20.45 2H3.55C2.69 2 2 2.68 2 3.52v16.96c0 .84.69 1.52 1.55 1.52h16.9c.86 0 1.55-.68 1.55-1.52V3.52c0-.84-.69-1.52-1.55-1.52ZM7.93 18.75H4.98V9.2h2.95v9.55ZM6.46 7.89a1.71 1.71 0 1 1 0-3.42 1.71 1.71 0 0 1 0 3.42Zm12.29 10.86H15.8v-4.64c0-1.1-.02-2.53-1.54-2.53-1.54 0-1.78 1.21-1.78 2.45v4.72H9.53V9.2h2.83v1.3h.04c.39-.74 1.36-1.52 2.79-1.52 2.98 0 3.56 1.96 3.56 4.51v5.26Z" />
              </svg>
              LinkedIn
            </a>
          </li>
          <li>
            <a href="https://www.instagram.com/giulio.o/" target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-2 hover:underline">
              <Icon of={Instagram} className="size-5" />
              Instagram
            </a>
          </li>
        </ul>
      </article>
    </>
  )
}

/** One way to help, as the front page says what a venue is missing: the thing it takes in a Light Blue disc, what and why, and the way to do it. */
function Way({ icon, action, to, href, children }: { icon: IconComponent; action: string; to?: string; href?: string; children: ReactNode }) {
  const className = 'font-semibold text-cta hover:underline'
  return (
    <li className="flex items-start gap-4 sm:gap-5">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-cta-bg text-cta">
        <Icon of={icon} className="size-6" />
      </span>
      <div className="min-w-0 pt-0.5">
        <p>{children}</p>
        <p className="mt-1.5">
          {to ? (
            <Link to={to} className={className}>
              {action}
            </Link>
          ) : (
            <a href={href} target="_blank" rel="noopener" className={className}>
              {action}
            </a>
          )}
        </p>
      </div>
    </li>
  )
}
