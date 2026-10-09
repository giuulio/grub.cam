// Signing in with a Cambridge account (Microsoft, through Supabase Auth), for sending things in. The data client in
// data.tsx keeps no session; this one does, in localStorage, so a sender stays signed in across visits.
import { createClient, type Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

export const auth = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { flowType: 'pkce' } }).auth

/** Only University accounts get in: the database refuses any other address, this is the same rule up front. */
export const isCamEmail = (email: string | undefined) => !!email && /@cam\.ac\.uk$/i.test(email)

/** Microsoft sign-in, pinned to the University tenant by the dashboard's Azure settings; back to `returnTo` afterwards. */
export function signIn(returnTo: string) {
  return auth.signInWithOAuth({ provider: 'azure', options: { scopes: 'email openid profile', redirectTo: `${location.origin}${returnTo}` } })
}

export const signOut = () => auth.signOut()

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
