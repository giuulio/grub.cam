import { createClient } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useReducer, useRef, type ReactNode } from 'react'
import { addDaysISO, toLocalNow } from './time/clock.ts'
import type { MenuDay, Site, Venue, VenuePrice } from './types.ts'

const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })

/**
 * `menuFrom`–`menuTo` (exclusive) is the window of menus loaded up front, into `Venue.menu`.
 * `snapshot`: rendered at build time (scripts/prerender.ts), so nothing that depends on the clock is shown.
 */
export type Data = { sites: Site[]; venues: Venue[]; updated?: string; menuFrom: string; menuTo: string; snapshot?: boolean }
export type State = { status: 'loading' } | { status: 'error'; error: string } | ({ status: 'ready' } & Data)

type VenueRow = Omit<Venue, 'site' | 'menu' | 'prices' | 'formal'> & { prices: (VenuePrice & { position: number })[]; formal: { venue_id: string } | null }
type SiteRow = Site & { venues: VenueRow[] }
type MenuDayRow = MenuDay & { venue_id: string; fetched_at: string }

const ITEMS = 'items:menu_items(name, tags, price_gbp, price_text, course, sold_out)'
const MENU_DAYS = 7

/** Everything the pages need up front: sites, venues, hours and the next week of menus. */
export async function load(): Promise<Data> {
  const today = toLocalNow().date
  const menuTo = addDaysISO(today, MENU_DAYS)
  const [c, m] = await Promise.all([
    sb
      .from('sites')
      .select('slug, name, short_name, kind, official_dining_url, aliases, venues(id, slug, name, aliases, type, url, where:where_text, serves, access, payment, dietary, menu_channel, menu_url, menu_scripted, prices:venue_prices(position, section, name, price_gbp, non_member_gbp, services, course, observed_on), formal:formals(venue_id), slots:service_slots(meal, days, start:start_time, end:end_time, period))')
      .order('name')
      .order('sort_order', { referencedTable: 'venues' })
      .returns<SiteRow[]>(),
    sb
      .from('menu_days')
      .select(`venue_id, date, service, note, fetched_at, ${ITEMS}`)
      .gte('date', today)
      .lt('date', menuTo)
      .order('position', { referencedTable: 'menu_items' })
      .returns<MenuDayRow[]>(),
  ])
  if (c.error) throw new Error(c.error.message)
  if (m.error) throw new Error(m.error.message)

  const menus = new Map<string, MenuDay[]>()
  for (const d of m.data) menus.set(d.venue_id, [...(menus.get(d.venue_id) ?? []), d])
  const sites: Site[] = []
  const venues: Venue[] = []
  for (const { venues: rows, ...site } of c.data) {
    sites.push(site)
    for (const v of rows) {
      // Postgres `time` comes back as HH:MM:SS
      const slots = v.slots.map((s) => ({ ...s, start: s.start.slice(0, 5), end: s.end.slice(0, 5) }))
      venues.push({ ...v, site, slots, prices: v.prices.sort((a, b) => a.position - b.position), formal: !!v.formal, menu: menus.get(v.id) ?? [] })
    }
  }
  // Freshness = latest menu fetch, not page-load time.
  const updated = m.data.reduce<string | undefined>((max, d) => (!max || d.fetched_at > max ? d.fetched_at : max), undefined)
  return { sites, venues, updated, menuFrom: today, menuTo }
}

const Ctx = createContext<State>({ status: 'loading' })

/** The app renders once data has loaded (main.tsx) or from build-time data (entry-server.tsx). */
export function DataProvider({ value, children }: { value: State; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useData = () => useContext(Ctx)

/** For pages rendered only once data is ready (App gates the routes on it). */
export function useReady() {
  const data = useContext(Ctx)
  if (data.status !== 'ready') throw new Error('useReady() called before data loaded')
  return data
}

// Per-venue menu history, fetched when a venue page asks for it and kept for the session.
const pending = new Map<string, Promise<unknown>>()
const done = new Map<string, unknown>()
const failed = new Set<string>()

function useFetched<T>(key: string | undefined, run: () => Promise<T>): { data?: T; failed: boolean } {
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  const runRef = useRef(run)
  useEffect(() => {
    runRef.current = run
  })
  useEffect(() => {
    if (!key || done.has(key)) return
    let live = true
    let p = pending.get(key)
    if (!p) {
      failed.delete(key)
      p = runRef.current().then(
        (v) => void done.set(key, v),
        () => void failed.add(key),
      )
      pending.set(key, p)
      void p.finally(() => pending.delete(key))
    }
    void p.then(() => live && rerender())
    return () => {
      live = false
    }
  }, [key])
  return { data: key ? (done.get(key) as T | undefined) : undefined, failed: !!key && failed.has(key) }
}

/** Every date the venue has a published menu for (with at least one dish), past and future, ascending. */
export function useMenuDates(venueId: string): string[] | undefined {
  return useFetched(`dates:${venueId}`, async () => {
    const r = await sb.from('menu_days').select('date, items:menu_items(count)').eq('venue_id', venueId).order('date').returns<{ date: string; items: { count: number }[] }[]>()
    if (r.error) throw new Error(r.error.message)
    return [...new Set(r.data.filter((d) => d.items[0]?.count).map((d) => d.date))]
  }).data
}

/** The venue's menus on one date: from the up-front window when it covers the date, else fetched. */
export function useMenuOn(venue: Venue, date: string): { days?: MenuDay[]; failed: boolean } {
  const { menuFrom, menuTo } = useReady()
  const loaded = date >= menuFrom && date < menuTo
  const r = useFetched(loaded ? undefined : `menu:${venue.id}:${date}`, async () => {
    const q = await sb.from('menu_days').select(`date, service, note, ${ITEMS}`).eq('venue_id', venue.id).eq('date', date).order('position', { referencedTable: 'menu_items' }).returns<MenuDay[]>()
    if (q.error) throw new Error(q.error.message)
    return q.data
  })
  return loaded ? { days: venue.menu.filter((d) => d.date === date), failed: false } : { days: r.data, failed: r.failed }
}
