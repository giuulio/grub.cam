// Usage: npm run models:compare -- <dir> --model gpt-5.4-mini=0.75/4.50 --model gpt-5.4-nano=0.20/1.25 [--reasoning low]
//
// Which OpenAI model to transcribe with (OPENAI_MODEL in the submit function), decided on real boards rather than on
// price: each photo in <dir> is sent to each model with the same prompt and answer shape the submit function uses,
// shrunk as the page shrinks it (1600 px, JPEG), and its answer scored against the transcription beside it.
//
// <dir> holds pairs: menu-<anything>.jpg with menu-<anything>.txt (likewise prices-… and hours-…), the .txt a file in
// the ingest format (header, ---, body) as ingest:manual, ingest:prices or ingest:hours would take, checked by hand.
// The header's site and venue say where it is; a menu's first body line ("2026-10-09 lunch") its day and meal.
// After a model's name, "=in/out" is its price in dollars per million tokens, for the cost column.
//
// The score is per line: lines the model got exactly (after folding case, spaces and price formats) over the lines it
// should have (recall) and over the lines it gave (precision), as F1. Needs OPENAI_API_KEY in .env, as well as the
// Supabase keys the other scripts use (for each venue's name).
import { readdirSync, readFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { parseArgs } from 'node:util'
import sharp from 'sharp'
import { prompt, type Transcribable } from '../../supabase/functions/_shared/formats.ts'
import { costOf, readPrice, respond, TRANSCRIPTION, type Transcription } from '../../supabase/functions/_shared/openai.ts'
import { connect } from './lib/db.ts'

const { values, positionals } = parseArgs({ options: { model: { type: 'string', multiple: true }, reasoning: { type: 'string' } }, allowPositionals: true })
const dir = positionals[0]
const models = (values.model ?? []).map((m) => {
  const [name, price] = m.split('=')
  return { name, price: readPrice(price) }
})
if (!dir || !models.length) {
  console.error('usage: npm run models:compare -- <dir> --model <name>[=in/out] [--model …] [--reasoning low]')
  process.exit(1)
}
const db = connect()
const key = process.env.OPENAI_API_KEY
if (!key) throw new Error('OPENAI_API_KEY missing from .env')

const KINDS: Transcribable[] = ['menu', 'prices', 'hours']
const IMAGE = /\.(jpe?g|png|webp|heic)$/i

/** A body's lines as compared: case, runs of spaces, "£3.60"/"3.60"/"£3.6" and spaces around | folded away. */
function lines(body: string): string[] {
  return body
    .split('\n')
    .map((l) =>
      l
        .toLowerCase()
        .replace(/£\s*(\d+)\.(\d)(?!\d)/g, '£$1.$20')
        .replace(/(^|[\s|])(\d+\.\d\d)(?=$|[\s|])/g, '$1£$2')
        .replace(/\s*\|\s*/g, ' | ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
}

function f1(got: string[], want: string[]): { recall: number; precision: number; f1: number } {
  const left = [...want]
  let hit = 0
  for (const l of got) {
    const i = left.indexOf(l)
    if (i >= 0) {
      hit++
      left.splice(i, 1)
    }
  }
  const recall = want.length ? hit / want.length : 1
  const precision = got.length ? hit / got.length : 0
  return { recall, precision, f1: recall + precision ? (2 * recall * precision) / (recall + precision) : 0 }
}

const field = (head: string, name: string) => head.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))?.[1].trim()

const cases = readdirSync(dir)
  .filter((f) => IMAGE.test(f))
  .map((f) => {
    const name = basename(f, extname(f))
    const kind = KINDS.find((k) => name.startsWith(`${k}-`))
    const expected = join(dir, `${name}.txt`)
    return { name, kind, photo: join(dir, f), expected }
  })
  .filter((c): c is typeof c & { kind: Transcribable } => {
    if (!c.kind) console.warn(`skipped ${c.name}: name it menu-…, prices-… or hours-…`)
    return !!c.kind
  })
if (!cases.length) throw new Error(`no menu-/prices-/hours- photos in ${dir}`)

type Row = { model: string; name: string; f1: number; recall: number; precision: number; cost?: number; seconds: number; error?: string }
const rows: Row[] = []
for (const c of cases) {
  const file = readFileSync(c.expected, 'utf8')
  const [head, body = ''] = file.split(/\n---\n/)
  const site = field(head, 'site')
  const slug = field(head, 'venue')
  if (!site || !slug) throw new Error(`${c.expected}: needs site: and venue: in its header`)
  const v = await db.venue(`${site}/${slug}`)
  const first = body.trim().split('\n')[0].match(/^(\d{4}-\d{2}-\d{2})\s+(\w+)/)
  const text = prompt({ kind: c.kind, venue: { name: v.name, type: v.type, site: v.siteName }, date: first?.[1], service: first?.[2] }, true)
  const jpeg = await sharp(readFileSync(c.photo)).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer()
  const want = lines(body)
  for (const m of models) {
    const start = performance.now()
    try {
      const { value, usage } = await respond<Transcription>({ key, model: m.name, text, image: { base64: jpeg.toString('base64'), mime: 'image/jpeg' }, schema: TRANSCRIPTION, reasoning: values.reasoning })
      const score = f1(value.readable ? lines(value.body) : [], want)
      rows.push({ model: m.name, name: c.name, ...score, cost: costOf(usage, m.price), seconds: (performance.now() - start) / 1000 })
    } catch (e) {
      rows.push({ model: m.name, name: c.name, f1: 0, recall: 0, precision: 0, seconds: (performance.now() - start) / 1000, error: (e as Error).message })
    }
    const r = rows.at(-1)!
    console.log(`${c.name.padEnd(36)} ${m.name.padEnd(22)} F1 ${(r.f1 * 100).toFixed(0).padStart(3)}%  ${r.cost != null ? `$${r.cost.toFixed(4)}` : '      '}  ${r.seconds.toFixed(1)}s${r.error ? `  ${r.error}` : ''}`)
  }
}

console.log(`\n${cases.length} photos`)
for (const m of models) {
  const mine = rows.filter((r) => r.model === m.name)
  const mean = (k: 'f1' | 'recall' | 'precision' | 'seconds') => mine.reduce((n, r) => n + r[k], 0) / mine.length
  const cost = mine.every((r) => r.cost != null) ? mine.reduce((n, r) => n + r.cost!, 0) : undefined
  console.log(
    `${m.name.padEnd(22)} F1 ${(mean('f1') * 100).toFixed(0)}% (recall ${(mean('recall') * 100).toFixed(0)}%, precision ${(mean('precision') * 100).toFixed(0)}%)  ${mean('seconds').toFixed(1)}s each` +
      (cost != null ? `  $${(cost / mine.length).toFixed(4)} each, about ${Math.floor(50 / (cost / mine.length)).toLocaleString('en-GB')} for $50` : '') +
      `${mine.some((r) => r.error) ? `  ${mine.filter((r) => r.error).length} failed` : ''}`,
  )
}
