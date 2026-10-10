import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { coverage, menuWindow } from '../lib/coverage.ts'
import { useData } from '../lib/data.tsx'
import { ISSUES_URL, SITE_NAME } from '../lib/site.ts'
import { Container } from './Container.tsx'

/**
 * Laid out as Tripadvisor's: columns of links (the site, where to browse, how to help) and how fresh the menus are;
 * then the mark, ©, the terms, and that grub.cam isn't the University's. No GitHub link: the header has it.
 */
export function Footer() {
  const data = useData()
  const menus = data.status === 'ready' ? coverage(data)[0] : undefined
  const updated = data.status === 'ready' && data.updated ? new Date(data.updated).toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short' }) : undefined

  return (
    <footer className="mt-20 bg-ink/[0.035] text-[15px]">
      <Container className="grid gap-x-8 gap-y-10 pt-12 pb-10 sm:grid-cols-2 lg:grid-cols-4">
        <FooterLinks title={`About ${SITE_NAME}`}>
          <Link to="/about">About</Link>
          <Link to="/coverage">Coverage</Link>
          <Link to="/credits">Photo credits</Link>
          <Link to="/terms">Terms and privacy</Link>
        </FooterLinks>
        <FooterLinks title="Explore">
          <Link to="/explore">Map</Link>
          <Link to="/directory">Directory</Link>
          <Link to="/directory?kind=college">Colleges</Link>
          <Link to="/directory?kind=university">University sites</Link>
        </FooterLinks>
        <FooterLinks title="Help build it">
          <Link to="/send">Send a photo or a correction</Link>
          <a href={ISSUES_URL} target="_blank" rel="noopener">Report an issue</a>
        </FooterLinks>
        <div>
          <h2 className="text-muted">The menus</h2>
          <p className="mt-4 max-w-xs">Menus and opening hours for Cambridge college and University dining halls, cafés and bars.</p>
          {data.status === 'ready' && menus && (
            <p className="mt-3 max-w-xs">
              <Link to="/coverage" className="link">
                {menuWindow(data, true)}: {menus.have} of {menus.of} colleges
              </Link>
              {updated && <span className="text-muted">, updated {updated}</span>}
            </p>
          )}
        </div>
      </Container>
      {/* GitHub is linked once, in the header */}
      <Container className="pb-10">
        <div className="flex gap-4">
          <img src="/favicon.svg" alt="" width={36} height={36} className="size-9 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm text-muted">© {new Date().getFullYear()} {SITE_NAME}</p>
            <p className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 font-medium">
              <Link to="/terms" className="underline underline-offset-4 hover:no-underline">Terms and privacy</Link>
              <Link to="/credits" className="underline underline-offset-4 hover:no-underline">Photo credits</Link>
              <Link to="/about" className="underline underline-offset-4 hover:no-underline">Contact</Link>
            </p>
            <p className="mt-3 max-w-2xl text-sm text-muted">Independent, and not affiliated with the University of Cambridge or its colleges. Menus, hours and prices are as each venue publishes them: check allergens with the venue.</p>
          </div>
        </div>
      </Container>
    </footer>
  )
}

function FooterLinks({ title, children }: { title: string; children: ReactNode[] }) {
  return (
    <nav aria-label={title}>
      <h2 className="text-muted">{title}</h2>
      <ul className="mt-4 space-y-2.5">
        {children.map((link, i) => (
          <li key={i} className="underline-offset-4 hover:underline">
            {link}
          </li>
        ))}
      </ul>
    </nav>
  )
}
