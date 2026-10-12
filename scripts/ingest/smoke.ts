// npm run submissions -- smoke [--venue clare/buttery] [--photo venue.jpg] [--review]
// Sends something in as a member would, through the deployed `submit` function, without Microsoft: a throwaway
// @cam.ac.uk account made through the admin API (no email is sent), signed in with a magic-link token it never mails,
// then a typed menu (read by the model when OPENAI_API_KEY is set, then marked wrong so nothing is published),
// optionally a photo of the venue (the model's verdict, then rejected at once, before the photos Action could take it)
// and a review (checked, then taken back). Everything it made is deleted at the end, the model calls' log aside.
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'

type Answer = { status?: string; error?: string; transcription?: string | null; unsure?: string | null; reason?: string | null; id?: string }

export async function smoke(o: { venue: string; photo?: string; review?: boolean }) {
  const url = process.env.VITE_SUPABASE_URL, secret = process.env.SUPABASE_SECRET_KEY, publishable = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !secret || !publishable) throw new Error('needs VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY')
  const admin = createClient(url, secret, { auth: { persistSession: false } })
  const email = `grub-smoke-${randomBytes(4).toString('hex')}@cam.ac.uk`
  const { data: made, error: makeError } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: 'Smoke Test' } })
  if (makeError) throw new Error(`create user: ${makeError.message}`)
  const userId = made.user.id
  let failed = 0
  const check = (ok: boolean, what: string) => {
    if (!ok) failed++
    console.log(`${ok ? '✓' : '✗'} ${what}`)
  }
  try {
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    if (linkError) throw new Error(`magic link: ${linkError.message}`)
    const member = createClient(url, publishable, { auth: { persistSession: false } })
    const { data: signedIn, error: otpError } = await member.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' })
    if (otpError || !signedIn.session) throw new Error(`sign in: ${otpError?.message ?? 'no session'}`)
    const token = signedIn.session.access_token
    console.log(`signed in as ${email}`)

    const call = async (body: FormData | object): Promise<Answer> => {
      const form = body instanceof FormData
      const res = await fetch(`${url}/functions/v1/submit`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, apikey: publishable, ...(form ? {} : { 'content-type': 'application/json' }) },
        body: form ? body : JSON.stringify(body),
      })
      return (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as Answer
    }

    // Signed out: refused
    const anon = await fetch(`${url}/functions/v1/submit`, { method: 'POST', headers: { apikey: publishable }, body: new FormData() })
    check(anon.status === 401, `no sign-in is refused (${anon.status})`)

    // A typed menu
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date())
    const menu = new FormData()
    for (const [k, v] of Object.entries({ venue: o.venue, kind: 'menu', date: today, service: 'lunch', note: 'Lunch\nRoast chicken, gravy (GF) £4.20\nMushroom risotto (V) £3.80\nApple crumble and custard £1.60' })) menu.set(k, v)
    const t0 = Date.now()
    const sent = await call(menu)
    check(!sent.error && !!sent.id, `menu sent: ${sent.error ?? sent.status} (${((Date.now() - t0) / 1000).toFixed(1)} s)`)
    if (sent.status === 'transcribed') {
      console.log(sent.transcription?.replace(/^/gm, '    '))
      if (sent.unsure) console.log(`    unsure: ${sent.unsure}`)
      const flagged = await call({ action: 'confirm', id: sent.id, transcription: sent.transcription, wrong: true })
      check(flagged.status === 'needs_review', `marked wrong, so it waits for a person: ${flagged.error ?? flagged.status}`)
    } else if (sent.status === 'received') console.log('    no model read it (no OPENAI_API_KEY, the OpenAI budget spent, or the call failed: see the function’s logs)')

    // A photo of the venue: the model's verdict, then rejected before anything could publish it
    if (o.photo) {
      const photo = new FormData()
      photo.set('venue', o.venue)
      photo.set('kind', 'photo')
      photo.set('photo', new Blob([readFileSync(o.photo)], { type: o.photo.endsWith('.png') ? 'image/png' : o.photo.endsWith('.webp') ? 'image/webp' : 'image/jpeg' }), 'photo.jpg')
      const t1 = Date.now()
      const vetted = await call(photo)
      if (vetted.id) await admin.from('submissions').update({ status: 'rejected', review_note: 'smoke test' }).eq('id', vetted.id)
      check(!vetted.error, `photo sent: ${vetted.error ?? vetted.status}${vetted.reason ? `: ${vetted.reason}` : ''} (${((Date.now() - t1) / 1000).toFixed(1)} s)`)
      const { data: row } = vetted.id ? await admin.from('submissions').select('alt, credit').eq('id', vetted.id).single() : { data: null }
      if (row) console.log(`    alt: ${row.alt ?? '(none)'}; credit: ${row.credit ?? '(none)'}`)
    }

    // A review with words, then taken back
    if (o.review) {
      const written = await call({ action: 'review', venue: o.venue, rating: 4, body: 'Good value lunches and the queue moves quickly. The crumble is worth saving room for.' })
      check(['published', 'needs_review'].includes(written.status ?? ''), `review saved: ${written.error ?? written.status}`)
      const removed = await call({ action: 'review', venue: o.venue, remove: true })
      check(removed.status === 'removed', `review taken back: ${removed.error ?? removed.status}`)
    }
  } finally {
    const { data: rows } = await admin.from('submissions').select('id, photo_path').eq('user_id', userId)
    const photos = (rows ?? []).flatMap((r) => (r.photo_path ? [r.photo_path as string] : []))
    if (photos.length) await admin.storage.from('submissions').remove(photos)
    await admin.from('submissions').delete().eq('user_id', userId)
    await admin.auth.admin.deleteUser(userId)
    console.log(`removed ${email}, its ${rows?.length ?? 0} submissions and their photos`)
  }
  if (failed) process.exitCode = 1
}
