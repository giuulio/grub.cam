// Build-time rendering, loaded by scripts/prerender.ts through Vite: every page as HTML, plus what goes around it.
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router'
import App from './App.tsx'
import type { Data } from './lib/data.tsx'

export { load } from './lib/data.tsx'
export { headTags, llmsFullTxt, llmsTxt, pages, sitemap } from './lib/seo.ts'

const unescape = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')

/** One page from build-time data. React puts the page's <title> first; it's returned separately, as text, for the <head>. */
export function render(url: string, data: Data): { title: string; html: string } {
  const out = renderToString(
    <StaticRouter location={url}>
      <App data={{ status: 'ready', ...data, snapshot: true }} />
    </StaticRouter>,
  )
  const m = out.match(/^<title>(.*?)<\/title>/)
  return { title: m ? unescape(m[1]) : '', html: m ? out.slice(m[0].length) : out }
}
