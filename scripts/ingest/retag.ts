// Correct explicit whole-dish labels in existing menus without rewriting their names, sources or saved timestamps.
// npm run ingest:tags -- --dry (review), then npm run ingest:tags. Ambiguous names remain for source research.
import { createClient } from '@supabase/supabase-js'
import { parseArgs } from 'node:util'
import { explicitDietTags } from './lib/tags.ts'
import type { DietTag } from '../schema.ts'

try { process.loadEnvFile() } catch { /* CI environment */ }
const { values } = parseArgs({ options: { dry: { type: 'boolean' } } })
const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } })
type Row = { menu_day_id: string; position: number; name: string; tags: DietTag[]; allergens: string[] }
const rows: Row[] = []
for (let start = 0; ; start += 500) {
  const { data, error } = await sb.from('menu_items').select('menu_day_id,position,name,tags,allergens').or('name.ilike.*vegan*,name.ilike.*plant*based*').order('menu_day_id').order('position').range(start, start + 499)
  if (error) throw error
  rows.push(...data)
  if (data.length < 500) break
}
let changed = 0
const days = new Set<string>()
for (const row of rows) {
  const tags = explicitDietTags(row.name, row.tags, row.allergens)
  if (JSON.stringify(tags) === JSON.stringify(row.tags)) continue
  console.log(`${values.dry ? 'Would tag' : 'Tagging'} ${row.name}: ${tags.join(', ')}`)
  if (!values.dry) {
    const { data, error } = await sb.from('menu_items').update({ tags }).eq('menu_day_id', row.menu_day_id).eq('position', row.position).eq('name', row.name).eq('tags', `{${row.tags.join(',')}}`).select('position')
    if (error) throw error
    if (data.length !== 1) throw new Error('Menu changed during correction; rerun after checking it')
    const { error: hashError } = await sb.from('menu_days').update({ content_hash: null }).eq('id', row.menu_day_id)
    if (hashError) throw hashError
  }
  changed++
  days.add(row.menu_day_id)
}
console.log(`${values.dry ? 'Would correct' : 'Corrected'} ${changed} appearances across ${days.size} menus; source timestamps preserved.`)
