// Pages that only a browser draws (Clare Hall's Sway, Lucy Cavendish's Canva): headless Chrome renders them, for
// their text or a screenshot. These are JavaScript apps, not bot checks; a page that challenges a browser is left
// alone. Chrome is CHROME_PATH, or wherever it's installed (GitHub's Ubuntu runners have google-chrome).
import { execFile } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
]
const TIMEOUT_MS = 90_000

function chrome(): string {
  const found = CANDIDATES.find((p): p is string => !!p && existsSync(p))
  if (!found) throw new Error('no Chrome to render the page with (set CHROME_PATH)')
  return found
}

async function withChrome<T>(argsIn: (dir: string) => string[], then: (stdout: string, dir: string) => T): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'grub-chrome-'))
  const args = argsIn(dir)
  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      const flags = [
        '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
        `--user-data-dir=${join(dir, 'profile')}`, '--virtual-time-budget=15000',
        ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []),
      ]
      execFile(chrome(), [...flags, ...args], { timeout: TIMEOUT_MS, maxBuffer: 64 << 20 }, (err, out) =>
        err ? reject(new Error(`Chrome couldn't render ${args.at(-1)}: ${err.message.split('\n')[0]}`)) : resolve(out),
      )
    })
    return then(stdout, dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** The page's HTML once its scripts have run. */
export const renderedHtml = (url: string) => withChrome(() => ['--dump-dom', url], (html) => html)

/** A PNG of the page, `width` × `height` CSS pixels. */
export const screenshot = (url: string, width = 1600, height = 2200) =>
  withChrome((dir) => [`--window-size=${width},${height}`, `--screenshot=${join(dir, 'page.png')}`, url], (_, dir) => new Uint8Array(readFileSync(join(dir, 'page.png'))))
