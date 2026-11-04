// Private invitation management. Raw links are written outside the repo, never printed to CI logs.
import { createClient } from '@supabase/supabase-js'
import { randomBytes, createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

try { process.loadEnvFile() } catch { /* CI */ }
const { values, positionals } = parseArgs({ allowPositionals: true, options: { label: { type: 'string' }, out: { type: 'string' }, sites: { type: 'string' }, days: { type: 'string', default: '90' } } })
const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } })
if (positionals[0] === 'create') {
  if (!values.label || !values.out) throw new Error('create --label "Group name" --out /path/outside/repo.txt [--sites site,site] [--days 90]')
  const days = Number(values.days)
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error('days must be 1–365')
  const token = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + days * 86400000).toISOString()
  const { data, error } = await sb.from('upload_invites').insert({ label: values.label, token_hash: createHash('sha256').update(token).digest('hex'), sites: values.sites?.split(',') ?? null, expires_at: expires }).select('id').single()
  if (error) throw error
  writeFileSync(values.out, `Menu photo invitation for ${values.label}\n\nhttps://grub.cam/send#invite=${token}\n\nExpires ${expires}. Up to 50 submissions a day, with four files (10 MB total) per submission. A person reviews every submission.\n\nKeep the link within your group. No account is needed; no individual name is published.\n\nInvitation ID (for Giulio to revoke): ${data.id}\n`, { mode: 0o600, flag: 'wx' })
  console.log(`Invitation ${data.id} created; private link saved to ${values.out}`)
} else if (positionals[0] === 'revoke' && positionals[1]) {
  const { error } = await sb.from('upload_invites').update({ active: false }).eq('id', positionals[1])
  if (error) throw error
  console.log('Invitation revoked')
} else if (positionals[0] === 'list') {
  const { data, error } = await sb.from('upload_invites').select('id,label,active,sites,expires_at,daily_limit,used_today,used_on')
  if (error) throw error
  console.table(data)
} else throw new Error('Use create, list or revoke <id>')
