// Audit the actual deployment output, including routes that only exist in Supabase.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'node-html-parser'
import sharp from 'sharp'
import { SITE_URL } from '../src/lib/site.ts'

const dist = 'dist'
const xml = readFileSync(join(dist, 'sitemap.xml'), 'utf8')
const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1])
assert(urls.length > 0, 'Empty sitemap')
assert.equal(new Set(urls).size, urls.length, 'Duplicate sitemap URLs')
const titles = new Set<string>()
for (const url of urls) {
  const parsed = new URL(url)
  assert.equal(parsed.origin, SITE_URL, `Wrong sitemap origin: ${url}`)
  const file = parsed.pathname === '/' ? 'index.html' : `${parsed.pathname.slice(1)}.html`
  const html = parse(readFileSync(join(dist, file), 'utf8'))
  const head = html.querySelector('head')!
  assert(head, `Missing head: ${url}`)
  const title = head.querySelector('title')?.text.trim()
  assert(title, `Missing title in head: ${url}`)
  assert(!titles.has(title), `Duplicate title: ${url}`)
  titles.add(title)
  assert.equal(html.querySelectorAll('title').length, 1, `Multiple titles: ${url}`)
  assert.equal(html.querySelectorAll('link[rel="canonical"]').length, 1, `Canonical count: ${url}`)
  assert.equal(head.querySelector('link[rel="canonical"]')?.getAttribute('href'), url, `Wrong canonical: ${url}`)
  assert(head.querySelector('meta[name="description"]')?.getAttribute('content')?.trim(), `Missing description: ${url}`)
  assert(!/\b(noindex|none)\b/i.test(head.querySelector('meta[name="robots"]')?.getAttribute('content') ?? ''), `Unindexable page: ${url}`)
  assert.equal(html.querySelectorAll('main h1').length, 1, `Expected one main heading: ${url}`)
  assert(html.querySelectorAll('main a[href]').length, `No crawlable links: ${url}`)
  for (const script of html.querySelectorAll('script[type="application/ld+json"]')) JSON.parse(script.text)
  assert(head.querySelector('link[rel="icon"][href^="/favicon.png"]'), `Missing favicon: ${url}`)
}
const icon = await sharp(join(dist, 'favicon.png')).metadata()
assert.equal(icon.width, icon.height, 'Favicon must be square')
assert((icon.width ?? 0) >= 48, 'Favicon too small for search results')
for (const file of ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'logo.png']) assert(readFileSync(join(dist, file)).length)
for (const file of ['404.html', 'send.html']) {
  const excluded = parse(readFileSync(join(dist, file), 'utf8'))
  assert.equal(excluded.querySelector('meta[name="robots"]')?.getAttribute('content'), 'noindex', file)
}
assert(readFileSync(join(dist, 'robots.txt'), 'utf8').includes(`Sitemap: ${SITE_URL}/sitemap.xml`))
console.log(`SEO checked: ${urls.length} pages, unique titles, canonical URLs, descriptions, headings, links, JSON-LD, favicon and 404`)
