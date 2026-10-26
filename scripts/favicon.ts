// Regenerate the browser/search PNG, iOS icon and legacy ICO after editing public/favicon.svg.
import { readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const svg = await readFile('public/favicon.svg')
await sharp(svg).resize(96, 96).png().toFile('public/favicon.png')
await sharp(svg).resize(180, 180).png().toFile('public/apple-touch-icon.png')

// ICO permits PNG frames. Include both common browser sizes, without a font or platform dependency.
const sizes = [16, 32, 48]
const frames = await Promise.all(sizes.map((size) => sharp(svg).resize(size, size).png().toBuffer()))
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
