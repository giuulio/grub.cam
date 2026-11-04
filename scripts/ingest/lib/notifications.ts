import { execFileSync } from 'node:child_process'
import { SITE_URL } from '../../../src/lib/site.ts'
import type { Submission } from './db.ts'

/** Deliberately excludes evidence, submitted words, model output and sender identity. */
export type SubmissionNotice = Pick<Submission, 'id' | 'venue_id' | 'site' | 'kind' | 'topic' | 'created_at' | 'status'>

const MINUTE = 60000
/** Longer than a model takes to read a board: a menu still `received` after this had no model to read it */
const READING = 15 * MINUTE
/** Longer than the photos Action takes to publish: still `queued` after this, it's stuck */
const PUBLISHING = 2 * 60 * MINUTE

/**
 * Whether a submission has come to rest: published or turned back, waiting for a person, or stuck. One still being read,
 * confirmed or published hasn't, and is looked at again on the next run (pg_cron's, every ten minutes).
 */
export function settled(s: Pick<SubmissionNotice, 'kind' | 'status' | 'created_at'>, now = Date.now()): boolean {
  const age = now - Date.parse(s.created_at)
  if (s.status === 'received') return s.kind === 'other' || age > READING
  if (s.status === 'queued') return age > PUBLISHING
  return s.status !== 'transcribed'
}

/** Whether, at rest, it waits for a person: what's published or turned back needs no one. */
export const needsPerson = (s: Pick<SubmissionNotice, 'kind' | 'status' | 'created_at'>, now = Date.now()) => settled(s, now) && s.status !== 'approved' && s.status !== 'rejected'
const WORDS: Record<SubmissionNotice['kind'], string> = { menu: 'menu', prices: 'price list', hours: 'hours', photo: 'venue photo', other: 'correction' }
const marker = (id: string) => `<!-- grub-submission:${id} -->`

export function noticeBody(s: SubmissionNotice): string {
  // A venue's, or (a photo for its page's banner) a site's own
  const subject = s.venue_id ?? s.site
  const word = s.venue_id ? WORDS[s.kind] : 'site photo'
  const [lead, is, waits] = word === 'hours' ? ['Hours', 'are', 'wait'] : [`A ${word}`, 'is', 'waits']
  const stuck = s.status === 'queued' ? ` ${is} stuck in the publishing queue (check the photos Action)` : ` ${waits} for you`
  return `${lead}${s.topic ? ` (${s.topic})` : ''} for [${subject}](${SITE_URL}/${subject})${stuck}.\n\nRead privately with \`npm run submissions -- show ${s.id}\`.\n\n${marker(s.id)}`
}

type Delivery = {
  existing(): Promise<string[]>
  post(body: string): Promise<void>
  acknowledge(id: string): Promise<void>
}

/**
 * A comment for each submission that has come to rest waiting for a person, so GitHub emails you only then; what went
 * up or was turned back on its own is acknowledged without one, and what's still moving is left for the next run. A
 * comment marker closes the retry window between posting to GitHub and acknowledging in Supabase.
 */
export async function deliverNotices(rows: SubmissionNotice[], delivery: Delivery, now = Date.now()): Promise<number> {
  const due = rows.filter((s) => settled(s, now))
  if (!due.length) return 0
  const comments = due.some((s) => needsPerson(s, now)) ? await delivery.existing() : []
  let posted = 0
  for (const s of due) {
    if (needsPerson(s, now) && !comments.some((body) => body.includes(marker(s.id)))) {
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
