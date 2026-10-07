// Upsert data/ and menus/ into Supabase. Requires SUPABASE_URL (or VITE_SUPABASE_URL) and
// SUPABASE_SERVICE_ROLE_KEY in the environment (.env is loaded if present). Never run in the browser.
import { existsSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { loadBundle } from './lib/load.ts'

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const sb = createClient(url, key, { auth: { persistSession: false } })
const bundle = loadBundle()

async function upsert(table: string, rows: object[], onConflict?: string) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from(table).upsert(rows.slice(i, i + 500), onConflict ? { onConflict } : undefined)
    if (error) throw new Error(`${table}: ${error.message}`)
  }
  console.log(`✓ ${table.padEnd(14)} ${rows.length}`)
}

await upsert(
  'colleges',
  bundle.colleges.map((c) => ({
    slug: c.slug,
    name: c.name,
    short_name: c.short_name ?? null,
    official_dining_url: c.official_dining_url ?? null,
    reviewed: c.reviewed,
    notice: c.notice ?? null,
    links: c.links,
    notes: c.notes,
    updated_at: new Date().toISOString(),
  })),
)

await upsert(
  'venues',
  bundle.colleges.flatMap((c) =>
    c.venues.map((v, i) => ({
      id: `${c.slug}/${v.slug}`,
      college: c.slug,
      slug: v.slug,
      name: v.name,
      type: v.type,
      where_text: v.where ?? null,
      hours_text: v.hours_text ?? null,
      access: v.access,
      payment: v.payment,
      prices: v.prices ?? null,
      serves: v.serves ?? null,
      dietary: v.dietary,
      menu_source: v.menu_source ?? null,
      sort_order: i,
      updated_at: new Date().toISOString(),
    })),
  ),
)

// Slots have no natural key, so replace per venue.
{
  const venueIds = [...new Set(bundle.slots.map((s) => `${s.college}/${s.venue}`))]
  const { error } = await sb.from('service_slots').delete().in('venue_id', venueIds)
  if (error) throw new Error(`service_slots delete: ${error.message}`)
  await upsert(
    'service_slots',
    bundle.slots.map((s) => ({
      venue_id: `${s.college}/${s.venue}`,
      college: s.college,
      venue: s.venue,
      meal: s.meal,
      days: s.days,
      start_time: s.start,
      end_time: s.end,
      period: s.period,
      note: s.note ?? null,
      prov: s.prov,
    })),
  )
}

await upsert(
  'formals',
  bundle.colleges
    .filter((c) => c.formal)
    .map((c) => ({
      college: c.slug,
      where_text: c.formal!.where ?? null,
      days_text: c.formal!.days_text ?? null,
      days: c.formal!.days ?? null,
      time: c.formal!.time ?? null,
      dress: c.formal!.dress ?? null,
      format: c.formal!.format ?? null,
      booking: c.formal!.booking ?? null,
      guests: c.formal!.guests ?? null,
      cost: c.formal!.cost ?? null,
      prov: c.formal!.prov,
    })),
)

await upsert(
  'menu_days',
  bundle.menus.flatMap((m) =>
    m.days.map((d) => ({
      venue_id: `${m.college}/${m.venue}`,
      college: m.college,
      venue: m.venue,
      week: m.week,
      date: d.date,
      service: d.service,
      items: d.items,
      note: d.note ?? null,
      source_url: m.source_url,
      fetched_at: m.fetched_at,
      method: m.method,
      file_note: m.note ?? null,
    })),
  ),
  'venue_id,date,service',
)

console.log('done')
