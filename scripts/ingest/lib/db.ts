import { createClient } from '@supabase/supabase-js'
import type { MenuDay } from '../../schema.ts'
import type { MenuSource } from './source.ts'

type Method = 'script' | 'manual'

/** Service-role client from VITE_SUPABASE_URL + SUPABASE_SECRET_KEY (.env is loaded if present). Never run in the browser. */
export function connect() {
  try {
    process.loadEnvFile()
  } catch {
    // no .env: rely on the environment (CI)
  }
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('Set VITE_SUPABASE_URL and SUPABASE_SECRET_KEY (or pass --dry)')
  const sb = createClient(url, key, { auth: { persistSession: false } })

  return {
    async saveMenu(venue: string, sourceUrl: string, fetchedAt: string, method: Method, days: MenuDay[]) {
      const { error } = await sb.rpc('save_menu', { p_venue_id: venue, p_source_url: sourceUrl, p_fetched_at: fetchedAt, p_method: method, p_days: days })
      if (error) throw new Error(`save_menu ${venue}: ${error.message}`)
    },
    /** How many services after `date` are saved for this venue. */
    async savedAfter(venue: string, date: string): Promise<number> {
      const { count, error } = await sb.from('menu_days').select('*', { count: 'exact', head: true }).eq('venue_id', venue).gt('date', date)
      if (error) throw new Error(`menu_days ${venue}: ${error.message}`)
      return count ?? 0
    },
    /** Copies how each venue publishes its menu to `venues`, for the app. Returns the ids that matched no venue. */
    async syncSources(sources: MenuSource[]): Promise<string[]> {
      const missing = await Promise.all(
        sources.map(async (s) => {
          const { data, error } = await sb.from('venues').update({ menu_channel: s.channel, menu_url: s.url ?? null, menu_scripted: !!s.adapter }).eq('id', s.venue).select('id')
          if (error) throw new Error(`venues ${s.venue}: ${error.message}`)
          return data.length ? [] : [s.venue]
        }),
      )
      return missing.flat()
    },
    async logRun(run: { venue_id: string; method: Method; started_at: string; status: 'ok' | 'empty' | 'error'; days?: number; dishes?: number; error?: string }) {
      const { error } = await sb.from('ingest_runs').insert(run)
      if (error) console.error(`ingest_runs: ${error.message}`)
    },
  }
}
