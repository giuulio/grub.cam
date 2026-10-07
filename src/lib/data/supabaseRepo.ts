import { createClient } from '@supabase/supabase-js'
import type { Repo } from './repo.ts'
import type { College, Dish, Formal, MenuDay, MenuFile, ServiceSlot, Venue } from './types.ts'

// Row shapes mirror supabase/migrations/0001_init.sql
type CollegeRow = { slug: string; name: string; short_name: string | null; official_dining_url: string | null; reviewed: string; notice: string | null; links: College['links']; notes: string[] }
type VenueRow = { id: string; college: string; slug: string; name: string; type: Venue['type']; where_text: string | null; hours_text: string | null; access: Venue['access']; payment: Venue['payment']; prices: Venue['prices'] | null; serves: string | null; dietary: Venue['dietary']; menu_source: Venue['menu_source'] | null; sort_order: number }
type SlotRow = { venue_id: string; college: string; venue: string; meal: ServiceSlot['meal']; days: ServiceSlot['days']; start_time: string; end_time: string; period: ServiceSlot['period']; note: string | null; prov: ServiceSlot['prov'] }
type FormalRow = { college: string } & Omit<Formal, 'prov'> & { prov: Formal['prov'] }
type ItemRow = { position: number; name: string; tags: Dish['tags']; price_gbp: number | null; price_text: string | null; course: Dish['course'] | null; sold_out: boolean | null }
type MenuDayRow = { college: string; venue: string; week: string; date: string; service: MenuDay['service']; menu_items: ItemRow[]; note: string | null; source_url: string; fetched_at: string; method: MenuFile['method']; file_note: string | null }

export function supabaseRepo(url: string, anonKey: string): Repo {
  const sb = createClient(url, anonKey, { auth: { persistSession: false } })
  return {
    name: 'supabase',
    async loadBundle() {
      const [c, v, s, f, m] = await Promise.all([
        sb.from('colleges').select('*').order('name'),
        sb.from('venues').select('*').order('sort_order'),
        sb.from('service_slots').select('*'),
        sb.from('formals').select('*'),
        sb
          .from('menu_days')
          .select('*, menu_items(position, name, tags, price_gbp, price_text, course, sold_out)')
          .gte('date', isoDaysAgo(8))
          .order('position', { referencedTable: 'menu_items' }),
      ])
      for (const r of [c, v, s, f, m]) if (r.error) throw new Error(r.error.message)

      const venuesByCollege = new Map<string, Venue[]>()
      for (const row of (v.data ?? []) as VenueRow[]) {
        const venue: Venue = {
          slug: row.slug,
          name: row.name,
          type: row.type,
          where: row.where_text ?? undefined,
          hours_text: row.hours_text ?? undefined,
          access: row.access,
          payment: row.payment,
          prices: row.prices ?? undefined,
          serves: row.serves ?? undefined,
          dietary: row.dietary,
          menu_source: row.menu_source ?? undefined,
        }
        const list = venuesByCollege.get(row.college) ?? []
        list.push(venue)
        venuesByCollege.set(row.college, list)
      }
      const formals = new Map(((f.data ?? []) as FormalRow[]).map((r) => [r.college, r]))
      const colleges: College[] = ((c.data ?? []) as CollegeRow[]).map((r) => {
        const fr = formals.get(r.slug)
        return {
          slug: r.slug,
          name: r.name,
          short_name: r.short_name ?? undefined,
          official_dining_url: r.official_dining_url ?? undefined,
          reviewed: r.reviewed,
          notice: r.notice ?? undefined,
          links: r.links ?? [],
          venues: venuesByCollege.get(r.slug) ?? [],
          formal: fr ? stripNulls({ ...fr, college: undefined }) : undefined,
          notes: r.notes ?? [],
        }
      })
      const slots = ((s.data ?? []) as SlotRow[]).map((r) => ({
        college: r.college,
        venue: r.venue,
        meal: r.meal,
        days: r.days,
        start: r.start_time.slice(0, 5),
        end: r.end_time.slice(0, 5),
        period: r.period,
        note: r.note ?? undefined,
        prov: r.prov,
      }))
      const menuFiles = new Map<string, MenuFile>()
      for (const r of (m.data ?? []) as MenuDayRow[]) {
        const k = `${r.week}/${r.college}/${r.venue}`
        let file = menuFiles.get(k)
        if (!file) {
          file = { college: r.college, venue: r.venue, week: r.week, source_url: r.source_url, fetched_at: r.fetched_at, method: r.method, note: r.file_note ?? undefined, days: [] }
          menuFiles.set(k, file)
        }
        file.days.push({ date: r.date, service: r.service, items: r.menu_items.map((i) => stripNulls({ ...i, position: undefined }) as Dish), note: r.note ?? undefined })
      }
      // Freshness = latest menu fetch, not page-load time.
      const latest = ((m.data ?? []) as MenuDayRow[]).reduce((max, r) => (r.fetched_at > max ? r.fetched_at : max), '')
      return { generated_at: latest || new Date().toISOString(), colleges, slots, menus: [...menuFiles.values()] }
    },
  }
}

function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
}

function stripNulls<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as T
}
