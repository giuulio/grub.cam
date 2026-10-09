import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Camera } from 'reicon-react'
import { BackButton } from '../components/BackButton.tsx'
import { Select } from '../components/Controls.tsx'
import { Icon } from '../components/Icon.tsx'
import { useReady } from '../lib/data.tsx'
import { DINING_MEALS } from '../lib/explore.ts'
import { MEAL_LABEL } from '../lib/filters.ts'
import { SITE_NAME, siteName, venuePath } from '../lib/site.ts'
import { isCamEmail, signIn, signOut, useSession } from '../lib/auth.ts'
import { confirm, send, shrink, type SubmitKind, type SubmitResult } from '../lib/submit.ts'
import type { Venue } from '../lib/types.ts'
import { useNow } from '../lib/useNow.ts'

const KINDS: [SubmitKind, string, string][] = [
  ['menu', 'Menu', 'the board for a meal'],
  ['prices', 'Prices', 'a price list'],
  ['hours', 'Hours', 'opening times'],
  ['photo', 'Photo of the venue', 'for its page'],
  ['other', 'Something else', 'a correction or a note'],
]

/**
 * /send?venue=<site>/<venue>&kind=menu|prices|hours|photo|other: what someone standing in a venue can tell us. A
 * photo of the board and/or the text, read by a model into the format we store, shown back to be checked, then
 * queued for a person to approve. Nothing appears on the site before that.
 */
export function Send() {
  const { venues } = useReady()
  const now = useNow()
  const session = useSession()
  const [params, setParams] = useSearchParams()
  const venue = venues.find((v) => v.id === params.get('venue'))
  const kind = (KINDS.find(([k]) => k === params.get('kind'))?.[0] ?? 'menu') as SubmitKind
  const set = (k: string, v?: string) => setParams((p) => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n }, { replace: true })

  const [date, setDate] = useState(params.get('date') ?? now.date)
  const [service, setService] = useState(params.get('meal') ?? 'lunch')
  const [photo, setPhoto] = useState<File>()
  const [preview, setPreview] = useState<string>()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'sending' | 'confirming'>()
  const [error, setError] = useState<string>()
  const [result, setResult] = useState<SubmitResult>()
  const [text, setText] = useState('')
  const [done, setDone] = useState<SubmitResult>()
  const fileInput = useRef<HTMLInputElement>(null)

  // The thumbnail's URL lives as long as its photo
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  const pick = async (f?: File) => {
    setError(undefined)
    const next = f ? await shrink(f) : undefined
    setPhoto(next)
    setPreview(next ? URL.createObjectURL(next) : undefined)
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!venue || !session) return
    if (!photo && !note.trim()) { setError('Add a photo or some text.'); return }
    setBusy('sending')
    setError(undefined)
    try {
      const r = await send(session.access_token, { venue: venue.id, kind, date: kind === 'menu' ? date : undefined, service: kind === 'menu' ? service : undefined, note: note.trim(), website: (document.getElementById('website') as HTMLInputElement | null)?.value }, photo)
      setResult(r)
      setText(r.transcription ?? '')
      if (!r.transcription) setDone(r)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(undefined)
    }
  }
  const approve = async () => {
    if (!result || !session) return
    setBusy('confirming')
    setError(undefined)
    try {
      setDone(await confirm(session.access_token, result.id, text))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(undefined)
    }
  }

  const back = venue ? venuePath(venue) : '/'
  const here = `/send?${params}`
  const email = session?.user.email
  return (
    <>
      <title>{`Send what you see · ${SITE_NAME}`}</title>
      <div className="max-w-2xl">
        <BackButton up={back} />
        <h1 className="title text-4xl">Send what you see</h1>
        <p className="mt-3 leading-relaxed text-muted">
          A photo of the menu board, the price list or the opening times, from where you are. We read it, you check what we read, and it goes up once someone has looked.
        </p>

        {session === undefined ? null : !session || !isCamEmail(email) ? (
          <section className="mt-8 space-y-4" aria-labelledby="sign-in">
            <h2 id="sign-in" className="title text-2xl">Sign in with your Cambridge account</h2>
            <p className="text-muted">Only University members can send things in, so we know what we're told comes from someone who was there. Microsoft sign-in with your @cam.ac.uk account; we keep your address with what you send and nothing else.</p>
            {session && !isCamEmail(email) && <p role="alert" className="text-sm text-[var(--type-hall)]">{email} isn't a University account.</p>}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => (session ? signOut().then(() => signIn(here)) : signIn(here))} className="btn btn-primary">Sign in</button>
              <Link to="/terms" className="link text-sm text-muted">Terms and privacy</Link>
            </div>
          </section>
        ) : done ? (
          <Thanks result={done} venue={venue ? { path: back, name: venue.name } : undefined} />
        ) : result ? (
          <section className="mt-8 space-y-4" aria-labelledby="check">
            <h2 id="check" className="title text-2xl">Here's what we read</h2>
            <p className="text-sm text-muted">Fix anything that's wrong (one line per item, as on the board), then send it.</p>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={Math.min(30, Math.max(8, text.split('\n').length + 1))} spellCheck={false} className="w-full rounded-lg border border-ink/15 bg-canvas p-3 font-mono text-sm leading-6 text-ink focus:border-ink/50 focus:outline-none" aria-label="Transcription" />
            {error && <p role="alert" className="text-sm text-[var(--type-hall)]">{error}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={approve} disabled={busy === 'confirming'} className="btn btn-primary">{busy === 'confirming' ? 'Sending…' : 'Send it'}</button>
              <button type="button" onClick={() => setDone(result)} className="btn btn-secondary">It's wrong, send the photo as it is</button>
            </div>
          </section>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-6" aria-busy={busy === 'sending'}>
            <Field label="Where">
              {venue ? (
                <p className="flex items-baseline gap-x-3 text-base">
                  <span className="font-medium">{venue.name}</span>
                  <span className="text-muted">{siteName(venue.site)}</span>
                  <button type="button" onClick={() => set('venue')} className="link cursor-pointer text-sm text-muted">Change</button>
                </p>
              ) : (
                <Select value="" onChange={(e) => set('venue', e.target.value)} aria-label="Venue" required>
                  <option value="" disabled>Choose a venue</option>
                  {bySite(venues).map(([site, mine]) => (
                    <optgroup key={site} label={site}>{mine.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</optgroup>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="What">
              <div role="radiogroup" aria-label="What it is" className="flex flex-wrap gap-2">
                {KINDS.map(([k, label, hint]) => (
                  <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => set('kind', k)} className="chip h-auto min-h-11 flex-col items-start gap-0 px-3.5 py-2 text-left sm:min-h-10" data-on={kind === k || undefined}>
                    <span>{label}</span>
                    <span className="text-xs font-normal opacity-70">{hint}</span>
                  </button>
                ))}
              </div>
            </Field>

            {kind === 'menu' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Day">
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="filter-select" />
                </Field>
                <Field label="Meal">
                  <Select value={service} onChange={(e) => setService(e.target.value)} aria-label="Meal">
                    {DINING_MEALS.map((m) => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}
                  </Select>
                </Field>
              </div>
            )}

            <Field label="Photo" hint={kind === 'photo' ? 'The room or the counter, without people. By sending it you let us show it on the site, credited to you if you leave a name.' : 'Straight on, the whole board in frame. It is shrunk before it leaves your phone.'}>
              <input ref={fileInput} id="photo" type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => fileInput.current?.click()} className="btn btn-secondary">
                  <Icon of={Camera} />
                  {photo ? 'Another photo' : 'Take or choose a photo'}
                </button>
                {photo && preview && (
                  <span className="flex items-center gap-3 text-sm text-muted">
                    <img src={preview} alt="" className="size-14 rounded-md object-cover" />
                    {Math.round(photo.size / 1024)} kB
                    <button type="button" onClick={() => pick()} className="link cursor-pointer">Remove</button>
                  </span>
                )}
              </div>
            </Field>

            <Field label={kind === 'photo' ? 'A note (optional)' : photo ? 'Or type it (optional)' : 'Or type it'} hint={kind === 'menu' || kind === 'prices' ? 'One item per line, with its price if shown.' : undefined}>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={5} className="w-full rounded-lg border border-ink/15 bg-canvas p-3 text-base leading-6 text-ink focus:border-ink/50 focus:outline-none sm:text-sm" aria-label="Text" />
            </Field>

            <p className="text-sm text-muted">
              Sending as {email}. <button type="button" onClick={() => signOut()} className="link cursor-pointer">Not you?</button> Your address stays with what you send and isn't shown.
            </p>
            {/* Bots fill every field; people never see this one */}
            <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

            {error && <p role="alert" className="text-sm text-[var(--type-hall)]">{error}</p>}
            <div className="flex flex-wrap items-center gap-4">
              <button type="submit" disabled={!venue || busy === 'sending'} className="btn btn-primary">{busy === 'sending' ? 'Reading…' : 'Send'}</button>
              <span className="text-sm text-muted">Someone checks everything before it appears. <Link to="/terms" className="link">Terms</Link></span>
            </div>
          </form>
        )}
      </div>
    </>
  )
}

/** Venues grouped under their site's name, sites A–Z, each site's venues in its own order. */
function bySite(venues: Venue[]): [string, Venue[]][] {
  const groups = new Map<string, Venue[]>()
  for (const v of venues) {
    const name = siteName(v.site)
    groups.set(name, [...(groups.get(name) ?? []), v])
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b))
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{label}</p>
      {children}
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </div>
  )
}

function Thanks({ result, venue }: { result: SubmitResult; venue?: { path: string; name: string } }) {
  return (
    <section className="mt-8 space-y-3" aria-live="polite">
      <h2 className="title text-2xl">Thank you</h2>
      <p className="text-muted">
        {result.status === 'needs_review' ? 'It is in the queue. It appears once someone has checked it, usually within a day.' : 'We have it. A person will read it and add it, usually within a day.'}
      </p>
      {venue && <Link to={venue.path} className="link text-ink">Back to {venue.name}</Link>}
    </section>
  )
}
