// Public menu dataset, same file structure each run. Default destination is Downloads; never writes data to the repo.
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { parseArgs } from 'node:util'
import assert from 'node:assert/strict'
import { EXPORT_TABLES, DEFINITIONS, csv, exportRows, hash, type ExportData, type Row } from './lib/menu-export.ts'
import { servedService } from '../src/lib/time/openNow.ts'
import type { Meal, Slot } from '../src/lib/types.ts'
import { todayLondon } from './ingest/lib/dates.ts'

try { process.loadEnvFile() } catch { /* CI */ }
const { values } = parseArgs({ options: { out: { type: 'string', default: join(homedir(), 'Downloads') } } })
const origin = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
assert(origin && key, 'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (public browser configuration)')
const started = new Date().toISOString(), date = todayLondon()
async function get(table: string, params: Row, head = false) {
  const url = new URL(`/rest/v1/${table}`, origin)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  const response = await fetch(url, { method: head ? 'HEAD' : 'GET', headers: { apikey: key!, Prefer: 'count=exact' }, signal: AbortSignal.timeout(30000) })
  assert(response.ok, `Public read failed for ${table}: ${response.status}`)
  const count = Number(response.headers.get('content-range')?.split('/')[1]); assert(Number.isInteger(count), 'Missing row count')
  return { count, rows: head ? [] : await response.json() as Row[] }
}
const names = Object.keys(EXPORT_TABLES) as (keyof ExportData)[]
const counts = async () => Object.fromEntries(await Promise.all(names.map(async (t) => [t, (await get(t, { select: '*' }, true)).count])))
const before = await counts()
async function table(t: keyof ExportData) {
  const rows: Row[] = []
  for (let offset = 0; offset < before[t]; offset += 500) {
    const page = await get(t, { select: EXPORT_TABLES[t][0], order: EXPORT_TABLES[t][1], offset, limit: 500 })
    assert.equal(page.count, before[t], `${t} changed during export`)
    assert.equal(page.rows.length, Math.min(500, before[t] - offset), `${t} was truncated`)
    rows.push(...page.rows)
  }
  return rows
}
const data = Object.fromEntries(await Promise.all(names.map(async (t) => [t, await table(t)]))) as ExportData
assert.deepEqual(await counts(), before, 'Source counts changed; rerun')
assert.deepEqual(await table('menu_days'), data.menu_days, 'Menu versions changed; rerun')
assert.deepEqual(await table('menu_items'), data.menu_items, 'Menu items changed during export; rerun')
const completed = new Date().toISOString(), served = new Map<string, string>()
for (const v of data.venues) {
  const days = data.menu_days.filter((d) => d.venue_id === v.id).map((d) => ({ id: String(d.id), date: String(d.date), service: d.service as Meal }))
  const slots = data.service_slots.filter((s) => s.venue_id === v.id).map((s) => ({ meal: s.meal, days: s.days, period: s.period, start: s.start_time, end: s.end_time })) as Slot[]
  for (const d of servedService(days, slots)) served.set(d.id, d.service)
}
const tables: Record<string, Row[]> = exportRows(data, date, served)
tables['data_dictionary.csv'] = Object.entries(tables).flatMap(([file, rows]) => Object.keys(rows[0]).map((column) => ({ file, column,
  description: DEFINITIONS[column] ?? column.replaceAll('_', ' ') + '. Blank means unrecorded; see README for table scope.' })))
const name = `grub-menu-data-${started.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}`
const parent = resolve(values.out!), out = join(parent, name)
await mkdir(parent, { recursive: true }); await mkdir(out)
const files = []
for (const [file, rows] of Object.entries(tables)) {
  const text = csv(rows)
  for (const env of ['VITE_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_ACCESS_TOKEN', 'OPENAI_API_KEY']) {
    const secret = process.env[env]; assert(!secret || !text.includes(secret), 'Credential detected; export aborted')
  }
  await writeFile(join(out, file), text)
  files.push({ file, rows: rows.length, columns: Object.keys(rows[0]).length, sha256: hash(text), bytes: Buffer.byteLength(text) })
}
const summary = { menus: data.menu_days.length, item_appearances: data.menu_items.length, venues: data.venues.length,
  venues_with_menus: new Set(data.menu_days.map((d) => d.venue_id)).size, standing_menu_lines: data.venue_prices.length,
  earliest_menu_date: data.menu_days.map((d) => String(d.date)).sort()[0], latest_menu_date: data.menu_days.map((d) => String(d.date)).sort().at(-1) }
await writeFile(join(out, 'README.md'), `# Grub menu data\n\nSource: https://grub.cam/. Export calendar date: ${date} (Europe/London).\nPublic API reads: ${started} to ${completed}.\n\n${summary.menus} venue/date/meal menus, ${summary.item_appearances} dish appearances, ${summary.venues_with_menus} venues with dated menus out of ${summary.venues} listed. Dates: ${summary.earliest_menu_date} to ${summary.latest_menu_date}. ${summary.standing_menu_lines} current standing menu/price-list lines.\n\n## Files\n\n- menu_items.csv: one dish appearance per menu, including repeated offerings. Key: menu_id + position. Contains venue/date/meal and provenance for use without joins.\n- menus.csv: all stored menus, including zero-item notes. Join menu_id to items; venue/date/service is also unique. Notes can describe cancellations or menus posted elsewhere. Zero dishes alone does not mean closed.\n- venues.csv: all venues, including those with no dated menus; join venue_id. Includes posted pricing rules and verified source labelling, distinct from dish tags.\n- standing_menu_items.csv: current price-list lines, including drinks and course/whole-meal prices. Keep separate from dated appearances. line_kind=item selects individual items, some of which are drinks.\n- coverage.csv: counts per venue across ALL exported dates. First/last dates do not imply continuous coverage.\n- data_dictionary.csv: column definitions. manifest.json records source counts, extraction checks, row counts and hashes. SHA256SUMS.txt checks delivered files.\n\n## Diet labels and analysis\n\nUnlabelled means unknown, never non-vegan. Tags come from source codes or explicit whole-dish wording. plant_based implies vegan and vegan implies vegetarian. Names may have been normalised and extracted codes removed. There is no recipe inference. A mention of a vegan ingredient or a mixed choice does not automatically label a whole dish. The original evidence for each individual tag is not stored separately.\n\nlabelled_vegan_or_plant_based=false means neither label is recorded, NOT animal ingredients present. A vegetarian-only tag does not establish non-vegan status: call it Vegetarian label only. has_any_diet_tag includes other tags such as halal/gluten_free, so it does not establish known vegan status. Allergens are separate; an empty array does not mean allergen-free or vegan. May contain statements are retained.\n\nsource_diet_codes and source_allergens describe the VERIFIED source convention: present/absent/mixed/unknown. Source URL, date checked and notes define its scope. Explicit wording in names is distinct from separate codes. Even present does not guarantee every item is labelled. A different source, such as a member photo, may label differently. Unknown has not been verified; do not replace it with an assumption from the proportion of tagged items.\n\nChoose and state period, venues, meals, courses and denominator before analysis. Report label coverage and sample sizes. Analyse mains, sides, soups and desserts separately where possible; blank course is unknown. Missing course fields can exclude whole venues from a mains-only comparison. A missing menu is not a meal with zero vegan choices. Future publications are plans; past dates do not prove service occurred. Published menu options do not measure portions cooked, sales, consumption, food weight or emissions. Unique normalised names and repeated menu appearances answer different questions. Downing's single daily menu is stored for lunch and dinner when its source does not separate them. Standing items must not be repeated across dates as if observed daily. Keep later research classifications separately with their own evidence.\n\n## Format and provenance\n\nUTF-8 CSV without BOM, comma-separated, one header row, CRLF row endings, standard quoting (including embedded newlines). Blank means null/unrecorded, not zero. Prices are decimal GBP as posted; From and range qualifiers remain separate, and percentage discounts are not computed. See venues price tiers: the database column non_member_gbp is the second tier, not necessarily non-member. Identifiers should be imported as text. Date columns use YYYY-MM-DD. Timestamps retain their stored offsets. Booleans are true/false. Columns ending _json contain JSON arrays; [] is an empty array and blank is null.\n\nservice is the stored source meal. service_served uses Grub's current service slots/Full Term mapping, e.g. Saturday Lunch to brunch; it is not a historical hours record. method=script can include model-assisted document transcription. fetched_at is this saved version's fetch/save timestamp, not necessarily source publication time or most recent check. observed_on is when a standing line was observed, not its service date or validity interval. Source links can become unavailable or require venue access. Errors in source/transcription remain possible.\n\nThis contains the latest saved version of every venue/date/service at extraction time, not every previous revision or original documents/photos. Reads were paginated and checked against exact counts, joins and unique item keys; counts were rechecked and menu metadata read twice. This is a read interval, not a transaction snapshot. Only explicitly selected public menu/reference fields are included. No account credentials, submission evidence, contributor identities, reviews or internal research notes are exported. Access-sensitive source references are omitted.\n\nSuggested attribution: Grub (grub.cam), data exported ${date}; original menu source references are included. No new licence is assigned to underlying menu content.\n\n## Refresh\n\nRepository command: npm run export:menus -- --out /path/to/exports (defaults to Downloads). Uses only VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, the public browser configuration; no database account is needed. Fetch every page; the API limits a response, and the homepage only loads seven days. See CONTRIBUTING.md for public API access. Weekly dated datasets are also published as GitHub release assets.\n`)
await writeFile(join(out, 'manifest.json'), JSON.stringify({ format_version: 2, export_calendar_date: date, timezone: 'Europe/London', read_started_at: started,
  read_completed_at: completed, source_row_counts: before, summary, files, checks: { public_only: true, counts_stable: true, menu_versions_stable: true, joins_and_unique_item_keys: true } }, null, 2) + '\n')
const sums = await Promise.all((await readdir(out)).sort().map(async (file) => `${hash(await readFile(join(out, file)))}  ${file}`))
await writeFile(join(out, 'SHA256SUMS.txt'), sums.join('\n') + '\n')
const archive = join(parent, `${name}.zip`)
execFileSync('zip', ['-q', '-r', archive, name], { cwd: parent })
console.log(JSON.stringify({ directory: out, archive, summary }))
