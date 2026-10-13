// One call to OpenAI's Responses API, with an answer in a fixed JSON shape (structured outputs) and what it cost.
// Shared by the `submit` Edge Function (Deno) and the CLI's model comparison (Node): no imports, no Deno or process,
// everything it needs is passed in.

export type Usage = { input: number; output: number }
/** Dollars per million tokens, input and output, for the model a call uses (priceOf(), or OPENAI_PRICE "2/10"). */
export type Price = { input: number; output: number }
/** A photo, or a PDF (`application/pdf`, sent as a file: the model reads its text and pages) */
export type Image = { base64: string; mime: string; name?: string }
/** A JSON Schema for the answer: an object whose properties are all required, nothing else allowed (strict mode). */
export type Schema = { name: string; schema: Record<string, unknown> }

/** "0.75/4.50" → dollars per million tokens; undefined when unset or unreadable. */
export function readPrice(text: string | undefined): Price | undefined {
  const m = text?.match(/^\s*([\d.]+)\s*\/\s*([\d.]+)\s*$/)
  return m ? { input: Number(m[1]), output: Number(m[2]) } : undefined
}

/** Standard-tier prices of the models worth using here, from developers.openai.com/api/docs/pricing (October 2026). */
const PRICES: Record<string, Price> = {
  'gpt-6.1-sol': { input: 2, output: 10 },
  'gpt-6-sol': { input: 2, output: 10 },
  'gpt-6-luna': { input: 0.1, output: 0.5 },
  'gpt-5.4-mini': { input: 0.75, output: 4.5 },
  'gpt-5.4-nano': { input: 0.2, output: 1.25 },
}

/** A model's price: `override` ("in/out") when given, else the table's; undefined when neither knows it. */
export const priceOf = (model: string, override?: string): Price | undefined => readPrice(override) ?? PRICES[model]

/** What a call cost, in dollars; undefined when the model's price isn't known. */
export const costOf = (u: Usage, p: Price | undefined) => (p ? (u.input * p.input + u.output * p.output) / 1e6 : undefined)

type Ask = { key: string; model: string; text: string; image?: Image; images?: Image[]; schema: Schema; maxOutput?: number; reasoning?: string }

/** The Responses API request for `o`: its text, then each image (`image`, or several as `images`), in order. */
function request(o: Ask, stream: boolean) {
  const content: unknown[] = [{ type: 'input_text', text: o.text }]
  for (const i of o.images ?? (o.image ? [o.image] : []))
    content.push(
      i.mime === 'application/pdf'
        ? { type: 'input_file', filename: i.name ?? 'document.pdf', file_data: `data:application/pdf;base64,${i.base64}` }
        : { type: 'input_image', image_url: `data:${i.mime};base64,${i.base64}`, detail: 'high' },
    )
  return fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { authorization: `Bearer ${o.key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: o.model,
      input: [{ role: 'user', content }],
      text: { format: { type: 'json_schema', name: o.schema.name, schema: o.schema.schema, strict: true } },
      max_output_tokens: o.maxOutput ?? 4000,
      ...(o.reasoning ? { reasoning: { effort: o.reasoning } } : {}),
      store: false,
      ...(stream ? { stream: true } : {}),
    }),
  })
}

/**
 * Asks `model` about `text` (and the images, when there are some) and returns its answer parsed to `schema`'s shape.
 * `reasoning`: the effort a reasoning model spends ("minimal", "low", …), left out for models without it. Throws with
 * OpenAI's message when the call fails, is refused, or comes back cut short.
 */
export async function respond<T>(o: Ask): Promise<{ value: T; usage: Usage }> {
  const res = await request(o, false)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`openai ${res.status}: ${data?.error?.message ?? 'no message'}`)
  const usage: Usage = { input: data.usage?.input_tokens ?? 0, output: data.usage?.output_tokens ?? 0 }
  if (data.status === 'incomplete') throw new Error(`openai: answer cut short (${data.incomplete_details?.reason ?? 'unknown'})`)
  const parts = (data.output ?? []).flatMap((item: { type: string; content?: { type: string; text?: string; refusal?: string }[] }) => (item.type === 'message' ? item.content ?? [] : []))
  const refusal = parts.find((p: { type: string }) => p.type === 'refusal')
  if (refusal) throw new Error(`openai refused: ${refusal.refusal}`)
  const text = parts.find((p: { type: string }) => p.type === 'output_text')?.text
  if (!text) throw new Error('openai: no answer')
  return { value: JSON.parse(text) as T, usage }
}

/**
 * respond(), streamed: `onText` gets the answer's JSON so far each time more of it arrives (partialString() reads a
 * field out of it), so the sender can watch the board being read. Same answer, usage and errors as respond().
 */
export async function respondStream<T>(o: Ask, onText: (soFar: string) => void): Promise<{ value: T; usage: Usage }> {
  const res = await request(o, true)
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}))
    throw new Error(`openai ${res.status}: ${data?.error?.message ?? 'no message'}`)
  }
  let text = ''
  let refusal = ''
  let done: { status?: string; usage?: { input_tokens?: number; output_tokens?: number }; incomplete_details?: { reason?: string } } | undefined
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { value, done: end } = await reader.read()
    if (value) buffer += value
    // Server-sent events: blank-line separated, each with a "data: {json}" line
    let cut: number
    while ((cut = buffer.indexOf('\n\n')) >= 0) {
      const event = buffer.slice(0, cut)
      buffer = buffer.slice(cut + 2)
      const line = event.split('\n').find((l) => l.startsWith('data: '))
      if (!line) continue
      const e = JSON.parse(line.slice(6))
      if (e.type === 'response.output_text.delta') {
        text += e.delta
        onText(text)
      } else if (e.type === 'response.refusal.delta') refusal += e.delta
      else if (e.type === 'response.completed' || e.type === 'response.incomplete') done = e.response
      else if (e.type === 'response.failed') throw new Error(`openai: ${e.response?.error?.message ?? 'failed'}`)
      else if (e.type === 'error') throw new Error(`openai: ${e.message ?? 'error'}`)
    }
    if (end) break
  }
  const usage: Usage = { input: done?.usage?.input_tokens ?? 0, output: done?.usage?.output_tokens ?? 0 }
  if (done?.status === 'incomplete') throw new Error(`openai: answer cut short (${done.incomplete_details?.reason ?? 'unknown'})`)
  if (refusal) throw new Error(`openai refused: ${refusal}`)
  if (!text) throw new Error('openai: no answer')
  return { value: JSON.parse(text) as T, usage }
}

/** The string `key` holds in `json`, a JSON object still being written: as much of it as has arrived; undefined before it starts. */
export function partialString(json: string, key: string): string | undefined {
  const start = json.match(new RegExp(`"${key}"\\s*:\\s*"`))
  if (!start) return undefined
  let out = ''
  for (let i = start.index! + start[0].length; i < json.length; i++) {
    const c = json[i]
    if (c === '"') break
    if (c !== '\\') {
      out += c
      continue
    }
    const next = json[i + 1]
    if (next === undefined) break
    if (next === 'u') {
      if (i + 6 > json.length) break
      out += String.fromCharCode(parseInt(json.slice(i + 2, i + 6), 16))
      i += 5
    } else {
      out += ({ n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' } as Record<string, string>)[next] ?? next
      i++
    }
  }
  return out
}

/**
 * The answer to a transcription: the body in the kind's format, whether the image held anything, what was unclear,
 * and whether it can go up as it is (`verdict`), with what the sender should do when it can't (`retry`).
 */
export type Transcription = { readable: boolean; body: string; unsure: string; verdict: 'publish' | 'retry'; retry: string }
export const TRANSCRIPTION: Schema = {
  name: 'transcription',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['readable', 'body', 'unsure', 'verdict', 'retry'],
    properties: {
      readable: { type: 'boolean', description: 'false when the image and text show none of what was asked for' },
      body: { type: 'string', description: 'the transcription in the format given, nothing else; empty when not readable' },
      unsure: { type: 'string', description: 'anything hard to read or guessed, in a short sentence for the person who checks it; empty when nothing was' },
      verdict: { type: 'string', enum: ['publish', 'retry'], description: 'publish: it goes on the venue page as it is, no one checking; retry: the sender is asked to send it again' },
      retry: { type: 'string', description: 'when retry, one short sentence to the sender saying what to do, e.g. "The right half is cut off: take it again with the whole board in frame."; else empty' },
    },
  },
}

/** A verdict on a member's photo of a venue (see vet() in the submit function). */
export type Verdict = { ok: boolean; reason: string; alt: string }
export const VERDICT: Schema = {
  name: 'verdict',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['ok', 'reason', 'alt'],
    properties: {
      ok: { type: 'boolean' },
      reason: { type: 'string', description: 'when not ok, one short sentence to the sender saying what to change; else empty' },
      alt: { type: 'string', description: 'what the photo shows, for screen readers, under 120 characters' },
    },
  },
}

/** Whether a review's words can be shown (see checkReview() in the submit function). */
export type ReviewCheck = { ok: boolean; reason: string }
export const REVIEW_CHECK: Schema = {
  name: 'review_check',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['ok', 'reason'],
    properties: {
      ok: { type: 'boolean' },
      reason: { type: 'string', description: 'when not ok, one short sentence saying why, for the person who looks; else empty' },
    },
  },
}

/**
 * OpenAI's moderation (free, not counted against the budget): the categories it flags `text` for, empty when none.
 * Throws when the call fails.
 */
export async function moderate(key: string, text: string): Promise<string[]> {
  const res = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'omni-moderation-latest', input: text }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`moderation ${res.status}: ${data?.error?.message ?? 'no message'}`)
  const r = data.results?.[0]
  return r?.flagged ? Object.entries(r.categories ?? {}).filter(([, on]) => on).map(([k]) => k) : []
}

export function base64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
