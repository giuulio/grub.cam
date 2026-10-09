// Usage: npm run ingest:photo -- <site>/<venue> photo.jpg --alt "The counter, from the door" [--credit "Name"]
//          [--licence "CC BY 4.0"] [--source "own photo"] [--taken 2026-10-09] [--kind venue|menu] [--dry [--out dir]]
// Makes the sizes a page needs (WebP, 480/960/1600 px wide, never wider than the original), uploads them to the photo
// bucket (Cloudflare R2) and adds the photo to Supabase, approved: run it only for photos that are ours, or a
// contributor's with a licence, with no recognisable people. Metadata (GPS included) is stripped from every file.
// `--kind menu`: a photo of a menu board or price list, kept as the source for a transcription, not shown on the page.
// Needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET (and Supabase keys) in .env, unless --dry.
import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { AwsClient } from 'aws4fetch'
import sharp from 'sharp'
import { connect } from './lib/db.ts'

export const WIDTHS = [480, 960, 1600]

/** The widths to make from an image `width` px wide: each standard width it covers, else its own. */
export function widthsFor(width: number): number[] {
  const fit = WIDTHS.filter((w) => w <= width)
  return fit.length ? fit : [width]
}

export type Variant = { width: number; height: number; file: Buffer }

/** The image upright, at each width, as WebP without metadata; and its dominant colour. */
export async function makeVariants(input: Buffer): Promise<{ variants: Variant[]; color: string }> {
  // rotate() applies the EXIF orientation, so widths are the upright image's
  const { data, info } = await sharp(input).rotate().toBuffer({ resolveWithObject: true })
  const variants: Variant[] = []
  for (const w of widthsFor(info.width)) {
    const out = await sharp(data).resize({ width: w }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true })
    variants.push({ width: out.info.width, height: out.info.height, file: out.data })
  }
  const { dominant } = await sharp(data).stats()
  const color = `#${[dominant.r, dominant.g, dominant.b].map((c) => c.toString(16).padStart(2, '0')).join('')}`
  return { variants, color }
}

function r2() {
  const env = (k: string) => {
    const v = process.env[k]
    if (!v) throw new Error(`Set ${k} (or pass --dry)`)
    return v
  }
  const client = new AwsClient({ accessKeyId: env('R2_ACCESS_KEY_ID'), secretAccessKey: env('R2_SECRET_ACCESS_KEY'), service: 's3', region: 'auto' })
  const base = `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com/${env('R2_BUCKET')}`
  return async (key: string, body: Buffer) => {
    const res = await client.fetch(`${base}/${key}`, {
      method: 'PUT',
      body: new Uint8Array(body),
      // A path is never reused: a new photo gets a new id
      headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable' },
    })
    if (!res.ok) throw new Error(`R2 PUT ${key}: ${res.status} ${await res.text()}`)
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) {
  const { values, positionals } = parseArgs({
    options: {
      alt: { type: 'string' },
      credit: { type: 'string' },
      licence: { type: 'string' },
      source: { type: 'string' },
      taken: { type: 'string' },
      kind: { type: 'string', default: 'venue' },
      dry: { type: 'boolean' },
      out: { type: 'string' },
    },
    allowPositionals: true,
  })
  const [venue, file] = positionals
  if (!venue?.includes('/') || !file || !values.alt) throw new Error('usage: npm run ingest:photo -- <site>/<venue> photo.jpg --alt "what it shows" [--credit ...] [--dry]')
  if (values.kind !== 'venue' && values.kind !== 'menu') throw new Error('--kind is venue or menu')
  if (values.taken && !/^\d{4}-\d{2}-\d{2}$/.test(values.taken)) throw new Error('--taken is YYYY-MM-DD')

  const { variants, color } = await makeVariants(readFileSync(file))
  const path = `${venue}/${randomBytes(4).toString('hex')}`
  const largest = variants.at(-1)!
  const sizes = variants.map((v) => `${v.width}×${v.height} ${Math.round(v.file.length / 1024)} KB`).join(', ')

  if (values.dry) {
    if (values.out)
      for (const v of variants) {
        const name = join(values.out, `${path.replaceAll('/', '_')}-${v.width}.webp`)
        mkdirSync(values.out, { recursive: true })
        writeFileSync(name, v.file)
      }
    console.log(`(dry) ${path}: ${sizes}, colour ${color}${values.out ? ` → ${values.out}` : ''}`)
  } else {
    const db = connect() // loads .env
    const put = r2()
    for (const v of variants) await put(`${path}-${v.width}.webp`, v.file)
    await db.savePhoto({
      venue_id: venue,
      kind: values.kind,
      path,
      widths: variants.map((v) => v.width),
      width: largest.width,
      height: largest.height,
      color,
      alt: values.alt,
      credit: values.credit ?? null,
      licence: values.licence ?? null,
      source: values.source ?? null,
      taken_on: values.taken ?? null,
      approved: true,
    })
    console.log(`✓ ${path}: ${sizes}`)
  }
}
