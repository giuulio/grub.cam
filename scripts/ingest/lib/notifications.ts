import { execFileSync } from 'node:child_process'
import { SITE_URL } from '../../../src/lib/site.ts'
import type { Submission } from './db.ts'

/** Deliberately excludes evidence, submitted words, model output and sender identity. */
export type SubmissionNotice = Pick<Submission, 'id' | 'venue_id' | 'site' | 'kind' | 'topic' | 'created_at'>
const WORDS: Record<SubmissionNotice['kind'], string> = { menu: 'menu', prices: 'price list', hours: 'hours', photo: 'venue photo', other: 'correction' }
const marker = (id: string) => `<!-- grub-submission:${id} -->`

export function noticeBody(s: SubmissionNotice): string {
  // A venue's, or (a photo for its page's banner) a site's own
  const subject = s.venue_id ?? s.site
  return `New ${s.venue_id ? WORDS[s.kind] : 'site photo'}${s.topic ? ` (${s.topic})` : ''} submitted for [${subject}](${SITE_URL}/${subject}).\n\nRead privately with \`npm run submissions -- show ${s.id}\`.\n\n${marker(s.id)}`
}

type Delivery = {
  existing(): Promise<string[]>
  post(body: string): Promise<void>
  acknowledge(id: string): Promise<void>
}

/** A comment marker closes the retry window between posting to GitHub and acknowledging in Supabase. */
export async function deliverNotices(rows: SubmissionNotice[], delivery: Delivery): Promise<number> {
  if (!rows.length) return 0
  const comments = await delivery.existing()
  let posted = 0
  for (const s of rows) {
    if (!comments.some((body) => body.includes(marker(s.id)))) {
      const body = noticeBody(s)
      await delivery.post(body)
      comments.push(body)
      posted++
    }
    await delivery.acknowledge(s.id)
  }
  return posted
}

/** Workflow token posts as github-actions[bot], so the maintainer receives the subscribed issue's notifications. */
export function githubDelivery(issue: string, acknowledge: Delivery['acknowledge']): Delivery {
  if (!/^\d+$/.test(issue)) throw new Error('notify needs the issue number')
  const repo = process.env.GITHUB_REPOSITORY
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Set GITHUB_REPOSITORY (owner/repo)')
  const endpoint = `repos/${repo}/issues/${issue}/comments`
  const gh = (args: string[], input?: string) => execFileSync('gh', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'] })
  return {
    async existing() {
      const pages = JSON.parse(gh(['api', '--paginate', '--slurp', `${endpoint}?per_page=100`])) as { body: string; user: { login: string } }[][]
      return pages.flat().filter((c) => c.user.login === 'github-actions[bot]').map((c) => c.body)
    },
    async post(body) {
      gh(['api', '--method', 'POST', endpoint, '--input', '-'], JSON.stringify({ body }))
    },
    acknowledge,
  }
}
