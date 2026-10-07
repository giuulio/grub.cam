import { createClient } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { addDaysISO, toLocalNow } from './time/clock.ts'
import type { College, MenuDay, Venue } from './types.ts'

const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })

type Data = { colleges: College[]; venues: Venue[]; updated?: string }
type State = { status: 'loading' } | { status: 'error'; error: string } | ({ status: 'ready' } & Data)

type VenueRow = Omit<Venue, 'college' | 'menu'>
type CollegeRow = College & { venues: VenueRow[] }
type MenuDayRow = MenuDay & { venue_id: string; fetched_at: string }

async function load(): Promise<Data> {
  const today = toLocalNow().date
  const [c, m] = await Promise.all([
    sb
      .from('colleges')
      .select('slug, name, short_name, official_dining_url, venues(id, slug, name, type, where:where_text, serves, access, payment, dietary, slots:service_slots(meal, days, start:start_time, end:end_time, period))')
      .order('name')
      .order('sort_order', { referencedTable: 'venues' })
      .returns<CollegeRow[]>(),
    sb
      .from('menu_days')
      .select('venue_id, date, service, note, fetched_at, items:menu_items(name, tags)')
      .gte('date', today)
      .lt('date', addDaysISO(today, 7))
      .order('position', { referencedTable: 'menu_items' })
      .returns<MenuDayRow[]>(),
  ])
  if (c.error) throw new Error(c.error.message)
  if (m.error) throw new Error(m.error.message)

  const menus = new Map<string, MenuDay[]>()
  for (const d of m.data) menus.set(d.venue_id, [...(menus.get(d.venue_id) ?? []), d])
  const colleges: College[] = []
  const venues: Venue[] = []
  for (const { venues: rows, ...college } of c.data) {
    colleges.push(college)
    for (const v of rows) {
      // Postgres `time` comes back as HH:MM:SS
      const slots = v.slots.map((s) => ({ ...s, start: s.start.slice(0, 5), end: s.end.slice(0, 5) }))
      venues.push({ ...v, college, slots, menu: menus.get(v.id) ?? [] })
    }
  }
  // Freshness = latest menu fetch, not page-load time.
  const updated = m.data.reduce<string | undefined>((max, d) => (!max || d.fetched_at > max ? d.fetched_at : max), undefined)
  return { colleges, venues, updated }
}

const Ctx = createContext<State>({ status: 'loading' })

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' })
  useEffect(() => {
    let cancelled = false
    load()
      .then((data) => !cancelled && setState({ status: 'ready', ...data }))
      .catch((e: Error) => !cancelled && setState({ status: 'error', error: e.message }))
    return () => {
      cancelled = true
    }
  }, [])
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}

export const useData = () => useContext(Ctx)

/** For pages rendered only once data is ready (App gates the routes on it). */
export function useReady() {
  const data = useContext(Ctx)
  if (data.status !== 'ready') throw new Error('useReady() called before data loaded')
  return data
}
