import type { DataBundle } from './types.ts'

/**
 * Data access boundary. The app only ever calls `loadBundle()`; the implementation
 * is chosen at startup: Supabase when configured, otherwise the static JSON built by
 * `npm run build:data`.
 */
export interface Repo {
  name: 'supabase' | 'static'
  loadBundle(): Promise<DataBundle>
}

export async function createRepo(): Promise<Repo> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (url && key) {
    const { supabaseRepo } = await import('./supabaseRepo.ts')
    return supabaseRepo(url, key)
  }
  const { staticRepo } = await import('./staticRepo.ts')
  return staticRepo()
}
