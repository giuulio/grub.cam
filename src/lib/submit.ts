// Sending what someone sees in a venue to the `submit` Edge Function: photos (shrunk here first, so they upload fast
// and cost the model little) or PDFs, and/or text. The model reads them there and then, and its verdict decides.

export type SubmitKind = 'menu' | 'prices' | 'hours' | 'photo' | 'other'
/** What a correction (kind `other`) is about, so the queue can say it. */
export type Topic = 'hours' | 'prices' | 'menu' | 'formal' | 'diet' | 'location' | 'closed' | 'other'
/**
 * `queued`: going up within minutes; `needs_review`: a person looks first (`reason` says why); `rejected`: the model
 * couldn't use it, and `reason` says what to send instead; `received`: no model could read it, so a person will.
 */
export type SubmitResult = { id: string; status: 'received' | 'transcribed' | 'needs_review' | 'queued' | 'rejected'; transcription: string | null; by?: 'openai'; spec?: string; reason?: string | null; unsure?: string | null }

/** At most this many photos or PDFs of a board go together (a photo of the venue is one). */
export const MAX_PHOTOS = 10

// VITE_SUBMIT_FUNCTION: another deployment of the function to try a change against (`submit-next`), from .env.development.local
const URL_ = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${import.meta.env.VITE_SUBMIT_FUNCTION || 'submit'}`
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string
const MAX_SIDE = 1600

/**
 * The photo as a JPEG no wider or taller than `maxSide` (1600 px keeps a board legible; a venue's photo is sent at
 * 2400, as it becomes a page's banner). Metadata, GPS included, is dropped.
 */
export async function shrink(file: File, maxSide = MAX_SIDE): Promise<File> {
  if (!file.type.startsWith('image/')) return file // a PDF goes as it is
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.82))
    if (!blob) return file
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file // a format the browser can't draw (HEIC outside Safari): sent as it is
  }
}

/** `token`: the signed-in sender's access token; the function needs a Cambridge account behind every submission. */
async function call(token: string, init: RequestInit): Promise<SubmitResult> {
  const res = await fetch(URL_, { ...init, headers: { authorization: `Bearer ${token}`, apikey: KEY, ...(init.headers ?? {}) } })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? `Something went wrong (${res.status})`)
  return body as SubmitResult
}

/**
 * Sends the photos and/or text. A menu, price list or hours is read by the model there and then: `onText` gets the
 * reading so far as it's written (the function streams it, a JSON event a line), and the answer is its verdict.
 * `asBoard`: a menu's days and meals are the board's, `date` and `service` only where it doesn't say. `site` in place of
 * `venue`: a photo of the site itself, for its page's banner.
 */
export async function send(
  token: string,
  fields: { venue?: string; site?: string; kind: SubmitKind; date?: string; service?: string; asBoard?: boolean; topic?: Topic; note?: string; website?: string },
  photos: File[],
  onText?: (soFar: string) => void,
): Promise<SubmitResult> {
  const form = new FormData()
  const { asBoard, ...rest } = fields
  for (const [k, v] of Object.entries(rest)) if (v) form.set(k, v)
  if (asBoard) form.set('as_board', '1')
  for (const p of photos) form.append('photo', p, p.name)
  if (['menu', 'prices', 'hours'].includes(fields.kind)) {
    form.set('stream', '1')
    form.set('auto', '1')
  }
  const res = await fetch(URL_, { method: 'POST', body: form, headers: { authorization: `Bearer ${token}`, apikey: KEY } })
  if (!res.ok || !res.headers.get('content-type')?.includes('ndjson') || !res.body) {
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error ?? `Something went wrong (${res.status})`)
    return body as SubmitResult
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (value) buffer += value
    let cut: number
    while ((cut = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, cut).trim()
      buffer = buffer.slice(cut + 1)
      if (!line) continue
      const event = JSON.parse(line) as { type: string; body?: string; result?: SubmitResult; error?: string }
      if (event.type === 'text' && event.body) onText?.(event.body)
      else if (event.type === 'done' && event.result) return event.result
      else if (event.type === 'error') throw new Error(event.error ?? 'Something went wrong reading it')
    }
    if (done) throw new Error('The connection dropped before the reading finished; it is saved, and a person will read it.')
  }
}

/** A review's status once saved: published, waiting for a person to read its words, hidden by one, or taken back. */
export type ReviewStatus = 'published' | 'needs_review' | 'hidden' | 'removed'

/** Writes, changes or (`remove`) takes back your review of a venue. */
export async function saveReview(token: string, review: { venue: string; rating?: number; body?: string; remove?: boolean }): Promise<ReviewStatus> {
  const r = (await call(token, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'review', ...review }) })) as unknown as { status: ReviewStatus }
  return r.status
}
