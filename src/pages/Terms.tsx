import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ISSUES_URL, SITE_NAME } from '../lib/site.ts'

/** The terms a free, read-only site needs (as-is information, allergies, no affiliation) and what it does with data: nothing. */
export function Terms() {
  return (
    <>
      <title>{`Terms and privacy · ${SITE_NAME}`}</title>
      <div className="max-w-2xl leading-relaxed">
        <h1 className="title text-4xl">Terms and privacy</h1>
        <p className="mt-3 text-muted">Last updated 9 October 2026.</p>

        <Part title="Using grub.cam">
          <p>
            {SITE_NAME} is a free, independent guide to where you can eat and drink across Cambridge colleges and the University. There's no account and nothing to
            sign up to.
          </p>
          <p>
            Menus, hours, prices and access come from what each venue publishes, transcriptions of its notices, and people who send corrections. They can be
            wrong, incomplete or out of date, and venues change them at short notice. Check with the venue before relying on anything here; it's provided as is,
            without any promise that it's accurate or available.
          </p>
        </Part>

        <Part title="Allergies and diets">
          <p>
            Diet labels (vegan, halal, gluten-free, …) are copied from what venues publish; we don't check recipes or kitchens. If you have an allergy or
            intolerance, ask the staff serving you, every time.
          </p>
        </Part>

        <Part title="Not affiliated">
          <p>
            {SITE_NAME} isn't run or endorsed by the University of Cambridge or any college. Their names are used only to say which venues are described, and
            belong to them.
          </p>
        </Part>

        <Part title="Privacy">
          <p>We don't use cookies, analytics or accounts, and we don't collect personal information.</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Your light or dark theme is remembered in your own browser.</li>
            <li>“Near me” asks your browser for your location only when you press it, uses it to centre the map, and never sends it to us.</li>
            <li>
              Pages come from Cloudflare, venue data from Supabase (our database) and map tiles from OpenFreeMap. Like any web service, they receive your IP address
              when your browser asks them for something.
            </li>
            <li>Reports go to GitHub, under GitHub's own terms and privacy statement.</li>
          </ul>
        </Part>

        <Part title="Corrections">
          <p>
            Something wrong or missing?{' '}
            <a href={ISSUES_URL} target="_blank" rel="noopener" className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
              Report it
            </a>{' '}
            or see{' '}
            <Link to="/coverage" className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
              what's missing
            </Link>
            .
          </p>
        </Part>
      </div>
    </>
  )
}

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10 space-y-3">
      <h2 className="title text-2xl">{title}</h2>
      <div className="space-y-3 text-muted">{children}</div>
    </section>
  )
}
