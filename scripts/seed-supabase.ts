// Upsert data/ and menus/ into Supabase. Requires SUPABASE_URL (or VITE_SUPABASE_URL) and
// SUPABASE_SECRET_KEY in the environment (.env is loaded if present). Never run in the browser.
import { existsSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { dishKey } from './lib/dishKey.ts'
import { loadBundle } from './lib/load.ts'

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  console.error('Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SECRET_KEY')
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

// Menus: menu_days (upserted on venue/date/service) -> dishes (one per college + dishKey) -> menu_items (replaced per day).
{
  const days = bundle.menus.flatMap((m) =>
    m.days.map((d) => ({
      row: {
        venue_id: `${m.college}/${m.venue}`,
        college: m.college,
        venue: m.venue,
        week: m.week,
        date: d.date,
        service: d.service,
        note: d.note ?? null,
        source_url: m.source_url,
        fetched_at: m.fetched_at,
        method: m.method,
        file_note: m.note ?? null,
      },
      items: d.items,
    })),
  )
  const dayIds = new Map<string, string>()
  for (const part of chunks(days, 500)) {
    const { data, error } = await sb
      .from('menu_days')
      .upsert(part.map((d) => d.row), { onConflict: 'venue_id,date,service' })
      .select('id, venue_id, date, service')
    if (error) throw new Error(`menu_days: ${error.message}`)
    for (const r of data) dayIds.set(`${r.venue_id}|${r.date}|${r.service}`, r.id)
  }
  console.log(`✓ ${'menu_days'.padEnd(14)} ${days.length}`)

  // Keep the first-seen display name: insert new keys only, then read every id back.
  const newDishes = new Map<string, { college: string; name: string; name_key: string }>()
  for (const d of days) for (const i of d.items) newDishes.set(`${d.row.college}|${dishKey(i.name)}`, { college: d.row.college, name: i.name, name_key: dishKey(i.name) })
  for (const part of chunks([...newDishes.values()], 500)) {
    const { error } = await sb.from('dishes').upsert(part, { onConflict: 'college,name_key', ignoreDuplicates: true })
    if (error) throw new Error(`dishes: ${error.message}`)
  }
  const dishIds = new Map<string, number>()
  for (const college of new Set(days.map((d) => d.row.college))) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from('dishes').select('id, name_key').eq('college', college).order('id').range(from, from + 999)
      if (error) throw new Error(`dishes read: ${error.message}`)
      for (const r of data) dishIds.set(`${college}|${r.name_key}`, r.id)
      if (data.length < 1000) break
    }
  }
  console.log(`✓ ${'dishes'.padEnd(14)} ${newDishes.size}`)

  const ids = [...dayIds.values()]
  for (const part of chunks(ids, 200)) {
    const { error } = await sb.from('menu_items').delete().in('menu_day_id', part)
    if (error) throw new Error(`menu_items delete: ${error.message}`)
  }
  await upsert(
    'menu_items',
    days.flatMap((d) =>
      d.items.map((i, position) => ({
        menu_day_id: dayIds.get(`${d.row.venue_id}|${d.row.date}|${d.row.service}`),
        position,
        dish_id: dishIds.get(`${d.row.college}|${dishKey(i.name)}`),
        name: i.name,
        tags: i.tags,
        price_gbp: i.price_gbp ?? null,
        price_text: i.price_text ?? null,
        course: i.course ?? null,
        sold_out: i.sold_out ?? null,
      })),
    ),
  )
}

console.log('done')

function chunks<T>(xs: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n))
  return out
}
