// Validate data/ + menus/ and emit public/data.json for the static fallback repo.
import { mkdirSync, writeFileSync } from 'node:fs'
import { loadBundle } from './lib/load.ts'

const bundle = loadBundle()
mkdirSync('public', { recursive: true })
writeFileSync('public/data.json', JSON.stringify(bundle))

const halls = bundle.colleges.flatMap((c) => c.venues.filter((v) => v.type === 'hall').map((v) => `${c.slug}/${v.slug}`))
const withSlots = new Set(bundle.slots.map((s) => `${s.college}/${s.venue}`))
const hallsNoHours = halls.filter((h) => !withSlots.has(h))
const live = bundle.colleges.filter((c) => c.venues.some((v) => v.menu_source?.status === 'live')).length
const dishes = bundle.menus.reduce((n, m) => n + m.days.reduce((k, d) => k + d.items.length, 0), 0)

console.log(
  `colleges=${bundle.colleges.length} venues=${bundle.colleges.reduce((n, c) => n + c.venues.length, 0)} slots=${bundle.slots.length} live_menu_sources=${live} menu_files=${bundle.menus.length} dishes=${dishes}`,
)
if (hallsNoHours.length) console.log(`halls without structured hours (${hallsNoHours.length}): ${hallsNoHours.join(', ')}`)
