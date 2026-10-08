// Saves what the app loads from Supabase right now (sites, venues, the next week of menus) to
// src/lib/fixtures/snapshot.json, the real data src/lib/search.test.ts runs its example queries against.
// `npm run search:snapshot`, then check the examples still describe what's on the menus.
import { mkdirSync, writeFileSync } from 'node:fs'
import { createServer } from 'vite'
import type { Venue } from '../src/lib/types.ts'

const OUT = 'src/lib/fixtures/snapshot.json'

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'warn' })
try {
  const { load } = (await vite.ssrLoadModule('/src/lib/data.tsx')) as { load(): Promise<{ venues: Venue[]; menuFrom: string }> }
  const { venues, menuFrom } = await load()
  // Only what search and filters read: no free-text notes, prices or URLs.
  const sites = new Map<string, unknown>()
  for (const { site, menu, url: _url, where: _where, serves: _serves, ...v } of venues) {
    const { official_dining_url: _official, ...s } = site
    const entry = (sites.get(s.slug) ?? sites.set(s.slug, { ...s, venues: [] }).get(s.slug)) as { venues: unknown[] }
    entry.venues.push({ ...v, menu: menu.map((d) => ({ date: d.date, service: d.service, items: d.items.map((i) => ({ name: i.name, tags: i.tags })) })) })
  }
  mkdirSync('src/lib/fixtures', { recursive: true })
  writeFileSync(OUT, JSON.stringify({ date: menuFrom, sites: [...sites.values()] }) + '\n')
  console.log(`${OUT}: ${venues.length} venues, menus from ${menuFrom}`)
} finally {
  await vite.close()
}
