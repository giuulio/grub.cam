// Where a venue's page links off the site, each link once. The top is the venue's own page; failing that, the page its
// menu comes from (Emmanuel's display is the most useful page about its Hall), unless that's a file to download. The
// college's general page is the college's, on its own page. Under the menu, the formal hall and the price list, each
// source is linked only when nothing above already has it.
import type { Venue, VenuePrice } from './types.ts'

/** A file to download (a PDF), not a page: under the menu, never at the top */
const isFile = (url: string) => /\.pdf(?:[?#]|$)|\/download\//i.test(url)
const key = (url: string) => url.replace(/^https?:\/\/(?:www\.)?/i, '').replace(/[/#?]+$/, '').toLowerCase()

export type VenueLinks = {
  /** The link under the venue's name: its own page (`menu` when that's also where its menu is), else its menu's page */
  top?: { href: string; menu: boolean }
  /** Where the menu comes from, when the top isn't it */
  menu?: string
  /** Formal hall's page, when nothing above is it */
  formal?: string
  /** Where the price list was posted, when nothing above is it */
  prices?: string
}

/** The first link a price list's lines name as their source */
export const pricesSource = (prices?: VenuePrice[]) => prices?.map((p) => p.source.match(/https?:\/\/[^\s)]+/)?.[0]).find(Boolean)

export function venueLinks(v: Pick<Venue, 'url' | 'menu_url' | 'formal' | 'prices'>): VenueLinks {
  const top = v.url ? { href: v.url, menu: !!v.menu_url && key(v.url) === key(v.menu_url) } : v.menu_url && !isFile(v.menu_url) ? { href: v.menu_url, menu: true } : undefined
  const shown = new Set(top ? [key(top.href)] : [])
  const once = (url?: string | null) => {
    if (!url || shown.has(key(url))) return undefined
    shown.add(key(url))
    return url
  }
  return { top, menu: once(v.menu_url), formal: once(v.formal?.url), prices: once(pricesSource(v.prices)) }
}
