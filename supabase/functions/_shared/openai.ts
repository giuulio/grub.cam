// One call to OpenAI's Responses API, with an answer in a fixed JSON shape (structured outputs) and what it cost.
// Shared by the `submit` Edge Function (Deno) and the CLI's model comparison (Node): no imports, no Deno or process,
// everything it needs is passed in.

export type Usage = { input: number; output: number }
/** Dollars per million tokens, input and output, for the model a call uses (OPENAI_PRICE "0.75/4.50"). */
export type Price = { input: number; output: number }
export type Image = { base64: string; mime: string }
/** A JSON Schema for the answer: an object whose properties are all required, nothing else allowed (strict mode). */
export type Schema = { name: string; schema: Record<string, unknown> }

/** "0.75/4.50" → dollars per million tokens; undefined when unset or unreadable. */
export function readPrice(text: string | undefined): Price | undefined {
  const m = text?.match(/^\s*([\d.]+)\s*\/\s*([\d.]+)\s*$/)
  return m ? { input: Number(m[1]), output: Number(m[2]) } : undefined
}

/** What a call cost, in dollars; undefined when the model's price isn't known. */
export const costOf = (u: Usage, p: Price | undefined) => (p ? (u.input * p.input + u.output * p.output) / 1e6 : undefined)

/**
 * Asks `model` about `text` (and the image, when there is one) and returns its answer parsed to `schema`'s shape.
 * `reasoning`: the effort a reasoning model spends ("minimal", "low", …), left out for models without it. Throws with
 * OpenAI's message when the call fails, is refused, or comes back cut short.
 */
export async function respond<T>(o: { key: string; model: string; text: string; image?: Image; schema: Schema; maxOutput?: number; reasoning?: string }): Promise<{ value: T; usage: Usage }> {
  const content: unknown[] = [{ type: 'input_text', text: o.text }]
  if (o.image) content.push({ type: 'input_image', image_url: `data:${o.image.mime};base64,${o.image.base64}`, detail: 'high' })
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { authorization: `Bearer ${o.key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: o.model,
      input: [{ role: 'user', content }],
      text: { format: { type: 'json_schema', name: o.schema.name, schema: o.schema.schema, strict: true } },
      max_output_tokens: o.maxOutput ?? 4000,
      ...(o.reasoning ? { reasoning: { effort: o.reasoning } } : {}),
      store: false,
    }),
  })
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

/** The answer to a transcription: the body in the kind's format, whether the image held anything, what was unclear. */
export type Transcription = { readable: boolean; body: string; unsure: string }
export const TRANSCRIPTION: Schema = {
  name: 'transcription',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['readable', 'body', 'unsure'],
    properties: {
      readable: { type: 'boolean', description: 'false when the image and text show none of what was asked for' },
      body: { type: 'string', description: 'the transcription in the format given, nothing else; empty when not readable' },
      unsure: { type: 'string', description: 'anything hard to read or guessed, in a short sentence for the person who checks it; empty when nothing was' },
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
