import type { Site, Venue } from './types.ts'

export const SITE_NAME = 'grub.cam'
/** Canonical origin, for links that leave the page: canonical URLs, sitemap, structured data, llms.txt. */
export const SITE_URL = 'https://grub.cam'
export const SITE_DESCRIPTION = "Opening hours, access and today's menus for every Cambridge college dining hall, café and bar, and the University's own cafés and canteens."
export const REPO_URL = 'https://github.com/giuulio/grub.cam'
export const ISSUES_URL = `${REPO_URL}/issues`

export const sitePath = (s: Pick<Site, 'slug'>) => `/${s.slug}`
export const venuePath = (v: Pick<Venue, 'slug' | 'site'>) => `/${v.site.slug}/${v.slug}`

/** "Jesus" -> "Jesus College"; Peterhouse and the Halls already are names; University sites are as stored. */
export function siteName(s: Pick<Site, 'name' | 'kind'>): string {
  return s.kind === 'college' && !/(College|Hall|Peterhouse)$/.test(s.name) ? `${s.name} College` : s.name
}
