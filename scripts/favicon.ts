// Write public/favicon.svg from the mark (src/lib/mark.ts), then the browser/search PNG, iOS icon, the 512px logo
// for search engines and the legacy ICO from it.
import { readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { MARK_PATH } from '../src/lib/mark.ts'

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
