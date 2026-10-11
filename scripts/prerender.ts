// Runs after `vite build` (npm run build): renders every page into dist/ as real HTML with its own <head>
// (title, description, canonical, schema.org data), plus sitemap.xml, llms.txt, llms-full.txt and 404.html,
// from what's in Supabase now. The browser shows that HTML until live data has loaded, then the app takes over.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createServer } from 'vite'
import { SITE_URL } from '../src/lib/site.ts'

// src/entry-server.tsx, typed here because the scripts tsconfig doesn't compile JSX
type Page = { path: string; description: string }
type Entry = {
  load(): Promise<unknown>
  /** `head`: what React hoisted besides the title (a banner's preload), for the <head> */
  render(url: string, data: unknown): { title: string; head: string; html: string }
  pages(data: unknown, date: string): Page[]
  headTags(page: Page, title: string): string
  sitemap(pages: Page[], lastmod: string): string
  llmsTxt(data: unknown): string
  llmsFullTxt(data: unknown, date: string, builtAt: string): string
}

const DIST = 'dist'
const escapeText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const now = new Date()
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(now) // YYYY-MM-DD
const builtAt = now.toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short' })

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'warn' })
try {
  const entry = (await vite.ssrLoadModule('/src/entry-server.tsx')) as Entry
  // Each page brings its own description and twitter:card
  const template = readFileSync(join(DIST, 'index.html'), 'utf8').replace(/\s*<meta name="(?:description|twitter:card)"[^>]*>/g, '')
  const write = (file: string, body: string) => {
    mkdirSync(dirname(join(DIST, file)), { recursive: true })
    writeFileSync(join(DIST, file), body)
  }
  const page = (url: string, head: (title: string) => string) => {
    const { title, head: hoisted, html } = entry.render(url, data)
    if (!title) throw new Error(`${url}: no <title> in the rendered page`)
    return template
      .replace(/<title>.*?<\/title>/, `<title>${escapeText(title)}</title>\n    ${head(title)}${hoisted ? `\n    ${hoisted}` : ''}`)
      .replace('<div id="root"></div>', `<div id="root">${html}</div>`)
  }

  const data = await entry.load()
  const list = entry.pages(data, date)
  // "/" -> index.html, "/jesus" -> jesus.html, "/jesus/caff" -> jesus/caff.html (served without the extension)
  for (const p of list) write(p.path === '/' ? 'index.html' : `${p.path.slice(1)}.html`, page(p.path, (title) => entry.headTags(p, title)))
  write('404.html', page('/404', () => '<meta name="robots" content="noindex" />'))
  write('sitemap.xml', entry.sitemap(list, date))
  write('llms.txt', entry.llmsTxt(data))
  write('llms-full.txt', entry.llmsFullTxt(data, date, builtAt))
  console.log(`prerendered ${list.length} pages, 404.html, sitemap.xml, llms.txt, llms-full.txt (${date})`)
  await indexNow(list.map((p) => SITE_URL + p.path), write)
} finally {
  await vite.close()
}

/**
 * Tells the search engines on IndexNow (Bing, Yandex, Seznam, Naver and others share one submission) that these pages
 * changed, so they're crawled soon after each build rather than when a crawler next happens by. The key is the
 * INDEXNOW_KEY build variable (8–128 hex characters, yours to make up); its file is written to the site's root, which is
 * how the engines check the submission is ours. Nothing is sent without the key. Google doesn't take IndexNow: it
 * reads the sitemap, submitted once in Search Console.
 */
async function indexNow(urls: string[], write: (file: string, body: string) => void) {
  const key = process.env.INDEXNOW_KEY
  if (!key) return
  if (!/^[A-Za-z0-9-]{8,128}$/.test(key)) {
    console.error('INDEXNOW_KEY must be 8–128 letters, digits or dashes; not sent')
    return
  }
  write(`${key}.txt`, key)
  const host = new URL(SITE_URL).host
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, keyLocation: `${SITE_URL}/${key}.txt`, urlList: urls }),
      signal: AbortSignal.timeout(10000),
    })
    // 200: taken; 202: taken, the key file not yet checked (the first time, before this build is live)
    console.log(`IndexNow: ${res.status} for ${urls.length} URLs`)
  } catch (e) {
    console.error(`IndexNow: ${(e as Error).message}`)
  }
}
