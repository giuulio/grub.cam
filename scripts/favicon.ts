// Write public/favicon.svg from the mark (src/lib/mark.ts), then the browser/search PNG, iOS icon, the 512px logo
// for search engines, the legacy ICO and the default link preview (og.png) from it.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { MARK_PATH, MARK_VIEWBOX } from '../src/lib/mark.ts'
import { screenshot } from './ingest/lib/browser.ts'

// Cambridge Blue fork on a Dark Blue tile
await writeFile(
  'public/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">\n  <rect width="64" height="64" rx="14" fill="#133844"/>\n  <path d="${MARK_PATH}" fill="#8ee8d8"/>\n</svg>\n`,
)
const svg = await readFile('public/favicon.svg')
await sharp(svg, { density: 72 * 8 }).resize(96, 96).png().toFile('public/favicon.png')
await sharp(svg, { density: 72 * 8 }).resize(180, 180).png().toFile('public/apple-touch-icon.png')
await sharp(svg, { density: 72 * 8 }).resize(512, 512).png().toFile('public/logo.png')

// ICO permits PNG frames. Include both common browser sizes, without a font or platform dependency.
const sizes = [16, 32, 48]
const frames = await Promise.all(sizes.map((size) => sharp(svg, { density: 72 * 8 }).resize(size, size).png().toBuffer()))
const header = Buffer.alloc(6 + sizes.length * 16)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(sizes.length, 4)
let offset = header.length
for (const [i, frame] of frames.entries()) {
  const entry = 6 + i * 16
  header[entry] = sizes[i]
  header[entry + 1] = sizes[i]
  header.writeUInt16LE(1, entry + 4)
  header.writeUInt16LE(32, entry + 6)
  header.writeUInt32LE(frame.length, entry + 8)
  header.writeUInt32LE(offset, entry + 12)
  offset += frame.length
}
await writeFile('public/favicon.ico', Buffer.concat([header, ...frames]))

// The link preview for a page without a photo of its own (og.png, 1200 × 630): the mark and the name in Figtree on Dark
// Blue, drawn by headless Chrome so the self-hosted fonts render as on the site.
const fonts = 'node_modules/@fontsource-variable'
const card = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: Figtree; src: url(${pathToFileURL(`${fonts}/figtree/files/figtree-latin-wght-normal.woff2`)}) format('woff2'); font-weight: 300 900 }
@font-face { font-family: 'Public Sans'; src: url(${pathToFileURL(`${fonts}/public-sans/files/public-sans-latin-wght-normal.woff2`)}) format('woff2'); font-weight: 100 900 }
html, body { margin: 0; width: 1200px; height: 630px; background: #133844; overflow: hidden }
main { display: flex; align-items: center; gap: 56px; height: 100%; padding: 0 96px; box-sizing: border-box }
svg { height: 380px; flex: none }
h1 { margin: 0; font: 700 112px/1 Figtree; color: #fff; letter-spacing: -0.02em }
p { margin: 28px 0 0; font: 400 38px/1.3 'Public Sans'; color: #8ee8d8; max-width: 700px }
</style><main><svg viewBox="${MARK_VIEWBOX}"><path d="${MARK_PATH}" fill="#8ee8d8"/></svg><div><h1>grub.cam</h1><p>Today’s menus, cafés, bars and formal hall across Cambridge colleges</p></div></main>`
const dir = await mkdtemp(join(tmpdir(), 'grub-og-'))
try {
  await writeFile(join(dir, 'card.html'), card)
  await writeFile('public/og.png', await sharp(await screenshot(pathToFileURL(join(dir, 'card.html')).href, 1200, 630)).png().toBuffer())
} finally {
  await rm(dir, { recursive: true, force: true })
}
