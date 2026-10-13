const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 grub.cam/ingest'

// One request at a time to each host, this far apart, however many sources run at once: a college's server sees one
// slow visitor. Every request gives up after TIMEOUT_MS (one Jesus request hung for nearly three hours on 13 Oct 2026),
// and a network error, a timeout, a 5xx or a 429 is tried once more; a 403 or 404 isn't.
const GAP_MS = 700
const TIMEOUT_MS = 30_000
const RETRY_AFTER_MS = 3_000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const tails = new Map<string, Promise<unknown>>()

function byHost<T>(url: string, task: () => Promise<T>): Promise<T> {
  const host = new URL(url).host
  const run = (tails.get(host) ?? Promise.resolve()).then(task)
  const pause = () => sleep(GAP_MS)
  tails.set(host, run.then(pause, pause))
  return run
}

/** The source couldn't be reached or refused (a 403, a timeout): not something a parser or the model can help with. */
export class FetchError extends Error {}

class HttpError extends FetchError {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const retryable = (e: unknown) => !(e instanceof HttpError) || e.status >= 500 || e.status === 429

async function request<T>(url: string, init: RequestInit | undefined, read: (res: Response) => Promise<T>): Promise<T> {
  for (let tries = 1; ; tries++) {
    try {
      return await byHost(url, async () => {
        const signal = init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(TIMEOUT_MS)]) : AbortSignal.timeout(TIMEOUT_MS)
        try {
          const res = await fetch(url, { ...init, signal, headers: { 'user-agent': UA, accept: 'text/html,application/json;q=0.9,*/*;q=0.8', ...(init?.headers ?? {}) } })
          if (!res.ok && res.status !== 304) throw new HttpError(res.status, `${res.status} ${res.statusText} for ${url}`)
          return await read(res)
        } catch (e) {
          if (e instanceof HttpError) throw e
          const err = e as Error & { cause?: { code?: string; message?: string } }
          if (err.name === 'TimeoutError') throw new FetchError(`timed out after ${TIMEOUT_MS / 1000} s for ${url}`)
          // undici's "fetch failed" says nothing on its own: add why (ECONNRESET, a certificate) and where
          throw new FetchError(`${err.message}${err.cause ? ` (${err.cause.code ?? err.cause.message})` : ''} for ${url}`)
        }
      })
    } catch (e) {
      if (tries > 1 || !retryable(e)) throw e
      await sleep(RETRY_AFTER_MS)
    }
  }
}

// A run asks for the same page more than once (Darwin's weekly tabs once per week, Magdalene's index for two venues,
// Homerton's weeks overlapping): each URL is fetched once per run. A failure isn't kept, so a later ask tries again.
const fetched = new Map<string, Promise<string>>()

export function fetchText(url: string, init?: RequestInit): Promise<string> {
  if (init?.body !== undefined && typeof init.body !== 'string') return request(url, init, (res) => res.text())
  const key = `${init?.method ?? 'GET'} ${url} ${init?.body ?? ''}`
  let text = fetched.get(key)
  if (!text) {
    text = request(url, init, (res) => res.text())
    fetched.set(key, text)
    text.catch(() => fetched.delete(key))
  }
  return text
}

export async function fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const text = await fetchText(url, init)
  return JSON.parse(text) as T
}

/** What a server said a file was last time, to ask whether it has changed since. */
export type Validators = { etag?: string; lastModified?: string }
export type Download = { url: string; mime: string; bytes: Uint8Array } & Validators

/** A file (a PDF), or `unchanged` when `since` says what the server had and it still has that (a 304). */
export function fetchFile(url: string, since?: Validators): Promise<Download | 'unchanged'> {
  const headers: Record<string, string> = { accept: '*/*' }
  if (since?.etag) headers['if-none-match'] = since.etag
  if (since?.lastModified) headers['if-modified-since'] = since.lastModified
  return request(url, { headers }, async (res) => {
    if (res.status === 304) return 'unchanged' as const
    const mime = res.headers.get('content-type')?.split(';')[0].trim() || 'application/octet-stream'
    return { url, mime, bytes: new Uint8Array(await res.arrayBuffer()), etag: res.headers.get('etag') ?? undefined, lastModified: res.headers.get('last-modified') ?? undefined }
  })
}
