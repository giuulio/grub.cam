// npm run auth:azure [-- --check]
// Switches on Microsoft sign-in (Supabase Auth's Azure provider) pinned to the University's tenant, and makes sure the
// site URL and redirect URLs are the ones sign-in returns through (grub.cam and localhost), through Supabase's
// Management API: what Authentication → Providers → Azure and URL Configuration in the dashboard do, in one go.
// Reads from .env: SUPABASE_ACCESS_TOKEN (a personal access token, supabase.com/dashboard/account/tokens),
// AZURE_CLIENT_ID and AZURE_CLIENT_SECRET (the app registration's Application (client) ID and a client secret's Value;
// see README, Accounts). --check prints what's set now and changes nothing.
import { parseArgs } from 'node:util'

const PROJECT = 'leghyhbkovkyipgoygko'
const TENANT_URL = 'https://login.microsoftonline.com/49a50445-bdfa-4b79-ade3-547b4f3986e9'
const SITE = 'https://grub.cam'
const REDIRECTS = ['https://grub.cam/**', 'http://localhost:5173/**']

process.loadEnvFile()
const { values } = parseArgs({ options: { check: { type: 'boolean' } } })
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN missing from .env (supabase.com/dashboard/account/tokens)')
const api = `https://api.supabase.com/v1/projects/${PROJECT}/config/auth`
const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }

type Auth = { site_url: string; uri_allow_list: string; external_azure_enabled: boolean; external_azure_client_id: string | null; external_azure_url: string | null }
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
      `Azure          ${a.external_azure_enabled ? 'on' : 'off'}${a.external_azure_client_id ? `, client ${a.external_azure_client_id}` : ''}`,
      `tenant URL     ${a.external_azure_url ?? '(common: any Microsoft account)'}`,
    ].join('\n'),
  )

const now = await read()
if (values.check) {
  show(now)
} else {
  const id = process.env.AZURE_CLIENT_ID, secret = process.env.AZURE_CLIENT_SECRET
  if (!id || !secret) throw new Error('AZURE_CLIENT_ID and AZURE_CLIENT_SECRET missing from .env')
  // Keep whatever redirect URLs are there already, adding ours
  const allow = [...new Set([...now.uri_allow_list.split(',').map((u) => u.trim()).filter(Boolean), ...REDIRECTS])].join(',')
  const res = await fetch(api, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ site_url: SITE, uri_allow_list: allow, external_azure_enabled: true, external_azure_client_id: id, external_azure_secret: secret, external_azure_url: TENANT_URL }),
  })
  if (!res.ok) throw new Error(`update auth config: ${res.status} ${await res.text()}`)
  show(await read())
  console.log('\nSign in now shows on the site (it reads /auth/v1/settings); try it from a venue page.')
}
