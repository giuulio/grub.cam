import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchJson, fetchText } from './http.ts'

afterEach(() => vi.unstubAllGlobals())

const answering = (...replies: (() => Response)[]) => {
  const calls: string[] = []
  vi.stubGlobal('fetch', async (url: string) => {
    calls.push(url)
    return (replies[Math.min(calls.length, replies.length) - 1])()
  })
  return calls
}

describe('fetching a source', () => {
  it('fetches a page once per run however many times it is asked for, the same body or not', async () => {
    const calls = answering(() => new Response('{"week":1}'))
    const url = 'https://dedupe.example/menu'
    const [a, b] = await Promise.all([fetchText(url), fetchJson<{ week: number }>(url)])
    expect(a).toBe('{"week":1}')
    expect(b.week).toBe(1)
    await fetchText(url, { method: 'POST', body: '{}' })
    expect(calls).toEqual([url, url])
  })
  it('does not try a 403 again, and asks again later in the run after a failure', async () => {
    const calls = answering(() => new Response('', { status: 403, statusText: 'Forbidden' }), () => new Response('menu'))
    const url = 'https://blocked.example/menu'
    await expect(fetchText(url)).rejects.toThrow('403 Forbidden for https://blocked.example/menu')
    expect(calls).toHaveLength(1)
    expect(await fetchText(url)).toBe('menu')
  })
  it('tries a server error once more', async () => {
    const calls = answering(() => new Response('', { status: 503, statusText: 'Service Unavailable' }), () => new Response('menu'))
    expect(await fetchText('https://flaky.example/menu')).toBe('menu')
    expect(calls).toHaveLength(2)
  }, 10_000)
  it('says why a request failed and where, not just "fetch failed"', async () => {
    vi.stubGlobal('fetch', async () => {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } })
    })
    await expect(fetchText('https://reset.example/menu')).rejects.toThrow('fetch failed (ECONNRESET) for https://reset.example/menu')
  }, 10_000)
})
