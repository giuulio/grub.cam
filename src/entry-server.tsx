// Build-time rendering, loaded by scripts/prerender.ts through Vite: every page as HTML, plus what goes around it.
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router'
import App from './App.tsx'
import type { Data } from './lib/data.tsx'
import { splitHoisted } from './lib/seo.ts'

export { load } from './lib/data.tsx'
export { headTags, llmsFullTxt, llmsTxt, pages, sitemap } from './lib/seo.ts'

/** One page from build-time data: its <title> as text, the other tags React hoisted (for the <head>), and the body. */
export function render(url: string, data: Data): { title: string; head: string; html: string } {
  return splitHoisted(
    renderToString(
      <StaticRouter location={url}>
        <App data={{ status: 'ready', ...data, snapshot: true }} />
      </StaticRouter>,
    ),
  )
}
