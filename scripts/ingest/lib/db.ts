import { createClient } from '@supabase/supabase-js'
import type { MenuDay, PriceItem } from '../../schema.ts'
import type { Hours } from '../hours.ts'
import type { MenuSource } from './source.ts'

type Method = 'script' | 'manual' | 'user' | 'contributor'

/** A row of `submissions` as the CLI reads it (service role). */
export type Submission = {
  id: string
  venue_id: string
  kind: 'menu' | 'prices' | 'hours' | 'photo' | 'other'
  date: string | null
  service: string | null
  note: string | null
  photo_path: string | null
  contact: string | null
  user_email: string | null
  contributor_id: string | null
  transcription: string | null
  transcribed_by: string | null
  model: string | null
  /** what the model couldn't read or guessed */
  unsure: string | null
  status: 'received' | 'transcribed' | 'needs_review' | 'queued' | 'approved' | 'rejected'
  review_note: string | null
  /** kind photo: the sender's name, which it's credited to, and the model's description of it */
  credit: string | null
  alt: string | null
  created_at: string
}

/** A member's review of a venue (`reviews`, 0030); `user_email` joined in for the person reviewing it, never shown. */
export type Review = {
  id: string
  venue_id: string
  user_id: string
  rating: number
  body: string | null
  status: 'published' | 'needs_review' | 'hidden'
  review_note: string | null
  created_at: string
  updated_at: string
}

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
    /** Takes down a venue's menus for these days and meals, only those saved by `method` (a member's, say). Returns how many went. */
    async deleteMenuDays(venue: string, days: { date: string; service: string }[], method: Method): Promise<number> {
      let gone = 0
      for (const d of days) {
        const { count, error } = await sb.from('menu_days').delete({ count: 'exact' }).eq('venue_id', venue).eq('date', d.date).eq('service', d.service).eq('method', method)
        if (error) throw new Error(`menu_days ${venue} ${d.date} ${d.service}: ${error.message}`)
        gone += count ?? 0
      }
      return gone
    },
    /** Saves a venue's hours as slots, replacing its current ones unless `replace` is false. The source goes in each slot's prov. */
    async saveHours(h: Hours, opts: { replace: boolean; source_kind: 'official' | 'reported'; submission?: string }) {
      const [site, venue] = h.venue.split('/')
      if (opts.replace) {
        const { error } = await sb.from('service_slots').delete().eq('venue_id', h.venue)
        if (error) throw new Error(`service_slots ${h.venue}: ${error.message}`)
      }
      const prov = { confidence: h.confidence, source_kind: opts.source_kind, observed_at: h.observed_on, source: h.source, ...(opts.submission ? { submission: opts.submission } : {}) }
      const rows = h.slots.map((s) => ({ venue_id: h.venue, site, venue, meal: s.meal, days: s.days, start_time: s.start, end_time: s.end, period: s.period, note: s.note ?? null, prov }))
      const { error } = await sb.from('service_slots').insert(rows)
      if (error) throw new Error(`service_slots ${h.venue}: ${error.message}`)
    },
    /** A venue with what a transcription prompt needs to say about it. */
    async venue(id: string) {
      const { data, error } = await sb.from('venues').select('id, slug, name, type, site, menu_scripted, sites(name, short_name)').eq('id', id).single()
      if (error) throw new Error(`venues ${id}: ${error.message}`)
      const v = data as unknown as { id: string; slug: string; name: string; type: 'hall' | 'cafe' | 'bar'; site: string; menu_scripted: boolean | null; sites: { name: string; short_name: string | null } | null }
      return { ...v, siteName: v.sites?.short_name ?? v.sites?.name ?? v.site }
    },
    /** The venue's current slots, for the CLI to show before replacing them. */
    async slotsOf(venue: string) {
      const { data, error } = await sb.from('service_slots').select('meal, days, start_time, end_time, period, note').eq('venue_id', venue).order('meal')
      if (error) throw new Error(`service_slots ${venue}: ${error.message}`)
      return data as { meal: string; days: string[]; start_time: string; end_time: string; period: string; note: string | null }[]
    },
    /** Submissions, newest last; `status` narrows, `trusted` keeps only contributors' rows. */
    async submissions(filter: { status?: Submission['status'][]; trusted?: boolean; id?: string } = {}): Promise<Submission[]> {
      let q = sb.from('submissions').select('*').order('created_at')
      if (filter.id) q = q.eq('id', filter.id)
      if (filter.status) q = q.in('status', filter.status)
      if (filter.trusted) q = q.not('contributor_id', 'is', null)
      const { data, error } = await q
      if (error) throw new Error(`submissions: ${error.message}`)
      return data as Submission[]
    },
    async updateSubmission(id: string, patch: Partial<Pick<Submission, 'transcription' | 'transcribed_by' | 'status' | 'review_note'>> & { reviewed_at?: string }) {
      const { error } = await sb.from('submissions').update(patch).eq('id', id)
      if (error) throw new Error(`submissions ${id}: ${error.message}`)
    },
    /** The photo sent with a submission, as bytes. */
    async submissionPhoto(path: string): Promise<Uint8Array> {
      const { data, error } = await sb.storage.from('submissions').download(path)
      if (error || !data) throw new Error(`submissions bucket ${path}: ${error?.message ?? 'no data'}`)
      return new Uint8Array(await data.arrayBuffer())
    },
    /** Replaces the venue's price list. */
    async savePrices(venue: string, observedOn: string, source: string, items: PriceItem[]) {
      const { error } = await sb.rpc('save_prices', { p_venue_id: venue, p_observed_on: observedOn, p_source: source, p_items: items })
      if (error) throw new Error(`save_prices ${venue}: ${error.message}`)
    },
    /** Whether the venue or site (`subject`: "<site>/<venue>" or "<site>") already has a photo from `source`, so a list can be run again without doubling up. */
    async hasPhoto(subject: string, source: string): Promise<boolean> {
      const { count, error } = await sb.from('photos').select('*', { count: 'exact', head: true }).eq(subject.includes('/') ? 'venue_id' : 'site', subject).eq('source', source)
      if (error) throw new Error(`photos ${subject}: ${error.message}`)
      return !!count
    },
    /** Adds a photo after the subject's others of its kind, or, `first`, ahead of them (a member's replaces the one shown). */
    async savePhoto(photo: { subject: string; kind: 'venue' | 'menu'; path: string; widths: number[]; width: number; height: number; color: string; alt: string; credit: string | null; licence: string | null; source: string | null; taken_on: string | null; approved: boolean; submission_id?: string }, opts: { first?: boolean } = {}) {
      const { subject, ...rest } = photo
      const column = subject.includes('/') ? 'venue_id' : 'site'
      const { data, error: readError } = await sb.from('photos').select('position').eq(column, subject).eq('kind', photo.kind)
      if (readError) throw new Error(`photos ${subject}: ${readError.message}`)
      const positions = data.map((p) => p.position as number)
      const position = !positions.length ? 0 : opts.first ? Math.min(...positions) - 1 : Math.max(...positions) + 1
      const { error } = await sb.from('photos').insert({ ...rest, [column]: subject, position })
      if (error) throw new Error(`photos ${subject}: ${error.message}`)
    },
    async reviews(filter: { status?: Review['status'][] } = {}): Promise<Review[]> {
      let q = sb.from('reviews').select('*').order('updated_at')
      if (filter.status) q = q.in('status', filter.status)
      const { data, error } = await q
      if (error) throw new Error(`reviews: ${error.message}`)
      return data as Review[]
    },
    async updateReview(id: string, patch: Partial<Pick<Review, 'status' | 'review_note'>>) {
      const { error } = await sb.from('reviews').update(patch).eq('id', id)
      if (error) throw new Error(`reviews ${id}: ${error.message}`)
    },
    /** A review's author's address, for the person deciding on it (auth.users, through the admin API). */
    async userEmail(id: string): Promise<string | null> {
      const { data } = await sb.auth.admin.getUserById(id)
      return data.user?.email ?? null
    },
    /** What the model calls since `iso` cost, in dollars (calls whose price wasn't known count as nothing), and how many there were. */
    async modelSpend(iso: string): Promise<{ usd: number; calls: number }> {
      const { data, error } = await sb.from('model_calls').select('cost_usd').gte('at', iso)
      if (error) throw new Error(`model_calls: ${error.message}`)
      return { usd: (data ?? []).reduce((n, c) => n + Number(c.cost_usd ?? 0), 0), calls: data?.length ?? 0 }
    },
    /** Takes down the photo a submission put up, so the venue's one before it shows again. How many were hidden. */
    async hideSubmissionPhoto(submission: string): Promise<number> {
      const { data, error } = await sb.from('photos').update({ approved: false }).eq('submission_id', submission).select('path')
      if (error) throw new Error(`photos of ${submission}: ${error.message}`)
      return data.length
    },
    /** Members' photos published but not yet shown: their rows wait, unapproved, until their files are served (`live`). Not one taken down since. */
    async photosAwaitingDeploy(): Promise<{ id: string; path: string; widths: number[]; venue_id: string; submission_id: string }[]> {
      const { data, error } = await sb.from('photos').select('id, path, widths, venue_id, submission_id, submissions!inner(status)').eq('approved', false).not('submission_id', 'is', null).eq('submissions.status', 'approved')
      if (error) throw new Error(`photos awaiting deploy: ${error.message}`)
      return data as unknown as { id: string; path: string; widths: number[]; venue_id: string; submission_id: string }[]
    },
    async approvePhoto(id: string) {
      const { error } = await sb.from('photos').update({ approved: true }).eq('id', id)
      if (error) throw new Error(`photos ${id}: ${error.message}`)
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
