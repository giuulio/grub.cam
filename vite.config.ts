/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * The repository's GitHub stars, read once per build (the site rebuilds after every ingest run), so visitors' browsers
 * never call GitHub. Null when GitHub can't be reached; the header then shows the link without a count, and the build
 * log says why. With `GITHUB_TOKEN` (a build variable: a fine-grained token that only reads public repositories) it
 * asks signed in: unsigned, GitHub answers 60 calls an hour per address, which Cloudflare's shared build machines
 * often use up before ours asks.
 */
async function githubStars(): Promise<number | null> {
  const token = process.env.GITHUB_TOKEN
  try {
    // The repository in REPO_URL (src/lib/site.ts)
    const res = await fetch('https://api.github.com/repos/giuulio/grub.cam', {
      headers: { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      const limited = res.headers.get('x-ratelimit-remaining') === '0'
      console.warn(`GitHub stars left out: ${res.status}${limited ? `, rate limit used up${token ? '' : ' (set GITHUB_TOKEN)'}` : ''}`)
      return null
    }
    const { stargazers_count } = (await res.json()) as { stargazers_count?: number }
    return typeof stargazers_count === 'number' ? stargazers_count : null
  } catch (e) {
    console.warn(`GitHub stars left out: ${(e as Error).message}`)
    return null
  }
}

/**
 * Cloudflare Web Analytics, added to built pages only, so the dev server's visits aren't counted. Its beacon sets no
 * cookie and keeps nothing on the device; it reports each page view (path, referrer, browser, country) and its load
 * times. Added here rather than by Cloudflare's automatic setup, which was set to leave out EU visitors and gave pages
 * no beacon in the UK either, so it counted almost none of ours (Terms says what it records).
 */
const analytics: Plugin = {
  name: 'cloudflare-web-analytics',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'script',
      attrs: { defer: true, src: 'https://static.cloudflareinsights.com/beacon.min.js', 'data-cf-beacon': '{"token": "635adc34b1c84343bb04dded5b0d7bf6"}' },
      injectTo: 'body',
    },
  ],
}

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => ({
  plugins: [react(), tailwindcss(), analytics],
  define: { 'import.meta.env.VITE_GITHUB_STARS': JSON.stringify(mode === 'test' ? null : await githubStars()) },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
}))
