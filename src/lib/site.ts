import type { Venue } from './types.ts'

export const SITE_NAME = 'grub.cam'
export const REPO_URL = 'https://github.com/giuulio/grub.cam'
export const ISSUES_URL = `${REPO_URL}/issues`

export const venuePath = (v: Pick<Venue, 'slug' | 'site'>) => `/${v.site.slug}/${v.slug}`
