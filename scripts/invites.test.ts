import { describe, expect, it } from 'vitest'
import { invitedUploadError, inviteToken, invitationForm } from '../supabase/functions/_shared/invites.ts'
describe('menu upload invitations', () => {
  const photo = { type: 'image/jpeg', size: 100 }
  it('accepts only a well-formed fragment token', () => {
    expect(inviteToken(`#invite=${'a'.repeat(64)}`)).toBe('a'.repeat(64))
    expect(inviteToken('#invite=bad')).toBeNull()
  })
  it('requires menu evidence and bounds file count, type and aggregate size', () => {
    expect(invitedUploadError('menu', [photo])).toBeNull()
    expect(invitedUploadError('photo', [photo])).toMatch(/menu photos only/)
    expect(invitedUploadError('menu', [])).toMatch(/Add a photo/)
    expect(invitedUploadError('menu', Array(5).fill(photo))).toMatch(/4 files/)
    expect(invitedUploadError('menu', [{ type: 'text/html', size: 100 }])).toMatch(/photos or PDFs/)
    expect(invitedUploadError('menu', Array(3).fill({ ...photo, size: 4 * 1024 * 1024 }))).toMatch(/10 MB/)
  })
  it('bounds uploads without relying on a client-supplied Content-Length', async () => {
    const req = new Request('https://example.invalid', { method: 'POST', body: new Uint8Array(12 * 1024 * 1024), headers: { 'content-type': 'multipart/form-data; boundary=test' } })
    await expect(invitationForm(req)).rejects.toThrow(/exceeds/)
  })
})
