import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { CloseCircle, Logout, NoteAdd, User } from 'reicon-react'
import { memberName, signIn, signOut, useSession } from '../lib/auth.ts'
import { Icon } from './Icon.tsx'

/**
 * The header's account button, at its end as Airbnb's: "Sign in" (Microsoft, a Cambridge account) back to the page
 * you're on, or, signed in, your initials, opening your name and address, sending something in, and signing out.
 * Nothing until the session is known, so a prerendered page and its first render agree.
 */
export function AccountButton() {
  const session = useSession()
  const { pathname, search } = useLocation()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  // Shut on a click elsewhere or Escape, and when the page changes
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  const [at, setAt] = useState(pathname)
  if (at !== pathname) {
    setAt(pathname)
    setOpen(false)
  }

  const round = 'flex h-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-ink/5 text-ink transition-colors hover:bg-ink/10 sm:h-12'
  if (session === undefined) return <span aria-hidden="true" className="size-11 sm:size-12" />
  if (!session)
    return (
      <button type="button" onClick={() => signIn(pathname + search)} aria-label="Sign in with your Cambridge account" title="Sign in with your Cambridge account" className={`${round} gap-2 px-3 text-base font-bold sm:px-5`}>
        <Icon of={User} className="size-5 sm:hidden" />
        <span className="max-sm:hidden">Sign in</span>
      </button>
    )
  const email = session.user.email ?? ''
  const name = memberName(session)
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" aria-label={`Your account: ${name ?? email}`} title={name ?? email} className={`${round} w-11 text-[0.9375rem] font-bold sm:w-12`}>
        {initials(name ?? email)}
      </button>
      {open && (
        <div role="menu" className="raised absolute top-[calc(100%+0.5rem)] right-0 z-50 w-72 rounded-xl p-2">
          <div className="px-3 pt-2 pb-3">
            {name && <p className="font-semibold">{name}</p>}
            <p className="truncate text-sm text-muted">{email}</p>
          </div>
          <Link role="menuitem" to="/send" className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-ink/5">
            <Icon of={NoteAdd} className="size-5 text-muted" />
            Send something in
          </Link>
          <button role="menuitem" type="button" onClick={() => signOut().then(() => setOpen(false))} className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-ink/5">
            <Icon of={Logout} className="size-5 text-muted" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

/** "Giulio Orlandi" → "GO"; an address → its first letter. */
function initials(who: string): string {
  const words = who.includes('@') ? [who] : who.split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words.at(-1)![0] : words[0]?.[0] ?? '?').toUpperCase()
}

/**
 * Why a sign-in came back without a session, said plainly under the header: Supabase returns to the page with
 * `error_description` when, say, the database refuses an address that isn't @cam.ac.uk ("Database error saving new
 * user"). Dismissing it clears the URL.
 */
export function SignInError() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const raw = params.get('error_description')
  if (!raw) return null
  const text = /database error/i.test(raw) ? 'Only University of Cambridge accounts (@cam.ac.uk) can sign in.' : `Couldn’t sign you in: ${raw}`
  const dismiss = () => {
    const next = new URLSearchParams(params)
    for (const k of ['error', 'error_code', 'error_description']) next.delete(k)
    navigate({ pathname, search: next.toString() }, { replace: true })
  }
  return (
    <div role="alert" className="flex items-center gap-3 rounded-xl bg-cta-bg px-4 py-3 text-ink">
      <p className="min-w-0 flex-1">{text}</p>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="icon-btn">
        <Icon of={CloseCircle} className="size-5" />
      </button>
    </div>
  )
}
