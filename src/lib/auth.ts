// Signing in with a Cambridge account (Google, the University's Raven OAuth2, through Supabase Auth), for sending things in. The data client in
// data.tsx keeps no session; this one does, in localStorage, so a sender stays signed in across visits.
import { createClient, type Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

const client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { flowType: 'pkce' } })
export const auth = client.auth

/** Your own review of a venue (RLS lets a member read theirs, whatever its status), or null. */
export async function ownReview(venueId: string): Promise<{ rating: number; body: string | null; status: 'published' | 'needs_review' | 'hidden' } | null> {
  const { data, error } = await client.from('reviews').select('rating, body, status').eq('venue_id', venueId).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

/** Only University accounts get in: the database refuses any other address, this is the same rule up front. */
export const isCamEmail = (email: string | undefined) => !!email && /@cam\.ac\.uk$/i.test(email)

/** Google sign-in, offering the @cam.ac.uk account (`hd`; the database enforces it); back to `returnTo` afterwards. */
export function signIn(returnTo: string) {
  return auth.signInWithOAuth({ provider: 'google', options: { queryParams: { hd: 'cam.ac.uk' }, redirectTo: `${location.origin}${returnTo}` } })
}

export const signOut = () => auth.signOut()

// Whether Google sign-in is switched on (Authentication → Providers → Google, `npm run auth:google`), read once from
// Supabase's public auth settings: until it is, the ways to sign in stay hidden rather than leading to an error, and
// they appear by themselves once it's on.
let enabled: Promise<boolean> | undefined
const signInEnabled = () =>
  (enabled ??= fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } })
    .then((r) => r.json())
    .then((s: { external?: Record<string, boolean> }) => !!s.external?.google)
    .catch(() => false))

/** Whether signing in works yet (see above); `undefined` until known. */
export function useSignInEnabled(): boolean | undefined {
  const [on, setOn] = useState<boolean>()
  useEffect(() => {
    let live = true
    void signInEnabled().then((v) => live && setOn(v))
    return () => { live = false }
  }, [])
  return on
}

/** The account's name as Google gives it: what a member's photo is credited to (the submit function reads the same). */
export const memberName = (session: Session | null | undefined): string | null => {
  const meta = session?.user.user_metadata ?? {}
  return String(meta.full_name ?? meta.name ?? '').trim() || null
}

/** The current session, kept up to date; `undefined` until known. */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>()
  useEffect(() => {
    auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])
  return session
}
