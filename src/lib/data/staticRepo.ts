import type { Repo } from './repo.ts'
import type { DataBundle } from './types.ts'

export function staticRepo(): Repo {
  return {
    name: 'static',
    async loadBundle() {
      const res = await fetch(`${import.meta.env.BASE_URL}data.json`, { cache: 'no-cache' })
      if (!res.ok) throw new Error(`data.json: ${res.status}`)
      return (await res.json()) as DataBundle
    },
  }
}
