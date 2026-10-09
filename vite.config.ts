/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * The repository's GitHub stars, read once per build (the site rebuilds after every ingest run), so visitors' browsers
 * never call GitHub. Null when GitHub can't be reached; the header then shows the link without a count.
 */
async function githubStars(): Promise<number | null> {
  try {
    // The repository in REPO_URL (src/lib/site.ts)
    const res = await fetch('https://api.github.com/repos/giuulio/grub.cam', { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(3000) })
    if (!res.ok) return null
    const { stargazers_count } = (await res.json()) as { stargazers_count?: number }
    return typeof stargazers_count === 'number' ? stargazers_count : null
  } catch {
    return null
  }
}

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => ({
  plugins: [react(), tailwindcss()],
  define: { 'import.meta.env.VITE_GITHUB_STARS': JSON.stringify(mode === 'test' ? null : await githubStars()) },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
}))
