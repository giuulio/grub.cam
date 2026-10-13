import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AlertCircle, Buildings, Camera, Clock, DocumentText, Flag, Gallery, MenuBoard, Receipt, Search, Sparkles, TickCircle, X } from 'reicon-react'
import { Icon } from '../components/Icon.tsx'
import { useReady } from '../lib/data.tsx'
import { MEAL_LABEL } from '../lib/filters.ts'
import { mealNow, readableLines, type Readable } from '../lib/reading.ts'
import { SITE_NAME, siteName, venuePath } from '../lib/site.ts'
import { isCamEmail, memberName, signIn, signOut, useSession, useSignInEnabled } from '../lib/auth.ts'
import { MAX_PHOTOS, send, shrink, type SubmitKind, type SubmitResult, type Topic } from '../lib/submit.ts'
import { formatISODate } from '../lib/time/clock.ts'
import type { Meal, Venue } from '../lib/types.ts'
import { useNow } from '../lib/useNow.ts'

const KINDS: [SubmitKind, string, typeof MenuBoard][] = [
  ['menu', 'Menu', MenuBoard],
  ['prices', 'Prices', Receipt],
  ['hours', 'Hours', Clock],
  ['photo', 'Venue photo', Camera],
  ['other', 'Correction', Flag],
]

/** What a correction is about ("Report a change" leaves it to choose; a gap's link picks it). */
const TOPICS: [Topic, string][] = [
  ['hours', 'Hours'],
  ['prices', 'Prices'],
  ['menu', 'Menu'],
  ['formal', 'Formal hall'],
  ['diet', 'Diet options'],
  ['location', 'Where it is'],
  ['closed', 'Closed or moved'],
  ['other', 'Something else'],
]

type Shot = { file: File; url: string }
const reads = (k: SubmitKind): k is Readable => k === 'menu' || k === 'prices' || k === 'hours'
const isPdf = (f: File) => f.type === 'application/pdf'

/**
 * /send?venue=<site>/<venue>&kind=menu|prices|hours|photo|other[&date=&meal=]: what someone in a venue can tell us, in
 * one go. Photos of the board or PDFs (up to MAX_PHOTOS, from the camera or the library), with a note for context, or
 * the text typed. An AI model reads them as the sender watches, and its verdict decides: up within minutes, or back to
 * the sender with what to send instead. A photo of the venue is checked by a model; a correction goes to a person.
 */
export function Send() {
  const { venues } = useReady()
  const now = useNow()
  const session = useSession()
  const canSignIn = useSignInEnabled()
  const [params, setParams] = useSearchParams()
  const venue = venues.find((v) => v.id === params.get('venue'))
  const kind = (KINDS.find(([k]) => k === params.get('kind'))?.[0] ?? 'menu') as SubmitKind
  const topic = kind === 'other' ? TOPICS.find(([t]) => t === params.get('topic'))?.[0] : undefined
  const set = (k: string, v?: string) => setParams((p) => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n }, { replace: true })

  const [files, setFiles] = useState<Shot[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [live, setLive] = useState('')
  const [error, setError] = useState<string>()
  const [done, setDone] = useState<SubmitResult>()
  const camera = useRef<HTMLInputElement>(null)
  const library = useRef<HTMLInputElement>(null)

  // The thumbnails' URLs live as long as their files
  const kept = useRef(files)
  useEffect(() => {
    kept.current = files
  })
  useEffect(() => () => kept.current.forEach((s) => URL.revokeObjectURL(s.url)), [])

  // A photo of the venue is one photo; a board can take several, or PDFs
  const shown = kind === 'photo' ? files.filter((f) => !isPdf(f.file)).slice(0, 1) : files
  const add = async (picked: File[]) => {
    setError(undefined)
    const usable = picked.filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name) || (kind !== 'photo' && isPdf(f)))
    if (!usable.length) return setError(kind === 'photo' ? 'Choose a photo.' : 'Photos or PDFs only.')
    const room = kind === 'photo' ? 1 : MAX_PHOTOS - files.length
    if (room <= 0) return setError(`${MAX_PHOTOS} at most.`)
    if (usable.length > room && kind !== 'photo') setError(`${MAX_PHOTOS} at most: the first ${room} added.`)
    const next = await Promise.all(usable.slice(0, room).map(async (f) => {
      const file = await shrink(f, kind === 'photo' ? 2400 : undefined)
      return { file, url: URL.createObjectURL(file) }
    }))
    setFiles((p) => {
      if (kind === 'photo') p.forEach((s) => URL.revokeObjectURL(s.url))
      return kind === 'photo' ? next : [...p, ...next]
    })
  }
  const remove = (s: Shot) => setFiles((p) => {
    URL.revokeObjectURL(s.url)
    return p.filter((x) => x !== s)
  })
  // Pasted images join in while the form is showing
  const editing = !!session && !done && !busy
  useEffect(() => {
    if (!editing) return
    const paste = (e: ClipboardEvent) => {
      const pasted = [...(e.clipboardData?.files ?? [])]
      if (pasted.length) add(pasted)
    }
    window.addEventListener('paste', paste)
    return () => window.removeEventListener('paste', paste)
  })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!venue || !session) return
    if (kind === 'photo' && !shown.length) return setError('Add the photo.')
    if (kind === 'other' && !note.trim()) return setError('Say what’s changed.')
    if (!shown.length && !note.trim()) return setError('Add a photo, or type it out.')
    setBusy(true)
    setLive('')
    setError(undefined)
    try {
      // A menu's days and meals come from the board; where it says neither, it's for now's meal
      const fallback = { date: params.get('date') ?? now.date, service: (params.get('meal') as Meal | null) ?? mealNow(venue, now) }
      const r = await send(
        session.access_token,
        { venue: venue.id, kind, ...(kind === 'menu' ? { ...fallback, asBoard: true } : {}), topic, note: note.trim(), website: (document.getElementById('website') as HTMLInputElement | null)?.value },
        shown.map((s) => s.file),
        setLive,
      )
      if (r.status === 'rejected') setError(r.reason ?? 'That couldn’t be read: try a clearer photo.')
      else setDone(r)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  // Another for the same venue: the board next to the last one, usually
  const again = () => {
    files.forEach((s) => URL.revokeObjectURL(s.url))
    setFiles([])
    setNote('')
    setDone(undefined)
    setError(undefined)
  }

  const here = `/send?${params}`
  const email = session?.user.email
  const name = memberName(session)

  return (
    <>
      <title>{`Send what you see · ${SITE_NAME}`}</title>
      <div className="mx-auto max-w-xl">
        {session === undefined ? null : !session || !isCamEmail(email) ? (
          <section aria-labelledby="sign-in" className="space-y-4">
            <h1 id="sign-in" className="title text-4xl">Send what you see</h1>
            <p className="text-muted">Sign in with your Cambridge account (@cam.ac.uk) to send a menu, prices or hours. Your address stays with what you send.</p>
            {session && !isCamEmail(email) && <p role="alert" className="text-sm text-error">{email} isn't a University account.</p>}
            {canSignIn === false ? (
              // Google sign-in isn't switched on yet
              <p className="rounded-lg bg-cta-bg px-4 py-3 text-ink">Signing in opens in the next few days.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" disabled={!canSignIn} onClick={() => (session ? signOut().then(() => signIn(here)) : signIn(here))} className="btn btn-primary">Sign in</button>
                <Link to="/terms" className="link text-sm text-muted">Terms and privacy</Link>
              </div>
            )}
          </section>
        ) : done ? (
          <Thanks result={done} kind={kind} credit={name} venue={venue} again={again} />
        ) : busy && reads(kind) ? (
          <Reading kind={kind} files={shown} live={live} />
        ) : (
          <form onSubmit={submit} className="space-y-6">
            <div>
              <h1 className="title text-4xl">Send what you see</h1>
              <p className="mt-2 flex items-center gap-2 text-muted">
                <Icon of={Sparkles} className="size-4 shrink-0" />
                {kind === 'photo' ? 'A photo of the room for its page.' : kind === 'other' ? 'Tell us what’s changed.' : 'AI reads it and puts it up in minutes.'}
              </p>
            </div>

            {venue ? (
              <p className="flex items-center gap-3 rounded-xl border border-ink/10 px-4 py-3">
                <Icon of={Buildings} className="size-5 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-semibold">{venue.name}</span> <span className="text-muted">{siteName(venue.site)}</span>
                </span>
                <button type="button" onClick={() => set('venue')} className="link cursor-pointer text-sm text-muted">Change</button>
              </p>
            ) : (
              <VenuePicker venues={venues} onPick={(id) => set('venue', id)} />
            )}

            <div role="radiogroup" aria-label="What it is" className="flex flex-wrap gap-2">
              {KINDS.map(([k, label, icon]) => (
                <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => set('kind', k)} className="chip" data-on={kind === k || undefined}>
                  <Icon of={icon} className="size-4" />
                  {label}
                </button>
              ))}
            </div>

            {kind === 'other' && (
              <div role="radiogroup" aria-label="What it's about" className="flex flex-wrap gap-2">
                {TOPICS.map(([t, label]) => (
                  <button key={t} type="button" role="radio" aria-checked={topic === t} onClick={() => set('topic', t)} className="chip" data-on={topic === t || undefined}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {/* Hours, prices and a menu go up by themselves sent as what they are */}
            {(topic === 'hours' || topic === 'prices' || topic === 'menu') && (
              <p className="rounded-lg bg-cta-bg px-4 py-3 text-sm text-ink">
                Sent as {topic === 'menu' ? 'a menu' : topic}, it goes up by itself.{' '}
                <button type="button" onClick={() => setParams((p) => { const n = new URLSearchParams(p); n.set('kind', topic); n.delete('topic'); return n }, { replace: true })} className="link cursor-pointer font-semibold">
                  Send as {KINDS.find(([k]) => k === topic)![1].toLowerCase()}
                </button>
              </p>
            )}

            <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { add([...(e.target.files ?? [])]); e.target.value = '' }} />
            <input ref={library} type="file" accept={kind === 'photo' ? 'image/*' : 'image/*,application/pdf'} multiple={kind !== 'photo'} className="sr-only" onChange={(e) => { add([...(e.target.files ?? [])]); e.target.value = '' }} />
            <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); add([...e.dataTransfer.files]) }} className="rounded-xl border-2 border-dashed border-ink/15 p-4">
              {kind === 'photo' && shown[0] && (
                // How it will look at the top of the venue's page: cropped as the banner is, the name over its foot
                <div className="relative mb-3">
                  <img src={shown[0].url} alt="Your photo, cropped as the venue's banner" className="aspect-5/2 w-full rounded-lg object-cover" />
                  <span className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-md bg-black/55 px-2 py-0.5 text-xs text-white backdrop-blur">
                    <Icon of={Camera} className="size-3.5" />
                    {name ?? 'A member'}
                  </span>
                  <RemoveButton onClick={() => remove(shown[0])} label="Remove the photo" />
                </div>
              )}
              {kind !== 'photo' && shown.length > 0 && (
                <ul className="mb-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {shown.map((s, i) => (
                    <li key={s.url} className="relative">
                      {isPdf(s.file) ? (
                        <span className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg bg-ink/5 p-1 text-center text-xs text-muted">
                          <Icon of={DocumentText} className="size-6" />
                          <span className="line-clamp-2 break-all">{s.file.name}</span>
                        </span>
                      ) : (
                        <img src={s.url} alt={`Photo ${i + 1}`} className="aspect-square w-full rounded-lg object-cover" />
                      )}
                      <RemoveButton onClick={() => remove(s)} label={`Remove ${i + 1}`} />
                    </li>
                  ))}
                </ul>
              )}
              {(kind === 'photo' ? !shown.length : shown.length < MAX_PHOTOS) && (
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => camera.current?.click()} className="btn btn-primary hidden pointer-coarse:inline-flex">
                    <Icon of={Camera} />
                    Take a photo
                  </button>
                  <button type="button" onClick={() => library.current?.click()} className="btn btn-secondary">
                    <Icon of={Gallery} />
                    {kind === 'photo' ? 'Choose a photo' : shown.length ? 'Add more' : 'Upload'}
                  </button>
                  <span className="text-xs text-muted">{kind === 'photo' ? 'No faces · CC BY 4.0, credited to you' : `Photos or PDF · up to ${MAX_PHOTOS}`}</span>
                </div>
              )}
            </div>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={kind === 'other' || (reads(kind) && !shown.length) ? 5 : 2}
              placeholder={kind === 'other' ? 'What’s changed, and how you know' : kind === 'photo' ? 'A note (optional)' : shown.length ? 'Context for the reader (optional): “next week’s menu”, “student prices”' : 'Or type it out, one item a line'}
              aria-label={kind === 'other' ? 'What’s changed' : 'Note'}
              className="w-full rounded-lg border border-ink/15 bg-canvas p-3 text-base leading-6 text-ink placeholder:text-muted focus:border-ink/50 focus:outline-none sm:text-sm"
            />

            {/* Bots fill every field; people never see this one */}
            <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-lg bg-alert-bg px-3 py-2 text-[0.9375rem] text-alert">
                <Icon of={AlertCircle} className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </p>
            )}

            <div className="sticky bottom-0 z-10 -mx-4 space-y-2 border-t border-ink/10 bg-canvas/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
              <button type="submit" disabled={!venue || busy} className="btn btn-primary w-full justify-center sm:w-auto">
                <Icon of={reads(kind) ? Sparkles : Flag} />
                {busy ? 'Sending…' : 'Send'}
              </button>
              <p className="text-xs text-muted">
                As {email} · <button type="button" onClick={() => signOut()} className="link cursor-pointer">Not you?</button> · <Link to="/terms" className="link">Terms</Link>
              </p>
            </div>
          </form>
        )}
      </div>
    </>
  )
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="absolute top-1 right-1 grid size-7 cursor-pointer place-items-center rounded-full bg-black/60 text-white">
      <Icon of={X} className="size-4" />
    </button>
  )
}

/** A venue found by typing: its name, its site's, or what people call it. */
function VenuePicker({ venues, onPick }: { venues: Venue[]; onPick: (id: string) => void }) {
  const [q, setQ] = useState('')
  const [at, setAt] = useState(0)
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '').toLowerCase()
  const words = fold(q).split(/\s+/).filter(Boolean)
  const hits = words.length
    ? venues.filter((v) => {
        const hay = fold([v.name, siteName(v.site), v.site.name, ...(v.aliases ?? [])].join(' '))
        return words.every((w) => hay.includes(w))
      }).slice(0, 8)
    : []
  return (
    <div>
      <label className="relative block">
        <Icon of={Search} className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={q}
          autoFocus
          onChange={(e) => { setQ(e.target.value); setAt(0) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setAt((a) => Math.min(a + 1, hits.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setAt((a) => Math.max(a - 1, 0)) }
            else if (e.key === 'Enter' && hits[at]) { e.preventDefault(); onPick(hits[at].id) }
          }}
          placeholder="Which venue? “Jesus caff”, “West Hub”"
          aria-label="Venue"
          className="filter-select w-full pl-10"
        />
      </label>
      {hits.length > 0 && (
        <ul role="listbox" aria-label="Venues" className="mt-2 overflow-hidden rounded-xl border border-ink/10">
          {hits.map((v, i) => (
            <li key={v.id} role="option" aria-selected={i === at}>
              <button type="button" onClick={() => onPick(v.id)} onMouseEnter={() => setAt(i)} className={`flex w-full cursor-pointer items-baseline gap-3 px-4 py-2.5 text-left ${i === at ? 'bg-ink/5' : ''}`}>
                <span className="font-medium">{v.name}</span>
                <span className="text-sm text-muted">{siteName(v.site)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {words.length > 0 && !hits.length && <p className="mt-2 text-sm text-muted">No venue by that name.</p>}
    </div>
  )
}

/** While the model reads: the files being scanned, and its reading as it arrives, a line at a time. */
function Reading({ kind, files, live }: { kind: Readable; files: Shot[]; live: string }) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const t = setInterval(() => setSeconds(Math.round((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(t)
  }, [])
  const lines = readableLines(live, kind)
  return (
    <section aria-live="polite" aria-busy="true" className="space-y-6">
      <div>
        <h1 className="title text-4xl">Reading it</h1>
        <p className="mt-2 flex items-center gap-2 text-muted">
          <Icon of={Sparkles} className="size-4 shrink-0" />
          AI is reading it, usually 10 to 30 seconds <span className="tabular-nums">· {seconds} s</span>
        </p>
      </div>
      {files.length > 0 && (
        <div className="flex snap-x gap-2 overflow-x-auto">
          {files.map((s, i) => (
            <span key={s.url} className={`relative block shrink-0 snap-start overflow-hidden rounded-xl ${files.length > 1 ? 'w-2/3' : 'w-full'}`}>
              {isPdf(s.file) ? (
                <span className="flex h-40 items-center justify-center gap-2 bg-ink/5 text-sm text-muted">
                  <Icon of={DocumentText} className="size-6" />
                  {s.file.name}
                </span>
              ) : (
                <img src={s.url} alt={`Your photo${files.length > 1 ? ` ${i + 1}` : ''}`} className="max-h-72 w-full bg-ink/5 object-contain" />
              )}
              <span aria-hidden="true" className="scanning absolute inset-0" />
            </span>
          ))}
        </div>
      )}
      {lines.length ? (
        <ul className="space-y-1.5">
          {lines.map((l, i) => (
            <li key={i} className={`reading-line ${l.kind === 'day' ? 'title pt-3 text-xl' : l.kind === 'section' ? 'pt-2 font-semibold text-muted' : l.kind === 'meta' ? 'text-sm text-muted' : 'flex items-baseline gap-4'}`}>
              {l.kind === 'day' ? (
                <>
                  {dayLabel(l.text)}
                  {l.detail && <span className="ml-2 font-sans text-sm font-normal text-muted">{l.detail}</span>}
                </>
              ) : l.kind === 'item' ? (
                <>
                  <span className="min-w-0 flex-1">
                    {l.text}
                    {l.detail && <span className="block text-sm text-muted">{l.detail}</span>}
                  </span>
                  {l.price && <span className="shrink-0 tabular-nums">{l.price}</span>}
                </>
              ) : (
                l.text
              )}
            </li>
          ))}
          <li aria-hidden="true" className="reading-caret h-5 w-2 rounded-sm bg-ink/40" />
        </ul>
      ) : (
        <div aria-hidden="true" className="space-y-3">
          {[70, 55, 80, 45].map((w) => (
            <div key={w} className="reading-skeleton h-4 rounded bg-ink/10" style={{ width: `${w}%` }} />
          ))}
        </div>
      )}
    </section>
  )
}

/** "2026-10-13 lunch" as "Tuesday 13 October · Lunch". */
function dayLabel(text: string): string {
  const [date, meal] = text.split(' ')
  return `${/^\d{4}-\d{2}-\d{2}$/.test(date) ? formatISODate(date, { weekday: 'long', day: 'numeric', month: 'long' }) : date}${meal ? ` · ${MEAL_LABEL[meal as Meal] ?? meal}` : ''}`
}

function Thanks({ result, kind, credit, venue, again }: { result: SubmitResult; kind: SubmitKind; credit: string | null; venue?: Venue; again: () => void }) {
  const up = result.status === 'queued'
  const what = kind === 'menu' ? 'The menu' : kind === 'prices' ? 'The prices' : kind === 'hours' ? 'The hours' : kind === 'photo' ? 'Your photo' : 'It'
  const message: ReactNode = up
    ? `${what} ${kind === 'prices' || kind === 'hours' ? 'are' : 'is'} on ${venue?.name ?? 'the venue'}’s page within minutes${kind === 'photo' ? `, credited to ${credit ?? 'you'}` : ''}.`
    : result.reason
      ? `A person checks it first: ${result.reason.replace(/\.?$/, '.')}`
      : result.status === 'received'
        ? 'We couldn’t read it automatically, so a person will add it.'
        : 'A person will read it, usually within a day.'
  return (
    <section aria-live="polite" className="space-y-4">
      <Icon of={up ? TickCircle : Clock} className={`size-10 ${up ? 'text-open-ink' : 'text-muted'}`} />
      <h1 className="title text-4xl">{up ? 'It’s going up' : 'Thanks'}</h1>
      <p className="text-muted">{message}</p>
      {venue && (
        <div className="flex flex-wrap gap-3 pt-2">
          <Link to={venuePath(venue)} className="btn btn-primary">See {venue.name}</Link>
          <button type="button" onClick={again} className="btn btn-secondary">Send another</button>
        </div>
      )}
    </section>
  )
}
