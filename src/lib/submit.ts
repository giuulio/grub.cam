// Sending what someone sees in a venue to the `submit` Edge Function: a photo (shrunk here first, so it uploads fast
// and costs the model little) and/or text, then confirming the transcription it comes back with.

export type SubmitKind = 'menu' | 'prices' | 'hours' | 'photo' | 'other'
/** `queued`: a member's photo that passed its check, going up within minutes; `reason`: why one waits for a person instead; `unsure`: what the model couldn't read. */
export type SubmitResult = { id: string; status: 'received' | 'transcribed' | 'needs_review' | 'queued'; transcription: string | null; by?: 'openai'; spec?: string; reason?: string | null; unsure?: string | null }

const URL_ = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit`
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string
const MAX_SIDE = 1600

/**
 * The photo as a JPEG no wider or taller than `maxSide` (1600 px keeps a board legible; a venue's photo is sent at
 * 2400, as it becomes a page's banner). Metadata, GPS included, is dropped.
 */
export async function shrink(file: File, maxSide = MAX_SIDE): Promise<File> {
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

export function send(token: string, fields: { venue: string; kind: SubmitKind; date?: string; service?: string; note?: string; website?: string }, photo?: File): Promise<SubmitResult> {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) if (v) form.set(k, v)
  if (photo) form.set('photo', photo, photo.name)
  return call(token, { method: 'POST', body: form })
}

/** A review's status once saved: published, waiting for a person to read its words, hidden by one, or taken back. */
export type ReviewStatus = 'published' | 'needs_review' | 'hidden' | 'removed'

/** Writes, changes or (`remove`) takes back your review of a venue. */
export async function saveReview(token: string, review: { venue: string; rating?: number; body?: string; remove?: boolean }): Promise<ReviewStatus> {
  const r = (await call(token, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'review', ...review }) })) as unknown as { status: ReviewStatus }
  return r.status
}

/** Confirms the text as read (or as the sender fixed it); `wrong`: the reading is wrong, and a person reads the photo instead. */
export function confirm(token: string, id: string, transcription: string, wrong = false): Promise<SubmitResult> {
  return call(token, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'confirm', id, transcription, ...(wrong ? { wrong } : {}) }) })
}
