// POST /functions/v1/submit — what someone in a venue sends from its page: a photo of the menu board, the price list
// or the hours, and/or typed text. Stores the photo in the private `submissions` bucket, inserts the row, and (within
// a daily budget) has a model transcribe it into the ingest text format for its kind; the sender then confirms that
// text (action "confirm"), which queues it for review. Nothing is published from here: `npm run submissions -- approve`
// does that, after a person has looked (or, for a member's photo of the venue, the photos Action: see below).
//
// The model is OpenAI's (OPENAI_API_KEY, OPENAI_MODEL; OPENAI_PRICE "0.75/4.50", its dollars per million input and
// output tokens; OPENAI_REASONING, the effort for a reasoning model), through the Responses API with answers in a fixed
// shape (_shared/openai.ts). Every call is logged in `model_calls` with its tokens and cost, and once today's calls
// have cost LLM_DAILY_USD (default 2) no more are made, so a burst can't spend the credit: past it, a row waits for a
// person. No key: the same. Contributors (table `contributors`) post JSON with a X-Contributor-Token header and their
// own transcription; the ingest Action approves theirs.
//
// A photo of the venue (kind "photo", the "Have a better photo?" on its page) is the one thing that goes up without a
// person: a model checks it (vet()) and, when it passes and the sender's daily allowance has room, the row is `queued`
// and the photos Action (.github/workflows/photos.yml) is started (GITHUB_DISPATCH_TOKEN: a fine-grained token with
// Actions read and write on the repo; GITHUB_REPO, default giuulio/grub.cam). That Action makes its sizes, commits them
// and adds the photo ahead of the venue's others, credited to the sender's name. Anything else waits for a person.
//
// Every submission from the form has a signed-in sender: a Supabase Auth user (Microsoft sign-in, University tenant) with an
// @cam.ac.uk address, read from the Authorization bearer token; the row keeps their id and email. Contributors' token posts
// don't need one.
//
// Deploy: supabase functions deploy submit; secrets: supabase secrets set OPENAI_API_KEY=… (see AGENTS.md, Submissions).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { BODY_SPEC, cleanBody, header, prompt, type Kind, type Transcribable } from '../_shared/formats.ts'
import { base64, costOf, readPrice, respond, TRANSCRIPTION, VERDICT, type Image, type Schema, type Transcription, type Verdict } from '../_shared/openai.ts'

const KINDS: Kind[] = ['menu', 'prices', 'hours', 'photo', 'other']
const MEALS = ['breakfast', 'brunch', 'lunch', 'dinner', 'formal', 'snacks', 'bar']
const MAX_PHOTO = 5 * 1024 * 1024
const PER_HOUR = 12 // submissions from one address
const PHOTOS_PER_DAY = 3 // a member's photos that go up without a person looking
const DAILY_USD = Number(Deno.env.get('LLM_DAILY_USD') ?? 2)
const MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-5.4-mini'
const PRICE = readPrice(Deno.env.get('OPENAI_PRICE'))
// A call whose cost isn't known (no OPENAI_PRICE) counts as this against the day's budget
const UNPRICED_USD = 0.01

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-contributor-token, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })
const fail = (message: string, status = 400) => json({ error: message }, status)

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

type Venue = { id: string; slug: string; name: string; type: 'hall' | 'cafe' | 'bar'; site: string; sites: { name: string; short_name: string | null } | null }

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date())

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Whether today's calls (London time) have left room in the budget for one more. */
async function underBudget(): Promise<boolean> {
  const { data } = await sb.from('model_calls').select('cost_usd').gte('at', `${today()}T00:00:00Z`)
  const spent = (data ?? []).reduce((n, c) => n + (c.cost_usd == null ? UNPRICED_USD : Number(c.cost_usd)), 0)
  return spent < DAILY_USD
}

type Purpose = 'transcribe' | 'vet_photo' | 'review'

/**
 * One call to the model, logged with its tokens and cost; its parsed answer, or null when it can't be asked (no key,
 * over budget) or the call fails. `good` says whether the answer was of use, for the log.
 */
async function ask<T>(purpose: Purpose, text: string, schema: Schema, image: Image | null, submission: string | null, good: (v: T) => boolean = () => true): Promise<T | null> {
  const key = Deno.env.get('OPENAI_API_KEY')
  if (!key || !(await underBudget())) return null
  try {
    const { value, usage } = await respond<T>({ key, model: MODEL, text, image: image ?? undefined, schema, reasoning: Deno.env.get('OPENAI_REASONING') || undefined })
    await sb.from('model_calls').insert({ purpose, model: MODEL, input_tokens: usage.input, output_tokens: usage.output, cost_usd: costOf(usage, PRICE) ?? null, ok: good(value), submission_id: submission })
    return value
  } catch (e) {
    console.warn(`${purpose}: ${(e as Error).message}`)
    return null
  }
}

/** The model's body for the photo and/or text, or null when it couldn't (no key, over budget, failed, saw nothing). */
async function transcribe(id: string, c: Parameters<typeof prompt>[0], photo: Image | null): Promise<{ body: string; unsure: string } | null> {
  if (!photo && !c.note) return null
  const got = await ask<Transcription>('transcribe', prompt(c, true), TRANSCRIPTION, photo, id, (t) => t.readable && !!t.body.trim())
  const body = got?.readable ? cleanBody(got.body) : ''
  return body ? { body, unsure: got!.unsure.trim() } : null
}

/**
 * Whether a member's photo of a venue can go up without a person looking: the model's verdict, a reason the sender can
 * act on when it can't, and alt text. Null when no model could look.
 */
async function vet(id: string, venue: Venue, photo: Image): Promise<Verdict | null> {
  const where = venue.sites?.short_name ?? venue.sites?.name ?? venue.site
  const text = [
    `You check photos that members of the University of Cambridge send for the page of a place to eat or drink, before they replace its photo without anyone else looking.`,
    `This one is meant to show ${venue.name}, a ${{ hall: 'dining hall', cafe: 'café', bar: 'bar' }[venue.type]} at ${where}.`,
    `It can go up (ok: true) only if all of these hold: it is a real photograph (not a screenshot, meme, drawing, or mostly text such as a menu); it shows a dining hall, café, bar, servery, counter, seating or the building one is in; no person's face is recognisable (people far off, from behind or blurred are fine); nothing offensive, sexual, violent or mocking; no personal information readable; in focus and not mostly dark.`,
    `The alt text says what the photo shows, e.g. "The servery counter with the day's hot dishes, from the queue".`,
  ].join('\n\n')
  const v = await ask<Verdict>('vet_photo', text, VERDICT, photo, id)
  return v && { ok: v.ok, reason: v.reason.slice(0, 300), alt: v.alt.slice(0, 200) }
}

/** Starts the photos Action, which publishes what's queued; its hourly run catches anything this misses. */
async function dispatchPhotos() {
  const token = Deno.env.get('GITHUB_DISPATCH_TOKEN')
  if (!token) return
  const repo = Deno.env.get('GITHUB_REPO') ?? 'giuulio/grub.cam'
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/photos.yml/dispatches`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'grub.cam submit' },
    body: JSON.stringify({ ref: 'main' }),
  }).catch((e) => (console.warn(`dispatch: ${(e as Error).message}`), null))
  if (res && !res.ok) console.warn(`dispatch ${res.status}: ${(await res.text()).slice(0, 300)}`)
}

/**
 * A member's photo of the venue: up within minutes when a model passes it and nothing says to wait (the sender's
 * daily allowance, another member's photo of the venue in the last day), else queued for a person.
 */
async function photoOf(id: string, venue: Venue, sender: { id: string }, photo: Image): Promise<Response> {
  const day = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { count: mine } = await sb.from('submissions').select('*', { count: 'exact', head: true }).eq('user_id', sender.id).eq('kind', 'photo').in('status', ['queued', 'approved']).gte('created_at', day)
  // Two members swapping a venue's photo back and forth: the second waits for a person
  const { count: recent } = await sb.from('photos').select('*', { count: 'exact', head: true }).eq('venue_id', venue.id).not('submission_id', 'is', null).gte('created_at', day)
  const waitFor = (mine ?? 0) >= PHOTOS_PER_DAY ? 'you have sent a few today' : (recent ?? 0) > 0 ? 'this venue had a new photo today' : null
  const verdict = await vet(id, venue, photo)
  const patch = { alt: verdict?.alt || null, ...(verdict ? { transcribed_by: 'openai', model: MODEL } : {}) }
  if (verdict?.ok && !waitFor) {
    await sb.from('submissions').update({ ...patch, status: 'queued' }).eq('id', id)
    await dispatchPhotos()
    return json({ id, status: 'queued', transcription: null })
  }
  const reason = verdict && !verdict.ok ? verdict.reason : waitFor
  await sb.from('submissions').update({ ...patch, status: 'needs_review', review_note: reason }).eq('id', id)
  return json({ id, status: 'needs_review', transcription: null, reason })
}

/** The signed-in sender behind the request's bearer token, when it's a user's (not the anon key) and a University address. */
async function senderOf(req: Request): Promise<{ id: string; email: string; name: string | null } | { error: string }> {
  const jwt = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!jwt || jwt === Deno.env.get('SUPABASE_ANON_KEY')) return { error: 'sign in with your Cambridge account to send things in' }
  const { data, error } = await sb.auth.getUser(jwt)
  if (error || !data.user) return { error: 'your sign-in has expired; sign in again' }
  const email = data.user.email ?? ''
  if (!/@cam\.ac\.uk$/i.test(email)) return { error: 'only University of Cambridge accounts (@cam.ac.uk) can send things in' }
  // Microsoft's display name for the account, as the app reads it too (memberName() in src/lib/auth.ts)
  const meta = data.user.user_metadata ?? {}
  const name = String(meta.full_name ?? meta.name ?? '').trim().slice(0, 80) || null
  return { id: data.user.id, email, name }
}

async function venueOf(id: string): Promise<Venue | null> {
  const { data } = await sb.from('venues').select('id, slug, name, type, site, sites(name, short_name)').eq('id', id).maybeSingle()
  return (data as Venue | null) ?? null
}

/** A sender confirming (possibly edited) text: it joins the review queue. Only while the row is fresh and unreviewed. */
async function confirm(sender: { id: string }, body: { id?: string; transcription?: string }): Promise<Response> {
  if (!body.id || typeof body.transcription !== 'string') return fail('id and transcription needed')
  const { data: row } = await sb.from('submissions').select('id, status, transcription, created_at, user_id').eq('id', body.id).maybeSingle()
  if (!row || row.user_id !== sender.id) return fail('no such submission', 404)
  if (!['received', 'transcribed'].includes(row.status)) return fail('already reviewed', 409)
  if (Date.now() - new Date(row.created_at).getTime() > 24 * 3600 * 1000) return fail('too late to change', 409)
  const text = body.transcription.trim().slice(0, 20000)
  if (!text.includes('\n---\n')) return fail('the text needs its header and a --- line')
  const edited = text !== (row.transcription ?? '').trim()
  await sb.from('submissions').update({ transcription: text, status: 'needs_review', ...(edited ? { transcribed_by: 'sender' } : {}) }).eq('id', body.id)
  return json({ id: body.id, status: 'needs_review' })
}

/** A contributor's own transcription, from their script: queued as trusted. */
async function contributorPost(token: string, body: { venue?: string; kind?: string; transcription?: string; note?: string }): Promise<Response> {
  const { data: c } = await sb.from('contributors').select('id, sites, active').eq('token_hash', await sha256(token)).maybeSingle()
  if (!c || !c.active) return fail('unknown contributor token', 401)
  if (!body.venue || !body.kind || !body.transcription) return fail('venue, kind and transcription needed')
  if (!['menu', 'prices', 'hours'].includes(body.kind)) return fail('kind must be menu, prices or hours')
  const venue = await venueOf(body.venue)
  if (!venue) return fail('no such venue', 404)
  if (c.sites && !c.sites.includes(venue.site)) return fail('not your site', 403)
  if (!body.transcription.includes('\n---\n')) return fail('the transcription needs its header and a --- line')
  const { data, error } = await sb
    .from('submissions')
    .insert({ venue_id: venue.id, kind: body.kind, note: body.note?.slice(0, 2000) ?? null, contributor_id: c.id, transcription: body.transcription.slice(0, 50000), transcribed_by: 'contributor', status: 'needs_review' })
    .select('id')
    .single()
  if (error) return fail(error.message, 500)
  return json({ id: data.id, status: 'needs_review' })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return fail('POST only', 405)
  const type = req.headers.get('content-type') ?? ''

  if (type.includes('application/json')) {
    const body = await req.json().catch(() => ({}))
    const token = req.headers.get('x-contributor-token')
    if (token) return contributorPost(token, body)
    if (body.action === 'confirm') {
      const sender = await senderOf(req)
      return 'error' in sender ? fail(sender.error, 401) : confirm(sender, body)
    }
    return fail('a photo or text goes as multipart/form-data; JSON is for confirming or for contributors')
  }
  if (!type.includes('multipart/form-data')) return fail('multipart/form-data expected')
  const sender = await senderOf(req)
  if ('error' in sender) return fail(sender.error, 401)

  const form = await req.formData()
  const field = (k: string) => {
    const v = form.get(k)
    return typeof v === 'string' ? v.trim() : ''
  }
  if (field('website')) return json({ id: crypto.randomUUID(), status: 'received' }) // honeypot: pretend
  const kind = field('kind') as Kind
  if (!KINDS.includes(kind)) return fail('kind must be menu, prices, hours, photo or other')
  const venue = await venueOf(field('venue'))
  if (!venue) return fail('no such venue', 404)
  const date = field('date') || null
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('date as YYYY-MM-DD')
  const service = field('service') || null
  if (service && !MEALS.includes(service)) return fail('unknown meal')
  const note = field('note').slice(0, 4000) || null
  const file = form.get('photo')
  const photo = file instanceof File && file.size > 0 ? file : null
  if (!photo && !note) return fail('send a photo or some text')
  if (photo && photo.size > MAX_PHOTO) return fail('photo too big (5 MB at most)', 413)
  if (photo && !/^image\/(jpeg|png|webp|heic|heif)$/.test(photo.type)) return fail('photo must be JPEG, PNG, WebP or HEIC')
  if (kind === 'photo' && !photo) return fail('add the photo')
  // The photos Action can't read HEIC (the page converts it to JPEG where the browser can)
  if (kind === 'photo' && !/^image\/(jpeg|png|webp)$/.test(photo!.type)) return fail('send the photo as a JPEG, PNG or WebP')

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? req.headers.get('cf-connecting-ip') ?? ''
  const ipHash = ip ? await sha256(ip + (Deno.env.get('IP_SALT') ?? '')) : null
  if (ipHash) {
    const { count } = await sb.from('submissions').select('*', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', new Date(Date.now() - 3600 * 1000).toISOString())
    if ((count ?? 0) >= PER_HOUR) return fail('that is plenty for one hour; thank you', 429)
  }

  const { data: row, error } = await sb.from('submissions').insert({ venue_id: venue.id, kind, date, service, note, user_id: sender.id, user_email: sender.email, contact: sender.email, ip_hash: ipHash, ...(kind === 'photo' ? { credit: sender.name } : {}) }).select('id').single()
  if (error) return fail(error.message, 500)
  const id: string = row.id

  let bytes: Uint8Array | null = null
  let stored = false
  if (photo) {
    bytes = new Uint8Array(await photo.arrayBuffer())
    const ext = photo.type.split('/')[1].replace('jpeg', 'jpg')
    const path = `${id}.${ext}`
    const up = await sb.storage.from('submissions').upload(path, bytes, { contentType: photo.type, upsert: false })
    if (up.error) console.warn(`upload ${path}: ${up.error.message}`)
    else stored = !(await sb.from('submissions').update({ photo_path: path }).eq('id', id)).error
  }

  if (kind === 'photo' && !stored) return fail('the photo did not save; try again', 500)
  const image: Image | null = bytes && photo ? { base64: base64(bytes), mime: photo.type } : null
  if (kind === 'photo' && image) return photoOf(id, venue, sender, image)
  if (!['menu', 'prices', 'hours'].includes(kind)) return json({ id, status: 'received', transcription: null })
  const t = kind as Transcribable
  const siteName = venue.sites?.short_name ?? venue.sites?.name ?? venue.site
  const got = await transcribe(id, { kind: t, venue: { name: venue.name, type: venue.type, site: siteName }, date: date ?? undefined, service: service ?? undefined, note: note ?? undefined }, image)
  if (!got) return json({ id, status: 'received', transcription: null, spec: BODY_SPEC[t] })
  const text = header(t, { site: venue.site, venue: venue.slug, source: `submission ${id}: ${photo ? 'photo' : 'text'} sent from the venue's page on grub.cam`, observed: today() }) + got.body + '\n'
  await sb.from('submissions').update({ transcription: text, transcribed_by: 'openai', model: MODEL, unsure: got.unsure || null, status: 'transcribed' }).eq('id', id)
  return json({ id, status: 'transcribed', transcription: text, by: 'openai', unsure: got.unsure || null })
})
