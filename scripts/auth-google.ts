// npm run auth:google [-- --check]
// Switches on Google sign-in (Supabase Auth's Google provider: the University's "Raven OAuth2", every member having a
// CRSid@cam.ac.uk Google account), and makes sure the site URL and redirect URLs are the ones sign-in returns through
// (grub.cam and localhost), through Supabase's Management API: what Authentication → Providers → Google and URL
// Configuration in the dashboard do, in one go. The app asks Google for the cam.ac.uk account (`hd`); the database
// refuses any other address (migration 0026).
// Reads from .env: SUPABASE_ACCESS_TOKEN (a personal access token, supabase.com/dashboard/account/tokens),
// GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (the OAuth client's; see README, Switching on sending in). --check prints
// what's set now and changes nothing.
import { parseArgs } from 'node:util'

const PROJECT = 'leghyhbkovkyipgoygko'
const SITE = 'https://grub.cam'
const REDIRECTS = ['https://grub.cam/**', 'http://localhost:5173/**']

process.loadEnvFile()
const { values } = parseArgs({ options: { check: { type: 'boolean' } } })
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN missing from .env (supabase.com/dashboard/account/tokens)')
const api = `https://api.supabase.com/v1/projects/${PROJECT}/config/auth`
const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }

type Auth = { site_url: string; uri_allow_list: string; external_google_enabled: boolean; external_google_client_id: string | null }
async function read(): Promise<Auth> {
  const res = await fetch(api, { headers })
  if (!res.ok) throw new Error(`read auth config: ${res.status} ${await res.text()}`)
  return (await res.json()) as Auth
}
const show = (a: Auth) =>
  console.log(
    [
      `site URL       ${a.site_url}`,
      `redirect URLs  ${a.uri_allow_list || '(none)'}`,
      `Google         ${a.external_google_enabled ? 'on' : 'off'}${a.external_google_client_id ? `, client ${a.external_google_client_id}` : ''}`,
    ].join('\n'),
  )

const now = await read()
if (values.check) {
  show(now)
} else {
  const id = process.env.GOOGLE_CLIENT_ID, secret = process.env.GOOGLE_CLIENT_SECRET
  if (!id || !secret) throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET missing from .env')
  // Keep whatever redirect URLs are there already, adding ours
  const allow = [...new Set([...now.uri_allow_list.split(',').map((u) => u.trim()).filter(Boolean), ...REDIRECTS])].join(',')
  const res = await fetch(api, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ site_url: SITE, uri_allow_list: allow, external_google_enabled: true, external_google_client_id: id, external_google_secret: secret }),
  })
  if (!res.ok) throw new Error(`update auth config: ${res.status} ${await res.text()}`)
  show(await read())
  console.log('\nSign in now shows on the site (it reads /auth/v1/settings); try it from a venue page.')
}
