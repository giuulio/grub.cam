import { addDays, longDate } from '../lib/dates.ts'
import type { DocRef, DocSource } from '../lib/docs.ts'
import { fetchText } from '../lib/http.ts'

const WEEKS = ['this', 'next'] as const

/**
 * The PDF a "Hall Menu – This/Next Week" page links. Its link carries a token that changes on every load
 * (`refresh`), so the document is known by its filename ("Hall-menu-181026.pdf": the week ending Sun 18 Oct 2026)
 * and is fetched only when its upload stamp (`ind`) changes.
 */
export function trinityDocument(html: string, page: string): DocRef | undefined {
  const href = html.match(/href="([^"]*[?&]wpdmdl=[^"]*)"/)?.[1]?.replace(/&amp;/g, '&')
  if (!href) return undefined
  const url = new URL(href, page)
  const filename = url.searchParams.get('filename') ?? `hall-menu-${url.searchParams.get('wpdmdl')}.pdf`
  const ending = filename.match(/(\d{2})(\d{2})(\d{2})\.pdf$/i)
  const sunday = ending ? `20${ending[3]}-${ending[2]}-${ending[1]}` : undefined
  return {
    key: filename,
    url: url.href,
    kind: 'pdf',
    version: `${url.searchParams.get('wpdmdl')}:${url.searchParams.get('ind')}:${filename}`,
    label: sunday ? `Trinity's hall menu for ${longDate(addDays(sunday, -6))} to ${longDate(sunday)}` : `Trinity's hall menu (${filename})`,
  }
}

/** This week's and next week's hall menus, a PDF each, from two download pages (weekly). */
export const trinity: DocSource = {
  async documents() {
    const refs: DocRef[] = []
    for (const w of WEEKS) {
      const page = `https://www.trin.cam.ac.uk/download/hall-menu-${w}-week/`
      const ref = trinityDocument(await fetchText(page), page)
      if (ref && !refs.some((r) => r.key === ref.key)) refs.push(ref)
    }
    return refs
  },
  guide:
    'Read what the rendered page shows, not text hidden behind it: these PDFs can keep a removed menu under a blank meal or a notice. A meal the page says isn\'t served ("No dinner – UG freshers formal hall") is that meal\'s cancellation, its line with the notice as a note and no dishes, whatever dishes sit near it. A line that runs on to the next ("Roast red onion & butternut / squash with garlic & thyme") is one dish. Keep its codes as printed, in brackets after the dish: (V), (VG), (wf), (df), (GF).',
}
