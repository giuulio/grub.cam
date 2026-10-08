// Runs after `vite build` (npm run build): renders every page into dist/ as real HTML with its own <head>
// (title, description, canonical, schema.org data), plus sitemap.xml, llms.txt, llms-full.txt and 404.html,
// from what's in Supabase now. The browser shows that HTML until live data has loaded, then the app takes over.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createServer } from 'vite'

// src/entry-server.tsx, typed here because the scripts tsconfig doesn't compile JSX
type Page = { path: string; description: string }
type Entry = {
  load(): Promise<unknown>
  render(url: string, data: unknown): { title: string; html: string }
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
  const template = readFileSync(join(DIST, 'index.html'), 'utf8').replace(/\s*<meta name="description"[^>]*>/, '')
  const write = (file: string, body: string) => {
    mkdirSync(dirname(join(DIST, file)), { recursive: true })
    writeFileSync(join(DIST, file), body)
  }
  const page = (url: string, head: (title: string) => string) => {
    const { title, html } = entry.render(url, data)
    return template
      .replace(/<title>.*?<\/title>/, `<title>${escapeText(title)}</title>\n    ${head(title)}`)
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
} finally {
  await vite.close()
}
