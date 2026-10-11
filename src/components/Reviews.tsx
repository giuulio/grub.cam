import { useEffect, useState } from 'react'
import { Star } from 'reicon-react'
import { ownReview, signIn, useSession, useSignInEnabled } from '../lib/auth.ts'
import { useReviews } from '../lib/data.tsx'
import { saveReview, type ReviewStatus } from '../lib/submit.ts'
import type { Venue } from '../lib/types.ts'

// Members' reviews of a venue, as its page shows them: the average and how many, once there are 5 (the database shows
// nothing before then), each review anonymous ("Cambridge member", the month), and your own, to write or change.

const REVIEWS_SHOWN = 6
const RATING_WORDS = ['', 'Poor', 'Not great', 'Fine', 'Good', 'Excellent']

/** "★ 4.3 · 12 reviews", the venue's rating; nothing below 5 reviews. `compact`: "★ 4.3 (12)", for a list's row. */
export function RatingSummary({ venue, compact = false, className = '' }: { venue: Venue; compact?: boolean; className?: string }) {
  const r = venue.rating
  if (!r) return null
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${className}`} aria-label={`Rated ${r.average.toFixed(1)} out of 5 by ${r.reviews} members`}>
      <Star weight="Filled" aria-hidden="true" className="size-[1em] shrink-0" />
      <span className="font-semibold">{r.average.toFixed(1)}</span>
      <span className={compact ? 'text-muted' : ''}>{compact ? `(${r.reviews})` : ` · ${r.reviews} reviews`}</span>
    </span>
  )
}

/** Five stars, the first `value` filled. */
function Stars({ value, className = 'size-4' }: { value: number; className?: string }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} weight={n <= value ? 'Filled' : 'Outline'} aria-hidden="true" className={`${className} ${n <= value ? 'text-ink' : 'text-ink/25'}`} />
      ))}
    </span>
  )
}

/**
 * The venue's reviews: a venue with fewer than 5 published says how many it takes; with 5 or more, the newest, then
 * the rest on asking. Under them, your own: signed out, the way to sign in and rate it; signed in, the stars and words
 * to write or change it.
 */
export function Reviews({ venue }: { venue: Venue }) {
  const { reviews, failed } = useReviews(venue)
  const [all, setAll] = useState(false)
  const shown = all ? reviews : reviews?.slice(0, REVIEWS_SHOWN)
  return (
    <div className="space-y-8">
      {!venue.rating ? (
        <p className="text-muted">Reviews show here once 5 members have rated it.</p>
      ) : failed ? (
        <p className="text-muted">Couldn’t load the reviews.</p>
      ) : (
        <>
          <ul className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
            {shown?.map((r) => (
              <li key={r.id}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Stars value={r.rating} />
                  <span className="text-[0.9375rem] text-muted">
                    Cambridge member · {new Date(r.updated_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                  </span>
                </div>
                {r.body && <p className="mt-2 text-[1.0625rem] leading-relaxed whitespace-pre-line">{r.body}</p>}
              </li>
            ))}
          </ul>
          {reviews && reviews.length > REVIEWS_SHOWN && !all && (
            <button type="button" onClick={() => setAll(true)} className="btn btn-secondary">
              Show all {reviews.length} reviews
            </button>
          )}
        </>
      )}
      <YourReview venue={venue} />
    </div>
  )
}

/** Your review: the way in when signed out; else five stars to pick, words if you like, save, and take it back. */
function YourReview({ venue }: { venue: Venue }) {
  const session = useSession()
  const canSignIn = useSignInEnabled()
  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')
  const [saved, setSaved] = useState<{ rating: number; body: string } | null>(null)
  const [status, setStatus] = useState<ReviewStatus>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const user = session?.user.id
  // What you wrote before, when you come back
  useEffect(() => {
    if (!user) return
    let live = true
    ownReview(venue.id)
      .then((r) => {
        if (!live || !r) return
        setRating(r.rating)
        setBody(r.body ?? '')
        setSaved({ rating: r.rating, body: r.body ?? '' })
        setStatus(r.status)
      })
      .catch(() => {})
    return () => { live = false }
  }, [user, venue.id])

  if (session === undefined) return null
  // Microsoft sign-in not switched on yet: no way in to offer
  if (!session && !canSignIn) return null
  if (!session)
    return (
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl bg-cta-bg p-5">
        <p className="min-w-0 flex-1 text-[1.0625rem]">Been here? Rate it out of 5, with a few words if you like. Your name isn’t shown.</p>
        <button type="button" onClick={() => signIn(`${location.pathname}#reviews`)} className="btn btn-primary h-12 rounded-full px-6 text-base font-bold sm:h-12">
          Sign in to rate it
        </button>
      </div>
    )

  const changed = !saved || saved.rating !== rating || saved.body !== body.trim()
  const save = async (remove = false) => {
    setBusy(true)
    setError(undefined)
    try {
      const next = await saveReview(session.access_token, remove ? { venue: venue.id, remove: true } : { venue: venue.id, rating, body: body.trim() })
      setStatus(next)
      if (remove) {
        setSaved(null)
        setRating(0)
        setBody('')
      } else setSaved({ rating, body: body.trim() })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (rating) void save() }} className="rounded-xl border border-ink/12 p-5 sm:p-6">
      <h3 className="text-lg font-semibold">{saved ? 'Your review' : 'Rate it'}</h3>
      <div role="radiogroup" aria-label="Your rating" className="mt-3 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} out of 5: ${RATING_WORDS[n]}`} onClick={() => setRating(n)} className="cursor-pointer rounded-md p-1 transition-transform hover:scale-110">
            <Star weight={n <= rating ? 'Filled' : 'Outline'} aria-hidden="true" className={`size-8 ${n <= rating ? 'text-ink' : 'text-ink/30'}`} />
          </button>
        ))}
        {rating > 0 && <span className="ml-2 text-muted">{RATING_WORDS[rating]}</span>}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder="A few words, if you like: the food, the queue, the prices"
        aria-label="Your review"
        className="mt-4 w-full rounded-lg border border-ink/15 bg-canvas p-3 text-base leading-6 text-ink placeholder:text-muted focus:border-ink/50 focus:outline-none"
      />
      {error && <p role="alert" className="mt-2 text-sm text-error">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!rating || busy || !changed} className="btn btn-primary">
          {busy ? 'Saving…' : saved ? 'Save changes' : 'Post it'}
        </button>
        {saved && (
          <button type="button" disabled={busy} onClick={() => save(true)} className="btn btn-secondary">
            Take it back
          </button>
        )}
        <span className="text-sm text-muted" aria-live="polite">
          {status === 'published' && !changed && 'Posted, without your name.'}
          {status === 'needs_review' && !changed && 'Saved: it shows once someone has read it, usually within a day.'}
          {status === 'hidden' && 'This review was taken down.'}
          {status === 'removed' && 'Taken back.'}
        </span>
      </div>
    </form>
  )
}
