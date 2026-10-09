// POST /functions/v1/submit — what someone in a venue sends from its page: a photo of the menu board, the price list
// or the hours, and/or typed text. Stores the photo in the private `submissions` bucket, inserts the row, and (within
// a daily budget) has a model transcribe it into the ingest text format for its kind; the sender then confirms that
// text (action "confirm"), which queues it for review. Nothing is published from here: `npm run submissions -- approve`
// does that, after a person has looked.
//
// Models, in order, each skipped when its key is unset or it fails: OpenAI (OPENAI_API_KEY, OPENAI_MODEL), then Gemini
// (GEMINI_API_KEY, GEMINI_MODEL). LLM_DAILY_CAP (default 25) transcriptions a day across both, so a burst can't spend
// the credit; past it, the row waits for a person. Contributors (table `contributors`) post JSON with a
// X-Contributor-Token header and their own transcription; the ingest Action approves theirs.
//
// Deploy: supabase functions deploy submit; secrets: supabase secrets set OPENAI_API_KEY=… (see AGENTS.md, Submissions).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { BODY_SPEC, cleanBody, header, prompt, type Kind, type Transcribable } from '../_shared/formats.ts'

const KINDS: Kind[] = ['menu', 'prices', 'hours', 'photo', 'other']
const MEALS = ['breakfast', 'brunch', 'lunch', 'dinner', 'formal', 'snacks', 'bar']
const MAX_PHOTO = 5 * 1024 * 1024
const PER_HOUR = 12 // submissions from one address
const CAP = Number(Deno.env.get('LLM_DAILY_CAP') ?? 25)

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

function base64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** The model's body for the photo and/or text, or null when no model could (no key, over budget, failed, saw nothing). */
async function transcribe(c: Parameters<typeof prompt>[0], photo: { bytes: Uint8Array; mime: string } | null): Promise<{ body: string; by: 'openai' | 'gemini'; model: string } | null> {
  if (!photo && !c.note) return null
  const since = `${today()}T00:00:00Z`
  const { count } = await sb.from('submissions').select('*', { count: 'exact', head: true }).in('transcribed_by', ['openai', 'gemini']).gte('created_at', since)
  if ((count ?? 0) >= CAP) return null
  const text = prompt(c)
  const image = photo ? `data:${photo.mime};base64,${base64(photo.bytes)}` : null

  const openai = Deno.env.get('OPENAI_API_KEY')
  if (openai) {
    const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini'
    try {
      const content: unknown[] = [{ type: 'text', text }]
      if (image) content.push({ type: 'image_url', image_url: { url: image, detail: 'high' } })
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { authorization: `Bearer ${openai}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, temperature: 0, max_tokens: 2000, messages: [{ role: 'user', content }] }),
      })
      if (res.ok) {
        const data = await res.json()
        const out = cleanBody(data.choices?.[0]?.message?.content ?? '')
        return out && out !== 'NOTHING' ? { body: out, by: 'openai', model } : null
      }
      console.warn(`openai ${res.status}: ${(await res.text()).slice(0, 300)}`)
    } catch (e) {
      console.warn(`openai: ${(e as Error).message}`)
    }
  }
  const gemini = Deno.env.get('GEMINI_API_KEY')
  if (gemini) {
    const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.0-flash'
    try {
      const parts: unknown[] = [{ text }]
      if (photo) parts.push({ inline_data: { mime_type: photo.mime, data: base64(photo.bytes) } })
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gemini}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0, maxOutputTokens: 2000 } }),
      })
      if (res.ok) {
        const data = await res.json()
        const out = cleanBody(data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '')
        return out && out !== 'NOTHING' ? { body: out, by: 'gemini', model } : null
      }
      console.warn(`gemini ${res.status}: ${(await res.text()).slice(0, 300)}`)
    } catch (e) {
      console.warn(`gemini: ${(e as Error).message}`)
    }
  }
  return null
}

async function venueOf(id: string): Promise<Venue | null> {
  const { data } = await sb.from('venues').select('id, slug, name, type, site, sites(name, short_name)').eq('id', id).maybeSingle()
  return (data as Venue | null) ?? null
}

/** A sender confirming (possibly edited) text: it joins the review queue. Only while the row is fresh and unreviewed. */
async function confirm(body: { id?: string; transcription?: string }): Promise<Response> {
  if (!body.id || typeof body.transcription !== 'string') return fail('id and transcription needed')
  const { data: row } = await sb.from('submissions').select('id, status, transcription, created_at').eq('id', body.id).maybeSingle()
  if (!row) return fail('no such submission', 404)
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
    if (body.action === 'confirm') return confirm(body)
    return fail('a photo or text goes as multipart/form-data; JSON is for confirming or for contributors')
  }
  if (!type.includes('multipart/form-data')) return fail('multipart/form-data expected')

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
  const contact = field('contact').slice(0, 200) || null
  const file = form.get('photo')
  const photo = file instanceof File && file.size > 0 ? file : null
  if (!photo && !note) return fail('send a photo or some text')
  if (photo && photo.size > MAX_PHOTO) return fail('photo too big (5 MB at most)', 413)
  if (photo && !/^image\/(jpeg|png|webp|heic|heif)$/.test(photo.type)) return fail('photo must be JPEG, PNG, WebP or HEIC')

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? req.headers.get('cf-connecting-ip') ?? ''
  const ipHash = ip ? await sha256(ip + (Deno.env.get('IP_SALT') ?? '')) : null
  if (ipHash) {
    const { count } = await sb.from('submissions').select('*', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', new Date(Date.now() - 3600 * 1000).toISOString())
    if ((count ?? 0) >= PER_HOUR) return fail('that is plenty for one hour; thank you', 429)
  }

  const { data: row, error } = await sb.from('submissions').insert({ venue_id: venue.id, kind, date, service, note, contact, ip_hash: ipHash }).select('id').single()
  if (error) return fail(error.message, 500)
  const id: string = row.id

  let bytes: Uint8Array | null = null
  if (photo) {
    bytes = new Uint8Array(await photo.arrayBuffer())
    const ext = photo.type.split('/')[1].replace('jpeg', 'jpg')
    const path = `${id}.${ext}`
    const up = await sb.storage.from('submissions').upload(path, bytes, { contentType: photo.type, upsert: false })
    if (up.error) console.warn(`upload ${path}: ${up.error.message}`)
    else await sb.from('submissions').update({ photo_path: path }).eq('id', id)
  }

  if (!['menu', 'prices', 'hours'].includes(kind)) return json({ id, status: 'received', transcription: null })
  const t = kind as Transcribable
  const siteName = venue.sites?.short_name ?? venue.sites?.name ?? venue.site
  const got = await transcribe({ kind: t, venue: { name: venue.name, type: venue.type, site: siteName }, date: date ?? undefined, service: service ?? undefined, note: note ?? undefined }, bytes && photo ? { bytes, mime: photo.type } : null)
  if (!got) return json({ id, status: 'received', transcription: null, spec: BODY_SPEC[t] })
  const text = header(t, { site: venue.site, venue: venue.slug, source: `submission ${id}: ${photo ? 'photo' : 'text'} sent from the venue's page on grub.cam`, observed: today() }) + got.body + '\n'
  await sb.from('submissions').update({ transcription: text, transcribed_by: got.by, model: got.model, status: 'transcribed' }).eq('id', id)
  return json({ id, status: 'transcribed', transcription: text, by: got.by })
})
