// Sending what someone sees in a venue to the `submit` Edge Function: a photo (shrunk here first, so it uploads fast
// and costs the model little) and/or text, then confirming the transcription it comes back with.

export type SubmitKind = 'menu' | 'prices' | 'hours' | 'photo' | 'other'
export type SubmitResult = { id: string; status: 'received' | 'transcribed' | 'needs_review'; transcription: string | null; by?: 'openai' | 'gemini'; spec?: string }

const URL_ = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit`
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string
const MAX_SIDE = 1600

/** The photo as a JPEG no wider or taller than 1600 px (a board stays legible; metadata, GPS included, is dropped). */
export async function shrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
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

async function call(init: RequestInit): Promise<SubmitResult> {
  const res = await fetch(URL_, { ...init, headers: { authorization: `Bearer ${KEY}`, apikey: KEY, ...(init.headers ?? {}) } })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? `Something went wrong (${res.status})`)
  return body as SubmitResult
}

export function send(fields: { venue: string; kind: SubmitKind; date?: string; service?: string; note?: string; contact?: string; website?: string }, photo?: File): Promise<SubmitResult> {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) if (v) form.set(k, v)
  if (photo) form.set('photo', photo, photo.name)
  return call({ method: 'POST', body: form })
}

export function confirm(id: string, transcription: string): Promise<SubmitResult> {
  return call({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'confirm', id, transcription }) })
}
