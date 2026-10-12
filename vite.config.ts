/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

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

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => ({
  plugins: [react(), tailwindcss()],
  define: { 'import.meta.env.VITE_GITHUB_STARS': JSON.stringify(mode === 'test' ? null : await githubStars()) },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
}))
