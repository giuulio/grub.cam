import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ISSUES_URL, SITE_NAME } from '../lib/site.ts'

/**
 * The terms a free site needs (as-is information, allergies, no affiliation), what members who sign in agree to when
 * they send things in or review, and what is kept: for readers nothing, for members what they send and their address.
 */
export function Terms() {
  return (
    <>
      <title>{`Terms and privacy · ${SITE_NAME}`}</title>
      <div className="max-w-2xl leading-relaxed">
        <h1 className="title text-4xl">Terms and privacy</h1>
        <p className="mt-3 text-muted">Last updated 13 October 2026.</p>

        <Part title="Using grub.cam">
          <p>
            {SITE_NAME} is a free, independent guide to where you can eat and drink across Cambridge colleges and the University. Reading it needs no account.
            Sending something in or reviewing a venue needs you to sign in with your University of Cambridge (@cam.ac.uk) Google account.
          </p>
          <p>
            Menus, hours and prices come from what each venue publishes, transcriptions of its notices, and people who send corrections. They can be
            wrong, incomplete or out of date, and venues change them at short notice. Check with the venue before relying on anything here; it's provided as is,
            without any promise that it's accurate or available.
          </p>
        </Part>

        <Part title="Sending things in and reviewing">
          <p>
            What you send (a photo of a board, a price list, opening times, a photo of a venue or a college, a correction) should be something you saw
            yourself, and a photo of a venue or a college should have no one's face in it. A menu, price list or opening times you've checked goes up within minutes, and anything else once a person
            has looked. Whatever goes up, goes up under your name, on the venue's page and on Contribute, so that what's here has someone behind it. By
            sending a photo of a venue or a college you license it under CC BY 4.0.
          </p>
          <p>
            A review should be your own experience of the venue: its food, drink, prices, service or space, as bluntly as you like, but naming or
            describing no one (staff included). It's shown without your name, and only once a venue has five. A review's words are checked before they
            show, and we may hold back or take down a review, or anything sent in, that breaks these terms. You can change or take back your review at any
            time.
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
          <p>We don't use cookies or analytics. If you only read the site, we collect nothing about you.</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              If you sign in, we keep your Cambridge email address and the name your Google account gives, with what you send and your reviews. Your
              address is never shown. Your name (your CRSid, if your account gives none) is shown with what you send once it goes up: on the venue's
              page, and on Contribute with how much you've sent in. Reviews stay anonymous. Your sign-in is remembered in your own browser.
            </li>
            <li>
              Photos and text you send, and the words of a review, are read by OpenAI's models to transcribe or check them. OpenAI doesn't keep them to train
              its models. Photos of boards are kept privately, as the source of what was transcribed.
            </li>
            <li>
              To have your account and everything you sent deleted, take back your reviews from their venues' pages and{' '}
              <a href={ISSUES_URL} target="_blank" rel="noopener" className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
                ask us
              </a>
              {' '}(without your address in the request: we'll reply to you there).
            </li>
            <li>Your light or dark theme is remembered in your own browser.</li>
            <li>“Near me” asks your browser for your location only when you press it, uses it to centre the map, and never sends it to us.</li>
            <li>
              Pages come from Cloudflare, venue data and sign-in from Supabase (our database) and Google, and maps from Apple (or, if Apple's can't load,
              OpenFreeMap). Like any web service, they receive your IP address when your browser asks them for something.
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
            <Link to="/contribute#coverage" className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
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
