const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 grub.cam/ingest'

let last = 0
const MIN_GAP_MS = 700

async function politeDelay() {
  const wait = last + MIN_GAP_MS - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  last = Date.now()
}

export async function fetchText(url: string, init?: RequestInit): Promise<string> {
  await politeDelay()
  const res = await fetch(url, { ...init, headers: { 'user-agent': UA, accept: 'text/html,application/json;q=0.9,*/*;q=0.8', ...(init?.headers ?? {}) } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  return res.text()
}

export async function fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const text = await fetchText(url, init)
  return JSON.parse(text) as T
}
