import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createRepo } from './repo.ts'
import type { DataBundle, VenueView } from './types.ts'
import { buildVenueViews } from './view.ts'

type DataState = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; bundle: DataBundle; venues: VenueView[]; source: string }

const Ctx = createContext<DataState>({ status: 'loading' })

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DataState>({ status: 'loading' })
  useEffect(() => {
    let cancelled = false
    createRepo()
      .then(async (repo) => {
        const bundle = await repo.loadBundle()
        if (!cancelled) setState({ status: 'ready', bundle, venues: buildVenueViews(bundle), source: repo.name })
      })
      .catch((e: Error) => !cancelled && setState({ status: 'error', error: e.message }))
    return () => {
      cancelled = true
    }
  }, [])
  const value = useMemo(() => state, [state])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useData = () => useContext(Ctx)

/** For pages rendered only once data is ready (App gates the routes on it). */
export function useReady() {
  const data = useContext(Ctx)
  if (data.status !== 'ready') throw new Error('useReady() called before data loaded')
  return data
}
