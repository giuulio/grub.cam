// The model reading a source's own document (a PDF, a page's text, a screenshot) into the ingest formats, with the
// prompt and answer shape the submit function gives members' boards (supabase/functions/_shared/), so what it gives
// back is a file parseManual() or parsePrices() checks like any other. OPENAI_API_KEY (repository secret in Actions);
// OPENAI_MODEL (default gpt-6.1-sol, as the submit function), OPENAI_PRICE, OPENAI_REASONING and LLM_DAILY_USD as there.
// Every call is logged in model_calls (purpose read_source, with the venue and the document).
import { header, prompt } from '../../../supabase/functions/_shared/formats.ts'
import { base64, costOf, priceOf, respond, TRANSCRIPTION, type Image, type Transcription } from '../../../supabase/functions/_shared/openai.ts'
import type { MenuDay } from '../../schema.ts'
import { parseManual } from '../manual.ts'
import { parsePrices, type PriceList } from '../prices.ts'
import type { connect } from './db.ts'

export type Venue = { id: string; name: string; type: 'hall' | 'cafe' | 'bar'; site: string }
/** What the model is given: the document's text and/or its files, what it is, and (a cycle's week) which Monday it's dated as. */
export type Reading = { venue: Venue; url: string; about: string; text?: string; files: { mime: string; bytes: Uint8Array; name?: string }[]; today: string; week?: string }

export type ModelReader = {
  menu(r: Reading): Promise<{ days: MenuDay[]; unsure: string }>
  prices(r: Reading): Promise<{ list: PriceList; unsure: string }>
}

// A month of a cycle or a whole price list, and a reasoning model's thinking
const MAX_OUTPUT = 24_000
// A call whose price isn't known counts as this against LLM_DAILY_USD
const UNPRICED_USD = 0.1

/** The reader, or undefined without OPENAI_API_KEY (documents then wait in the Source health issue). */
export function modelReader(db: ReturnType<typeof connect>): ModelReader | undefined {
  const key = process.env.OPENAI_API_KEY
  if (!key) return undefined
  const model = process.env.OPENAI_MODEL || 'gpt-6.1-sol'
  const price = priceOf(model, process.env.OPENAI_PRICE)
  const daily = process.env.LLM_DAILY_USD ? Number(process.env.LLM_DAILY_USD) : Infinity

  async function ask(kind: 'menu' | 'prices', r: Reading): Promise<Transcription> {
    if (daily !== Infinity && (await db.spentToday(UNPRICED_USD)) >= daily) throw new Error(`today's model spending has reached LLM_DAILY_USD ($${daily})`)
    const lines = [
      prompt({ kind, venue: { name: r.venue.name, type: r.venue.type, site: r.venue.site }, asBoard: kind === 'menu', today: r.today, week: r.week, source: `${r.about} (${r.url})`, photos: r.files.length }, true),
    ]
    if (r.text) lines.push('', `The document's text:\n"""\n${r.text}\n"""`)
    const images: Image[] = r.files.map((f) => ({ base64: base64(f.bytes), mime: f.mime, name: f.name }))
    const { value, usage } = await respond<Transcription>({ key: key!, model, text: lines.join('\n'), images, schema: TRANSCRIPTION, maxOutput: MAX_OUTPUT, reasoning: process.env.OPENAI_REASONING || undefined })
    await db.logModelCall({ purpose: 'read_source', model, input_tokens: usage.input, output_tokens: usage.output, cost_usd: costOf(usage, price) ?? null, ok: value.readable && value.verdict === 'publish', venue_id: r.venue.id, source_url: r.url })
    if (!value.readable || !value.body.trim()) throw new Error(`the model found no ${kind === 'menu' ? 'menu' : 'price list'} in it${value.unsure ? `: ${value.unsure}` : ''}`)
    if (value.verdict !== 'publish') throw new Error(`the model wouldn't vouch for its reading: ${value.retry || value.unsure || 'no reason given'}`)
    return value
  }

  const head = (kind: 'menu' | 'prices', r: Reading) => {
    const [site, venue] = r.venue.id.split('/')
    return header(kind, { site, venue, source: r.url, observed: r.today })
  }

  return {
    async menu(r) {
      const t = await ask('menu', r)
      return { days: parseManual(head('menu', r) + t.body).days, unsure: t.unsure }
    },
    async prices(r) {
      const t = await ask('prices', r)
      return { list: parsePrices(head('prices', r) + t.body), unsure: t.unsure }
    },
  }
}
