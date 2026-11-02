// npm run mapkit:token -- --key ~/path/AuthKey_<KEY ID>.p8 [--team ZPJ32V3XQY] [--origin http://localhost:5173] [--days 365]
// A MapKit JS token for `npm run dev`, signed here with the Apple Developer account's Maps key (Certificates, IDs &
// Profiles → Keys, with MapKit JS enabled), so localhost shows Apple's map as grub.cam does. The tokens Apple's site makes
// last about a week (the last one ran out on 19 Oct 2026); this one lasts `days`, and works only at `origin`. Written
// to .env.development.local as VITE_MAPKIT_TOKEN (git ignores it), replacing the one there; the key itself is only read.
// The key ID is the file name's (AuthKey_42QS829CH4.p8), the team the current tokens' issuer.
import { createPrivateKey, sign } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import { parseArgs } from 'node:util'

const FILE = '.env.development.local'
const { values } = parseArgs({ options: { key: { type: 'string' }, team: { type: 'string', default: 'ZPJ32V3XQY' }, origin: { type: 'string', default: 'http://localhost:5173' }, days: { type: 'string', default: '365' } } })
if (!values.key) throw new Error('--key: the .p8 file of a Maps key (AuthKey_<KEY ID>.p8)')
const kid = basename(values.key).match(/^AuthKey_([A-Z0-9]{10})\.p8$/)?.[1]
if (!kid) throw new Error(`can't read a key ID from ${basename(values.key)}: expected AuthKey_<KEY ID>.p8`)

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const exp = now + Number(values.days) * 86400
const head = b64url(JSON.stringify({ alg: 'ES256', kid, typ: 'JWT' }))
const body = b64url(JSON.stringify({ iss: values.team, iat: now, exp, origin: values.origin }))
// ES256: the raw r‖s signature JWTs use, not DER
const signature = sign('sha256', Buffer.from(`${head}.${body}`), { key: createPrivateKey(readFileSync(values.key)), dsaEncoding: 'ieee-p1363' })
const token = `${head}.${body}.${b64url(signature)}`

// Asked of Apple as the page would, from `origin`: a refusal means the key isn't a Maps key, or the team is wrong
const res = await fetch('https://cdn.apple-mapkit.com/ma/bootstrap?apiVersion=2&mkjsVersion=5.0.0&poi=1', { headers: { authorization: `Bearer ${token}`, origin: values.origin } })
if (!res.ok) throw new Error(`Apple refused the token (${res.status}): is ${basename(values.key)} a key with MapKit JS, and ${values.team} its team?`)

const lines = existsSync(FILE) ? readFileSync(FILE, 'utf8').split('\n').filter((l) => !l.startsWith('VITE_MAPKIT_TOKEN=')) : []
while (lines.length && !lines.at(-1)) lines.pop()
writeFileSync(FILE, [...lines, `VITE_MAPKIT_TOKEN=${token}`, ''].join('\n'))
console.log(`✓ ${FILE}: a MapKit JS token for ${values.origin}, until ${new Date(exp * 1000).toISOString().slice(0, 10)}. Restart npm run dev.`)
