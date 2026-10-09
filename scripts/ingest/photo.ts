// Usage: npm run ingest:photo -- <site>/<venue> <photo.jpg | Commons file> --alt "The counter, from the door"
//          [--credit "Name"] [--licence "CC BY 4.0"] [--source "own photo"] [--taken 2026-10-09] [--kind venue|menu] [--dry]
//        npm run ingest:photo -- --list photos.txt [--dry]
// Makes the sizes a page needs (WebP, 240/480/960/1600 px wide, never wider than the original), writes them to
// public/photos/<site>/<venue>/<id>-<width>.webp and adds the photo to Supabase, approved. Commit the files: the site
// serves them once it's deployed, and shows the type's tile until then. Metadata (GPS included) is stripped from every
// file. `--kind menu`: a photo of a menu board or price list, kept as the source for a transcription, not shown.
// `--dry` fetches and makes the sizes without writing anything.
//
// Whose photos: ours, a contributor's with a licence, or one published under an open licence on Wikimedia Commons
// (CC0, public domain, CC BY, CC BY-SA; not NC or ND), with no recognisable people. Never from Google Maps, social
// media or a college's own site: those photos belong to whoever took them. For a Commons file (its page URL, or
// "File:Name.jpg"), the author, licence and page are read from Commons and saved as credit, licence and source, so
// the app can credit it; --credit overrides an author Commons can't name.
//
// A list (`--list`): one photo per line, `<site>/<venue> | <file or Commons file> | <alt text> [| <credit>]`; blank
// lines and lines starting with # are skipped, and so is a photo the venue already has from the same source, so a list can be
// run again after adding to it. The first photo saved for a venue is the one shown.
import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'
import sharp from 'sharp'
import { connect } from './lib/db.ts'

/** 240 for a list's square, 480 for the map's panel, up to 1600 for a venue page's banner on a wide screen. */
export const WIDTHS = [240, 480, 960, 1600]

/** The widths to make from an image `width` px wide: each standard width it covers, else its own. */
export function widthsFor(width: number): number[] {
  const fit = WIDTHS.filter((w) => w <= width)
  return fit.length ? fit : [width]
}

export type Variant = { width: number; height: number; file: Buffer }

/** The image upright, at each width, as WebP without metadata; and its average colour, shown while it loads. */
export async function makeVariants(input: Buffer): Promise<{ variants: Variant[]; color: string }> {
  // rotate() applies the EXIF orientation, so widths are the upright image's
  const { data, info } = await sharp(input).rotate().toBuffer({ resolveWithObject: true })
  const variants: Variant[] = []
  for (const w of widthsFor(info.width)) {
    const out = await sharp(data).resize({ width: w }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true })
    variants.push({ width: out.info.width, height: out.info.height, file: out.data })
  }
  // Averaged down to one pixel: sharp's "dominant" colour is coarse (black or white for most photos)
  const pixel = await sharp(data).resize(1, 1).removeAlpha().raw().toBuffer()
  const color = `#${[...pixel].map((c) => c.toString(16).padStart(2, '0')).join('')}`
  return { variants, color }
}

/** Licences a photo can be shown under: Commons' short names for CC0, public domain, CC BY and CC BY-SA. */
const OPEN = /^(CC0( 1\.0)?|Public domain|CC BY(-SA)? \d\.\d( [a-z]{2,3})?)$/i

/** "File:Name.jpg" from a Commons page URL, or the title itself; undefined for anything else (a local file). */
export function commonsTitle(ref: string): string | undefined {
  if (/^File:/i.test(ref)) return ref.replace(/^file:/i, 'File:').replaceAll('_', ' ')
  const m = ref.match(/^https:\/\/commons\.wikimedia\.org\/wiki\/(File:[^?#]+)/i)
  return m ? decodeURIComponent(m[1]).replaceAll('_', ' ') : undefined
}

const plain = (html = '') => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

/** A Commons file: the image (no wider than 2400 px), its author and licence as Commons gives them, and its page. */
export async function fromCommons(title: string): Promise<{ image: Buffer; credit: string; licence: string; source: string }> {
  const api = new URL('https://commons.wikimedia.org/w/api.php')
  const params = { action: 'query', format: 'json', titles: title, prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '2400', iiextmetadatafilter: 'Artist|LicenseShortName' }
  Object.entries(params).forEach(([k, v]) => api.searchParams.set(k, v))
  // Wikimedia asks for a User-Agent that says who's asking
  const headers = { 'User-Agent': 'grub.cam/ingest (https://grub.cam)' }
  const res = await fetch(api, { headers })
  if (!res.ok) throw new Error(`Commons ${title}: ${res.status}`)
  const json = (await res.json()) as { query?: { pages?: Record<string, { imageinfo?: { url: string; thumburl?: string; width: number; descriptionurl: string; extmetadata?: Record<string, { value: string }> }[] }> } }
  const info = Object.values(json.query?.pages ?? {})[0]?.imageinfo?.[0]
  if (!info) throw new Error(`Commons ${title}: no such file`)
  const licence = plain(info.extmetadata?.LicenseShortName?.value)
  if (!OPEN.test(licence)) throw new Error(`Commons ${title}: "${licence}" isn't a licence we can show (CC0, public domain, CC BY, CC BY-SA)`)
  const credit = plain(info.extmetadata?.Artist?.value)
  const file = await fetch(info.width > 2400 && info.thumburl ? info.thumburl : info.url, { headers })
  if (!file.ok) throw new Error(`Commons ${title}: ${file.status} fetching the image`)
  return { image: Buffer.from(await file.arrayBuffer()), credit, licence, source: info.descriptionurl }
}

/** Where the files go: served by the site itself as /photos (VITE_PHOTOS_URL can move them elsewhere). */
const PHOTOS_DIR = 'public/photos'

type Job = { venue: string; file: string; alt: string; credit?: string; licence?: string; source?: string; taken?: string; kind: 'venue' | 'menu' }

/** `<site>/<venue> | <file> | <alt> [| <credit>]` lines, skipping blanks and # comments. */
export function parseList(text: string): Job[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l, i) => {
      const [venue, file, alt, credit] = l.split('|').map((p) => p.trim())
      if (!venue?.includes('/') || !file || !alt) throw new Error(`line ${i + 1}: expected "<site>/<venue> | <file> | <alt> [| <credit>]"`)
      return { venue, file, alt, ...(credit ? { credit } : {}), kind: 'venue' as const }
    })
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
      list: { type: 'string' },
      dry: { type: 'boolean' },
    },
    allowPositionals: true,
  })
  let jobs: Job[]
  if (values.list) jobs = parseList(readFileSync(values.list, 'utf8'))
  else {
    const [venue, file] = positionals
    if (!venue?.includes('/') || !file || !values.alt) throw new Error('usage: npm run ingest:photo -- <site>/<venue> <photo.jpg | Commons file> --alt "what it shows" [--credit ...] [--dry]')
    if (values.kind !== 'venue' && values.kind !== 'menu') throw new Error('--kind is venue or menu')
    if (values.taken && !/^\d{4}-\d{2}-\d{2}$/.test(values.taken)) throw new Error('--taken is YYYY-MM-DD')
    jobs = [{ venue, file, alt: values.alt, credit: values.credit, licence: values.licence, source: values.source, taken: values.taken, kind: values.kind }]
  }

  const db = values.dry ? undefined : connect() // loads .env
  let failed = 0
  for (const job of jobs) {
    try {
      const title = commonsTitle(job.file)
      const commons = title ? await fromCommons(title) : undefined
      const credit = job.credit ?? commons?.credit
      // Commons sometimes has no author, or a user's signature template in place of one
      if (commons && (!credit || /machine-readable|^Template:/i.test(credit))) throw new Error(`Commons doesn't name the author of ${title}: give a credit`)
      const source = job.source ?? commons?.source ?? null
      if (db && source && (await db.hasPhoto(job.venue, source))) {
        console.log(`· ${job.venue}: already has ${source}`)
        continue
      }
      const { variants, color } = await makeVariants(commons?.image ?? readFileSync(job.file))
      const path = `${job.venue}/${randomBytes(4).toString('hex')}`
      const largest = variants.at(-1)!
      const sizes = variants.map((v) => `${v.width}×${v.height} ${Math.round(v.file.length / 1024)} KB`).join(', ')
      const credited = credit ? ` · ${credit}, ${job.licence ?? commons?.licence ?? 'no licence given'}` : ''

      if (!db) {
        console.log(`(dry) ${path}: ${sizes}, colour ${color}${credited}`)
        continue
      }
      // A path is never reused (a new photo gets a new id), so the files can be cached for good
      for (const v of variants) {
        const file = join(PHOTOS_DIR, `${path}-${v.width}.webp`)
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, v.file)
      }
      await db.savePhoto({
        venue_id: job.venue,
        kind: job.kind,
        path,
        widths: variants.map((v) => v.width),
        width: largest.width,
        height: largest.height,
        color,
        alt: job.alt,
        credit: credit ?? null,
        licence: job.licence ?? commons?.licence ?? null,
        source,
        taken_on: job.taken ?? null,
        approved: true,
      })
      console.log(`✓ ${path}: ${sizes}${credited}`)
    } catch (e) {
      failed++
      console.error(`✗ ${job.venue}: ${(e as Error).message}`)
    }
  }
  if (failed) process.exitCode = 1
}
