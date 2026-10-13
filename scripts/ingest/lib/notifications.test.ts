import { describe, expect, it, vi } from 'vitest'
import { deliverNotices, noticeBody, type SubmissionNotice } from './notifications.ts'

const row: SubmissionNotice = { id: '6b8716a5-624b-4bc1-af90-a2b4c2f54303', venue_id: 'west-cambridge/cavendish-cafe', site: null, kind: 'prices', topic: null, created_at: '2026-10-12T15:00:00Z' }

describe('submission notifications', () => {
  it('announces receipt without leaking private text or identity, regardless of publication status', async () => {
    const post = vi.fn(async (_body: string) => {})
    const acknowledge = vi.fn(async () => {})
    const privateRow = { ...row, status: 'approved', note: 'private note', user_email: 'private@cam.ac.uk', transcription: 'private prices', photo_path: 'private/photo.jpg' }
    expect(await deliverNotices([privateRow], { existing: async () => [], post, acknowledge })).toBe(1)
    const body = post.mock.calls[0][0]
    expect(body).toContain('New price list')
    expect(body).toContain('https://grub.cam/west-cambridge/cavendish-cafe')
    for (const value of [privateRow.note, privateRow.user_email, privateRow.transcription, privateRow.photo_path]) expect(body).not.toContain(value)
    expect(acknowledge).toHaveBeenCalledWith(row.id)
  })

  it('names a site photo by the site whose page it is for', () => {
    expect(noticeBody({ ...row, venue_id: null, site: 'robinson', kind: 'photo' })).toContain('New site photo submitted for [robinson](https://grub.cam/robinson)')
  })

  it('does not duplicate a comment when the database acknowledgement failed after posting', async () => {
    const comments: string[] = []
    const post = vi.fn(async (body: string) => { comments.push(body) })
    const acknowledge = vi.fn(async () => { throw new Error('database unavailable') })
    await expect(deliverNotices([row], { existing: async () => [...comments], post, acknowledge })).rejects.toThrow('database unavailable')
    expect(comments).toEqual([noticeBody(row)])
    const retryAck = vi.fn(async () => {})
    expect(await deliverNotices([row], { existing: async () => [...comments], post, acknowledge: retryAck })).toBe(0)
    expect(post).toHaveBeenCalledTimes(1)
    expect(retryAck).toHaveBeenCalledWith(row.id)
  })

  it('leaves a failed GitHub delivery unacknowledged for retry', async () => {
    const acknowledge = vi.fn(async () => {})
    await expect(deliverNotices([row], { existing: async () => [], post: async () => { throw new Error('GitHub unavailable') }, acknowledge })).rejects.toThrow('GitHub unavailable')
    expect(acknowledge).not.toHaveBeenCalled()
  })
})
