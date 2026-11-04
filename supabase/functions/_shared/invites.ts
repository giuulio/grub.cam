/** Invited uploads are menu evidence only. Keep this independent of the signed-in publication path. */
export const INVITE_MAX_FILES = 4
export const INVITE_MAX_BYTES = 10 * 1024 * 1024
/** Bound the body even when the client omits Content-Length. Includes room for multipart headers and a note. */
export async function invitationForm(req: Request): Promise<FormData> {
  const reader = req.body?.getReader()
  if (!reader) throw new Error('No upload body')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > INVITE_MAX_BYTES + 1024 * 1024) { await reader.cancel(); throw new Error('Upload body exceeds 11 MB') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return new Response(bytes, { headers: { 'content-type': req.headers.get('content-type') ?? '' } }).formData()
}
export function inviteToken(fragment: string): string | null {
  const token = new URLSearchParams(fragment.replace(/^#/, '')).get('invite')
  return token && /^[0-9a-f]{64}$/.test(token) ? token : null
}
export function invitedUploadError(kind: string, files: { size: number; type: string }[]): string | null {
  if (kind !== 'menu') return 'This invitation is for menu photos only.'
  if (!files.length) return 'Add a photo or PDF of the menu.'
  if (files.length > INVITE_MAX_FILES) return `${INVITE_MAX_FILES} files at most with this invitation.`
  if (files.some((f) => !/^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/.test(f.type))) return 'Send menu photos or PDFs.'
  if (files.some((f) => f.size > (f.type === 'application/pdf' ? INVITE_MAX_BYTES : 5 * 1024 * 1024)) || files.reduce((s, f) => s + f.size, 0) > INVITE_MAX_BYTES) return '10 MB in total at most (5 MB per photo).'
  return null
}
