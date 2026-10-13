// POST /functions/v1/submit — what someone in a venue sends from its page: photos of the menu board, the price list
// or the hours (up to MAX_PHOTOS, or PDFs), with or without a note giving context, or typed text. Stores the files in
// the private `submissions` bucket, inserts the row, and has a model transcribe them into the ingest text format for
// its kind, streamed to the sender as it's written (stream=1). The page (auto=1) leaves the rest to the model's
// verdict: confident, it's queued for the photos Action to publish (holdOf() permitting); not (a bad or irrelevant
// photo, a guessed price), it's rejected and the sender is told what to send instead. Without auto=1 the sender
// confirms the text (action "confirm"), as the page did before. Nothing is published from here.
//
// The models are OpenAI's (OPENAI_API_KEY), through the Responses API with answers in a fixed shape (_shared/openai.ts):
// OPENAI_MODEL (default gpt-6.1-sol) reads boards, price lists and hours, where accuracy is what members feel;
// OPENAI_CHECK_MODEL (default gpt-6-luna) vets photos and reviews, simpler questions at a twentieth of the price.
// Their prices are known for the defaults (priceOf()); OPENAI_PRICE / OPENAI_CHECK_PRICE ("2/10", dollars per million
// input and output tokens) set them for any other. OPENAI_REASONING: the effort for both (default the model's own).
// Every call is logged in `model_calls` with its tokens and cost. Spending is limited by the OpenAI project's monthly
// budget, not here (filling gaps fast is worth a month's budget in a day); LLM_DAILY_USD, when set, also stops calls
// once today's have cost that much. A call refused or failing (no key, quota spent) leaves the row for a person. Contributors (table `contributors`) post JSON with a X-Contributor-Token header and their
// own transcription; the ingest Action approves theirs.
//
// A menu, once its sender has confirmed the text, goes up without a person too, unless a script fetches the venue's
// menu: it's `queued`, and the photos Action (`submissions -- publish`) checks it parses, is for its venue and is dated
// yesterday or later (no future cutoff), then publishes it; one that isn't waits for a person. There's no allowance
// per sender: one member filling in a whole site in an afternoon is the point. A price list or hours goes the same way,
// and when the sender changed the model's reading of a photo, a model first checks the changed text still says what
// the photo does (checkReading()). The model reading them is given what the site lists now, so a photo of part of a
// board, or a typed correction ("Monday closes at 2"), comes back as the whole list with the change made. AUTO_KINDS
// (default "menu,prices,hours") says which kinds go up without a person; "menu" alone has prices and hours wait for
// one again.
//
// A photo of the venue (kind "photo", the "Have a better photo?" on its page) goes up without a person: a model checks
// it (vet()) and, when it passes and no other member's photo of the venue went up in the last day, the row is `queued`
// and the photos Action (.github/workflows/photos.yml) is started (dispatch_workflow(), migration 0031, with the GitHub
// token in Vault). That Action makes its sizes, commits them and adds the photo ahead of the venue's others, credited
// to the sender's name. Anything else waits for a person.
//
// A correction ("Report a change": kind "other") says what it's about (`topic`: hours, prices, menu, formal, diet,
// location, closed, other), so the queue can say it.
//
// Every submission from the form has a signed-in sender: a Supabase Auth user (Google sign-in) with an
// @cam.ac.uk address, read from the Authorization bearer token; the row keeps their id and email, and the name it goes up
// under (`credit`, migration 0039: shown on the venue's page and on /contribute, so a wrong menu has someone behind it).
// Contributors' token posts don't need one.
//
// A review (action "review": venue, rating 1–5, optional words; or remove) is a signed-in member's, one per venue. A
// rating alone is published; words are checked first (OpenAI's moderation, free, then OPENAI_CHECK_MODEL asking
// whether they're about the venue and name no one) and wait for a person when they don't pass or
// no model can look. Venues show reviews only with 5 or more published (the views in migration 0030).
//
// Deploy: supabase functions deploy submit; secrets: supabase secrets set OPENAI_API_KEY=… (see AGENTS.md, Submissions).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { BODY_SPEC, cleanBody, header, prompt, type Kind, type Transcribable } from '../_shared/formats.ts'
import { base64, costOf, moderate, partialString, priceOf, respond, respondStream, REVIEW_CHECK, TRANSCRIPTION, VERDICT, type Image, type ReviewCheck, type Schema, type Transcription, type Verdict } from '../_shared/openai.ts'

const KINDS: Kind[] = ['menu', 'prices', 'hours', 'photo', 'other']
const MEALS = ['breakfast', 'brunch', 'lunch', 'dinner', 'formal', 'snacks', 'bar']
const TOPICS = ['hours', 'prices', 'menu', 'formal', 'diet', 'location', 'closed', 'other']
const MAX_PHOTO = 5 * 1024 * 1024
const MAX_PDF = 10 * 1024 * 1024
const MAX_PHOTOS = 10 // a board on several sheets, read together; a photo of the venue is one
const AUTO_KINDS = (Deno.env.get('AUTO_KINDS') ?? 'menu,prices,hours').split(',').map((k) => k.trim())
// No daily cap unless one is set: OpenAI's project budget is the limit
const DAILY_USD = Deno.env.get('LLM_DAILY_USD') ? Number(Deno.env.get('LLM_DAILY_USD')) : Infinity
const MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-6.1-sol'
const PRICE = priceOf(MODEL, Deno.env.get('OPENAI_PRICE'))
// Whether a photo or a review can go up is an easier question than reading a board: a cheaper model
const CHECK_MODEL = Deno.env.get('OPENAI_CHECK_MODEL') || 'gpt-6-luna'
const CHECK_PRICE = priceOf(CHECK_MODEL, Deno.env.get('OPENAI_CHECK_PRICE'))
const REVIEWS_PER_DAY = 20 // reviews one member can write or change in a day
// A call whose cost isn't known (a model priceOf() doesn't know, and no OPENAI_PRICE) counts as this against the day's budget
const UNPRICED_USD = 0.01
// Room for a reasoning model's thinking as well as a long price list's answer
const MAX_OUTPUT = 16000

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

/** Whether today's calls (London time) have left room under LLM_DAILY_USD for one more; always, when it isn't set. */
async function underBudget(): Promise<boolean> {
  if (DAILY_USD === Infinity) return true
  const { data } = await sb.from('model_calls').select('cost_usd').gte('at', `${today()}T00:00:00Z`)
  const spent = (data ?? []).reduce((n, c) => n + (c.cost_usd == null ? UNPRICED_USD : Number(c.cost_usd)), 0)
  return spent < DAILY_USD
}

type Purpose = 'transcribe' | 'vet_photo' | 'review' | 'check_reading'

/**
 * One call to the model, logged with its tokens and cost against what it was for (`ref`); its parsed answer, or null
 * when it can't be asked (no key, over budget) or the call fails. `good` says whether the answer was of use, for the
 * log. A photo's or a review's check uses the cheaper CHECK_MODEL.
 */
async function ask<T>(purpose: Purpose, text: string, schema: Schema, images: Image[], ref: { submission_id?: string; review_id?: string }, good: (v: T) => boolean = () => true, onText?: (soFar: string) => void): Promise<T | null> {
  const key = Deno.env.get('OPENAI_API_KEY')
  if (!key || !(await underBudget())) return null
  const [model, price] = purpose === 'transcribe' ? [MODEL, PRICE] : [CHECK_MODEL, CHECK_PRICE]
  try {
    const o = { key, model, text, images, schema, maxOutput: MAX_OUTPUT, reasoning: Deno.env.get('OPENAI_REASONING') || undefined }
    const { value, usage } = onText ? await respondStream<T>(o, onText) : await respond<T>(o)
    await sb.from('model_calls').insert({ purpose, model, input_tokens: usage.input, output_tokens: usage.output, cost_usd: costOf(usage, price) ?? null, ok: good(value), ...ref })
    return value
  } catch (e) {
    console.warn(`${purpose}: ${(e as Error).message}`)
    return null
  }
}

/**
 * The model's reading of the photos, PDFs and/or text, with its verdict: whether it goes up as it is, and what the
 * sender should do when it can't (nothing to read is a retry too). Null when no model could be asked (no key, over
 * budget, failed). `onBody`: the body so far, as the model writes it, for a sender watching.
 */
async function transcribe(id: string, c: Parameters<typeof prompt>[0], files: Image[], onBody?: (soFar: string) => void): Promise<{ body: string; unsure: string; publish: boolean; retry: string } | null> {
  if (!files.length && !c.note) return null
  const onText = onBody && ((json: string) => {
    const body = partialString(json, 'body')
    if (body) onBody(body)
  })
  const got = await ask<Transcription>('transcribe', prompt(c, true), TRANSCRIPTION, files, { submission_id: id }, (t) => t.readable && !!t.body.trim(), onText)
  if (!got) return null
  const body = got.readable ? cleanBody(got.body) : ''
  return { body, unsure: got.unsure.trim(), publish: !!body && got.verdict === 'publish', retry: got.retry.trim() }
}

const WHAT: Record<Transcribable, string> = { menu: 'a menu', prices: 'a price list', hours: 'opening hours' }

/** A response written as it happens: one JSON event a line (application/x-ndjson). Keeps going if the sender leaves, so the row is still saved. */
function streamed(work: (send: (event: Record<string, unknown>) => void) => Promise<void>): Response {
  const enc = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        try {
          controller.enqueue(enc.encode(JSON.stringify(event) + '\n'))
        } catch {
          // the sender has gone: finish anyway
        }
      }
      try {
        await work(send)
      } catch (e) {
        send({ type: 'error', error: (e as Error).message })
      }
      try {
        controller.close()
      } catch {
        // already closed
      }
    },
  })
  return new Response(stream, { headers: { ...cors, 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' } })
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
  const v = await ask<Verdict>('vet_photo', text, VERDICT, [photo], { submission_id: id })
  return v && { ok: v.ok, reason: v.reason.slice(0, 300), alt: v.alt.slice(0, 200) }
}

/** Starts the photos Action, which publishes what's queued (photos and menus), through the database (migration 0031); pg_cron's hourly start catches anything this misses. */
async function dispatchPublish() {
  const { error } = await sb.rpc('dispatch_workflow', { workflow: 'photos.yml' })
  if (error) console.warn(`dispatch: ${error.message}`)
}

/**
 * A member's photo of the venue: up within minutes when a model passes it and no other member's photo of the venue
 * went up in the last day, else queued for a person. Their own photos don't count: a second of the same venue goes up.
 */
async function photoOf(id: string, venue: Venue, sender: { id: string }, photo: Image): Promise<Response> {
  const day = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  // Two members swapping a venue's photo back and forth: the second waits for a person
  const { count: others } = await sb.from('submissions').select('*', { count: 'exact', head: true }).eq('venue_id', venue.id).eq('kind', 'photo').in('status', ['queued', 'approved']).neq('user_id', sender.id).gte('created_at', day)
  const waitFor = (others ?? 0) > 0 ? 'this venue had a new photo today' : null
  const verdict = await vet(id, venue, photo)
  const patch = { alt: verdict?.alt || null, ...(verdict ? { transcribed_by: 'openai', model: CHECK_MODEL } : {}) }
  if (verdict?.ok && !waitFor) {
    await sb.from('submissions').update({ ...patch, status: 'queued' }).eq('id', id)
    await dispatchPublish()
    return json({ id, status: 'queued', transcription: null })
  }
  const reason = verdict && !verdict.ok ? verdict.reason : waitFor
  await sb.from('submissions').update({ ...patch, status: 'needs_review', review_note: reason }).eq('id', id)
  return json({ id, status: 'needs_review', transcription: null, reason })
}

/** The signed-in sender behind the request's bearer token, when it's a user's (not the anon key) and a University address. */
async function senderOf(req: Request): Promise<{ id: string; email: string; name: string } | { error: string }> {
  const jwt = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!jwt || jwt === Deno.env.get('SUPABASE_ANON_KEY')) return { error: 'sign in with your Cambridge account to send things in' }
  const { data, error } = await sb.auth.getUser(jwt)
  if (error || !data.user) return { error: 'your sign-in has expired; sign in again' }
  const email = data.user.email ?? ''
  if (!/@cam\.ac\.uk$/i.test(email)) return { error: 'only University of Cambridge accounts (@cam.ac.uk) can send things in' }
  // What everything they send goes up under: Google's display name for the account, else their CRSid, as the app
  // reads it too (creditName() in src/lib/auth.ts)
  const meta = data.user.user_metadata ?? {}
  const name = String(meta.full_name ?? meta.name ?? '').trim().slice(0, 80) || email.split('@')[0]
  return { id: data.user.id, email, name }
}

async function venueOf(id: string): Promise<Venue | null> {
  const { data } = await sb.from('venues').select('id, slug, name, type, site, sites(name, short_name)').eq('id', id).maybeSingle()
  return (data as Venue | null) ?? null
}

/**
 * A sender confirming (possibly edited) text. A menu goes up without a person when the venue's menu isn't a script's
 * (`queued`: the photos Action checks it reads and is for a sensible day, and publishes it); anything else joins the
 * review queue. `wrong`: the sender says the reading is wrong and leaves it to a person, with the photo. Only while
 * the row is fresh and unreviewed.
 */
async function confirm(sender: { id: string }, body: { id?: string; transcription?: string; wrong?: boolean }): Promise<Response> {
  if (!body.id || typeof body.transcription !== 'string') return fail('id and transcription needed')
  const { data: row } = await sb.from('submissions').select('id, kind, venue_id, status, transcription, photo_path, photo_paths, created_at, user_id').eq('id', body.id).maybeSingle()
  if (!row || row.user_id !== sender.id) return fail('no such submission', 404)
  if (!['received', 'transcribed'].includes(row.status)) return fail('already reviewed', 409)
  if (Date.now() - new Date(row.created_at).getTime() > 24 * 3600 * 1000) return fail('too late to change', 409)
  if (body.wrong) {
    await sb.from('submissions').update({ status: 'needs_review', review_note: 'the sender says the reading is wrong' }).eq('id', body.id)
    return json({ id: body.id, status: 'needs_review' })
  }
  const text = body.transcription.trim()
  if (text.length > 20000) return fail('transcription too long (20,000 characters at most); split it into separate submissions')
  if (!text.includes('\n---\n')) return fail('the text needs its header and a --- line')
  const edited = text !== (row.transcription ?? '').trim()
  const hold = await holdOf(row, text, edited)
  const status = hold === null ? 'queued' : 'needs_review'
  await sb.from('submissions').update({ transcription: text, status, review_note: hold || null, ...(edited ? { transcribed_by: 'sender' } : {}) }).eq('id', body.id)
  if (status === 'queued') await dispatchPublish()
  return json({ id: body.id, status, reason: hold || null })
}

/**
 * Why a member's confirmed reading waits for a person, or null when it can go up without one; '' when it simply isn't
 * a kind that does (AUTO_KINDS). A menu: menuWait(). A price list or hours: a reading of a photo the sender changed
 * still says what the photo does.
 */
async function holdOf(row: { id: string; kind: Kind; venue_id: string; photo_path: string | null; photo_paths: string[] | null }, text: string, edited: boolean): Promise<string | null> {
  if (!AUTO_KINDS.includes(row.kind)) return ''
  if (row.kind === 'menu') return menuWait(row.venue_id)
  if (row.kind !== 'prices' && row.kind !== 'hours') return ''
  if (!edited || !row.photo_path) return null
  const venue = await venueOf(row.venue_id)
  const check = venue && (await checkReading(row.id, row.kind, venue, row.photo_paths ?? [row.photo_path], text))
  return !check ? 'no model could check your changes' : check.ok ? null : check.reason.slice(0, 300) || 'your changes don’t match the photo'
}

/** Whether a reading the sender changed still says what their photo does; null when no model could look. */
async function checkReading(id: string, kind: 'prices' | 'hours', venue: Venue, paths: string[], text: string): Promise<ReviewCheck | null> {
  const images: Image[] = []
  for (const path of paths) {
    const { data: file } = await sb.storage.from('submissions').download(path)
    if (!file) return null
    images.push({ base64: base64(new Uint8Array(await file.arrayBuffer())), mime: file.type || 'image/jpeg' })
  }
  const current = await currentText(kind, venue.id)
  const what = kind === 'prices' ? 'price list' : 'opening hours'
  const where = venue.sites?.short_name ?? venue.sites?.name ?? venue.site
  const lines = [
    `A member photographed the ${what} at ${venue.name}${images.length > 1 ? ` (${images.length} photos)` : ''}, a ${{ hall: 'dining hall', cafe: 'café', bar: 'bar' }[venue.type]} at ${where}, a model read it into the text below, and the member then changed that text. It will go on the venue's page without anyone else looking.`,
    `It can (ok: true) when every price, time and item in it is as the photo shows, or is from the list the site had before (when one is given below). Leaving things out, fixing spelling or capitals, and reordering are fine. Not (ok: false) when a price, a time or an item differs from the photo, or is neither on the photo nor in the earlier list; then say which line, in one short sentence to the member. A "columns: first | second" line names whose each price column is: it's fine when it says what the board's column headings do (a column headed only "£" is "Full price"), not when it swaps them or names columns the board doesn't.`,
    `The text:\n"""\n${text.split('\n---\n')[1] ?? text}\n"""`,
  ]
  if (current) lines.push(`The list the site had before:\n"""\n${current}\n"""`)
  return ask<ReviewCheck>('check_reading', lines.join('\n\n'), REVIEW_CHECK, images, { submission_id: id })
}

const DIET_CODE: Record<string, string> = { vegan: 'VE', vegetarian: 'V', plant_based: 'PB', halal: 'H', gluten_free: 'GF', dairy_free: 'DF', kosher: 'kosher', pescatarian: 'pescatarian' }
const gbp = (n: number | string | null) => (n == null ? '' : `£${Number(n).toFixed(2)}`)
/** Fields joined as a line of the format, empty trailing ones dropped (down to `keep`). */
const fields = (f: string[], keep: number) => {
  while (f.length > keep && !f.at(-1)) f.pop()
  return f.join(' | ')
}

/** What the site lists now for a venue's prices or hours, in the format a reading comes back in; null when nothing. */
async function currentText(kind: 'prices' | 'hours', venueId: string): Promise<string | null> {
  if (kind === 'hours') {
    const { data } = await sb.from('service_slots').select('meal, days, start_time, end_time, period, note').eq('venue_id', venueId).order('meal')
    if (!data?.length) return null
    return data.map((s) => fields([s.meal, (s.days as string[]).map((d) => d[0].toUpperCase() + d.slice(1)).join(', '), `${String(s.start_time).slice(0, 5)}-${String(s.end_time).slice(0, 5)}`, s.period, s.note ?? ''], 4)).join('\n')
  }
  const { data } = await sb.from('venue_prices').select('section, name, description, price_gbp, price_max_gbp, non_member_gbp, services, course, tags').eq('venue_id', venueId).order('position')
  if (!data?.length) return null
  const { data: v } = await sb.from('venues').select('price_terms').eq('id', venueId).maybeSingle()
  const tiers = (v?.price_terms as { tiers?: string[] } | null)?.tiers
  const lines: string[] = tiers?.length && data.some((p) => p.non_member_gbp != null) ? [`columns: ${tiers.join(' | ')}`] : []
  let heading: string | undefined
  for (const p of data) {
    const head = p.section ? `## ${p.section}${p.services?.length ? ` | ${p.services.join(', ')}` : ''}` : undefined
    if (head && head !== heading) lines.push(head)
    heading = head
    const tags = ((p.tags ?? []) as string[]).filter((t) => !(t === 'vegetarian' && p.tags.includes('vegan'))).map((t) => DIET_CODE[t]).filter(Boolean)
    const price = p.price_max_gbp != null ? `${gbp(p.price_gbp)}-${gbp(p.price_max_gbp)}` : gbp(p.price_gbp)
    lines.push(fields([tags.length ? `${p.name} (${tags.join(', ')})` : p.name, price, gbp(p.non_member_gbp), p.course ?? '', p.description ?? ''], 2))
  }
  return lines.join('\n')
}

/** Why a member's menu for this venue waits for a person, or null when it can go up: no script fetches the venue's. */
async function menuWait(venueId: string): Promise<string | null> {
  const { data: v } = await sb.from('venues').select('menu_scripted').eq('id', venueId).maybeSingle()
  if (!v) return 'no such venue'
  return v.menu_scripted ? 'this venue’s menu is read from its own website' : null
}

/**
 * Whether a review's words can be shown: OpenAI's moderation flags nothing, and the small model finds them about the
 * venue, naming or attacking no one. Null when no model could look (no key, over budget, failed): the review waits.
 */
async function checkReview(id: string, venue: Venue, rating: number, text: string): Promise<ReviewCheck | null> {
  const key = Deno.env.get('OPENAI_API_KEY')
  if (!key) return null
  try {
    const flagged = await moderate(key, text)
    if (flagged.length) return { ok: false, reason: `moderation flagged it: ${flagged.join(', ')}` }
  } catch (e) {
    console.warn(`review moderation: ${(e as Error).message}`)
    return null
  }
  const where = venue.sites?.short_name ?? venue.sites?.name ?? venue.site
  const prompt = [
    `A member of the University of Cambridge wrote this review of ${venue.name}, a ${{ hall: 'dining hall', cafe: 'café', bar: 'bar' }[venue.type]} at ${where}, rating it ${rating} out of 5. It will be shown on the venue's page without their name.`,
    `It can be shown (ok: true) when it is about the venue: its food, drink, prices, service, queues, space or hours, praise or criticism, however blunt. Not when it names, describes or attacks a particular person (staff or anyone else), gives anyone's personal details, advertises something, is about something else entirely, or is gibberish.`,
    `The review:\n"""\n${text}\n"""`,
  ].join('\n\n')
  return ask<ReviewCheck>('review', prompt, REVIEW_CHECK, [], { review_id: id })
}

/**
 * A member's review of a venue: written, changed or (`remove`) taken back. A rating alone is published; words are
 * published when checkReview() passes them, and wait for a person otherwise. One a person hid stays hidden.
 */
async function review(sender: { id: string }, body: { venue?: string; rating?: number; body?: string; remove?: boolean }): Promise<Response> {
  const venue = body.venue ? await venueOf(body.venue) : null
  if (!venue) return fail('no such venue', 404)
  if (body.remove) {
    await sb.from('reviews').delete().eq('venue_id', venue.id).eq('user_id', sender.id)
    return json({ status: 'removed' })
  }
  const rating = Number(body.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail('a rating from 1 to 5')
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 1000) || null : null
  const day = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { count } = await sb.from('reviews').select('*', { count: 'exact', head: true }).eq('user_id', sender.id).gte('updated_at', day)
  const { data: before } = await sb.from('reviews').select('id, status, body').eq('venue_id', venue.id).eq('user_id', sender.id).maybeSingle()
  if (!before && (count ?? 0) >= REVIEWS_PER_DAY) return fail('that is plenty of reviews for one day; thank you', 429)
  // Words already passed stay passed; new words wait until they're checked
  const unchanged = !!before && before.status === 'published' && (before.body ?? null) === text
  const status = before?.status === 'hidden' ? 'hidden' : !text || unchanged ? 'published' : 'needs_review'
  const { data: row, error } = await sb
    .from('reviews')
    .upsert({ venue_id: venue.id, user_id: sender.id, rating, body: text, status, review_note: null, updated_at: new Date().toISOString() }, { onConflict: 'venue_id,user_id' })
    .select('id')
    .single()
  if (error) return fail(error.message, 500)
  if (status !== 'needs_review') return json({ id: row.id, status })
  const check = await checkReview(row.id, venue, rating, text!)
  const next = check?.ok ? 'published' : 'needs_review'
  const note = check ? (check.ok ? null : check.reason.slice(0, 300) || 'the check held it back') : 'no model could check it'
  await sb.from('reviews').update({ status: next, review_note: note }).eq('id', row.id)
  return json({ id: row.id, status: next })
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
    if (body.action === 'confirm' || body.action === 'review') {
      const sender = await senderOf(req)
      if ('error' in sender) return fail(sender.error, 401)
      return body.action === 'confirm' ? confirm(sender, body) : review(sender, body)
    }
    return fail('a photo or text goes as multipart/form-data; JSON is for confirming, reviews, or contributors')
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
  const topic = kind === 'other' ? field('topic') || null : null
  if (topic && !TOPICS.includes(topic)) return fail('unknown topic')
  const note = field('note') || null
  if (note && note.length > 20000) return fail('text too long (20,000 characters at most); send a photo or split it into separate submissions')
  const photos = form.getAll('photo').filter((f): f is File => f instanceof File && f.size > 0)
  if (!photos.length && !note) return fail('send a photo or some text')
  if (photos.length > (kind === 'photo' ? 1 : MAX_PHOTOS)) return fail(kind === 'photo' ? 'one photo of the venue at a time' : `${MAX_PHOTOS} photos at most`, 413)
  if (photos.some((p) => p.size > (p.type === 'application/pdf' ? MAX_PDF : MAX_PHOTO))) return fail('a file is too big (5 MB a photo, 10 MB a PDF)', 413)
  if (photos.some((p) => !/^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/.test(p.type))) return fail('send photos as JPEG, PNG, WebP or HEIC, documents as PDF')
  if (kind === 'photo' && !photos.length) return fail('add the photo')
  // The photos Action can't read HEIC (the page converts it to JPEG where the browser can)
  if (kind === 'photo' && !/^image\/(jpeg|png|webp)$/.test(photos[0].type)) return fail('send the photo as a JPEG, PNG or WebP')

  // Kept with the row, hashed, for spotting one machine behind several accounts
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? req.headers.get('cf-connecting-ip') ?? ''
  const ipHash = ip ? await sha256(ip + (Deno.env.get('IP_SALT') ?? '')) : null

  const { data: row, error } = await sb.from('submissions').insert({ venue_id: venue.id, kind, date, service, topic, note, user_id: sender.id, user_email: sender.email, contact: sender.email, ip_hash: ipHash, credit: sender.name }).select('id').single()
  if (error) return fail(error.message, 500)
  const id: string = row.id

  // Each photo in the bucket as <id>.jpg, <id>-2.jpg, …, in the order sent
  const images: Image[] = []
  const paths: string[] = []
  for (const [n, photo] of photos.entries()) {
    const bytes = new Uint8Array(await photo.arrayBuffer())
    const path = `${id}${n ? `-${n + 1}` : ''}.${photo.type.split('/')[1].replace('jpeg', 'jpg')}`
    const up = await sb.storage.from('submissions').upload(path, bytes, { contentType: photo.type, upsert: false })
    if (up.error) console.warn(`upload ${path}: ${up.error.message}`)
    else paths.push(path)
    images.push({ base64: base64(bytes), mime: photo.type, name: photo.name })
  }
  const stored = paths.length > 0 && !(await sb.from('submissions').update({ photo_path: paths[0], photo_paths: paths }).eq('id', id)).error

  if (kind === 'photo' && !stored) return fail('the photo did not save; try again', 500)
  if (kind === 'photo') return photoOf(id, venue, sender, images[0])
  if (!['menu', 'prices', 'hours'].includes(kind)) return json({ id, status: 'received', transcription: null })
  const t = kind as Transcribable
  const siteName = venue.sites?.short_name ?? venue.sites?.name ?? venue.site
  const current = t === 'menu' ? null : await currentText(t, venue.id)
  const context = { kind: t, venue: { name: venue.name, type: venue.type, site: siteName }, date: date ?? undefined, service: service ?? undefined, asBoard: t === 'menu' && field('as_board') === '1', today: today(), note: note ?? undefined, current: current ?? undefined, photos: images.length }
  // auto=1 (the page since 13 Oct 2026): the model's verdict decides, with no reading for the sender to confirm
  const auto = field('auto') === '1'
  // The reading, saved with the row; what the sender gets back
  const finish = async (got: Awaited<ReturnType<typeof transcribe>>) => {
    const sent = images.length ? `${images.length > 1 ? `${images.length} files` : images[0].mime === 'application/pdf' ? 'PDF' : 'photo'}${note ? ' and a note' : ''}` : 'text'
    const text = got?.body ? header(t, { site: venue.site, venue: venue.slug, source: `submission ${id}: ${sent} sent from the venue's page on grub.cam`, observed: today() }) + got.body + '\n' : null
    const read = { transcription: text, transcribed_by: 'openai', model: MODEL, unsure: got?.unsure || null }
    // No model could look: it waits for a person, as before
    if (!got || (!auto && !text)) return { id, status: 'received', transcription: null, spec: BODY_SPEC[t] }
    if (!auto) {
      await sb.from('submissions').update({ ...read, status: 'transcribed' }).eq('id', id)
      return { id, status: 'transcribed', transcription: text, by: 'openai', unsure: got.unsure || null }
    }
    // Not something to put up: back to the sender, saying what to send instead
    if (!got.publish || !text) {
      const reason = got.retry.slice(0, 300) || `That doesn't read as ${WHAT[t]}: try a clearer photo of the whole board.`
      await sb.from('submissions').update({ ...read, status: 'rejected', review_note: `the model asked for another try: ${reason}` }).eq('id', id)
      return { id, status: 'rejected', transcription: null, reason }
    }
    // Up within minutes, unless something says a person should look (a script's venue)
    const hold = await holdOf({ id, kind: t, venue_id: venue.id, photo_path: paths[0] ?? null, photo_paths: paths }, text, false)
    const status = hold === null ? 'queued' : 'needs_review'
    await sb.from('submissions').update({ ...read, status, review_note: hold || null }).eq('id', id)
    if (status === 'queued') await dispatchPublish()
    return { id, status, transcription: text, reason: hold || null }
  }
  // stream=1: the reading as it's written, so the sender can watch it, then the same answer as without
  if (field('stream') === '1')
    return streamed(async (send) => {
      send({ type: 'reading', id, photos: images.length })
      let sent = 0
      const got = await transcribe(id, context, images, (body) => {
        // A line at a time, or every so often within a long one
        if (body.length - sent < 40 && !body.endsWith('\n')) return
        sent = body.length
        send({ type: 'text', body })
      })
      send({ type: 'done', result: await finish(got) })
    })
  return json(await finish(await transcribe(id, context, images)))
})
