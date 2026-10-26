import type { Site, Venue } from './types.ts'

export const SITE_NAME = 'grub.cam'
/** Canonical origin, for links that leave the page: canonical URLs, sitemap, structured data, llms.txt. */
export const SITE_URL = 'https://grub.cam'
export const SITE_DESCRIPTION = "Explore Cambridge's college and University food map: dining hall menus, cafés, bars and formal halls, with published opening hours and prices."
export const REPO_URL = 'https://github.com/giuulio/grub.cam'
export const ISSUES_URL = `${REPO_URL}/issues`

export const sitePath = (s: Pick<Site, 'slug'>) => `/${s.slug}`
export const venuePath = (v: Pick<Venue, 'slug' | 'site'>) => `/${v.site.slug}/${v.slug}`
/** The way to add what's missing: /send, with the venue and what it is filled in. */
export const sendPath = (v: Pick<Venue, 'id'>, kind: 'menu' | 'prices' | 'hours' | 'photo' | 'other', more: Record<string, string> = {}) =>
  `/send?${new URLSearchParams({ venue: v.id, kind, ...more })}`
/** Where a better photo of a site itself (its page's banner) is sent from. */
export const sitePhotoPath = (s: Pick<Site, 'slug'>) => `/send?${new URLSearchParams({ site: s.slug, kind: 'photo' })}`

/** "Jesus" -> "Jesus College"; Peterhouse and the Halls already are names; University sites are as stored. */
export function siteName(s: Pick<Site, 'name' | 'kind'>): string {
  return s.kind === 'college' && !/(College|Hall|Peterhouse)$/.test(s.name) ? `${s.name} College` : s.name
}

/** Verified names from Supabase, without spelling variants already covered by the displayed name. */
export function alternateNames(subject: { name: string; aliases?: string[] }): string[] {
  const normalize = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const name = ` ${normalize(subject.name)} `
  const seen = new Set<string>()
  return (subject.aliases ?? []).map((s) => s.trim()).filter((alias) => {
    const key = normalize(alias)
    if (!key || seen.has(key) || name.includes(` ${key} `)) return false
    seen.add(key)
    return true
  })
}

/** A short, familiar college name alongside its official name, e.g. St Edmund's College (Eddies). */
export function siteSearchName(s: Site): string {
  const alias = alternateNames(s)[0]
  return `${siteName(s)}${alias ? ` (${alias})` : ''}`
}
