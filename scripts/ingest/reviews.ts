// Usage: npm run reviews -- list [--all]          <- the reviews waiting for a person (or every one), with their words and who wrote them
//        npm run reviews -- approve <id>          <- publish one the check held back
//        npm run reviews -- hide <id> "why"       <- take one down (it stays down, even if its author changes it)
// Members' reviews of venues (`reviews`, migration 0030), written through the submit function: a rating alone, or
// words that pass its check, are published straight away; words that don't wait here. A venue shows its reviews only
// once it has 5 published. Who wrote one is never shown on the site; it's printed here for you alone.
import { parseArgs } from 'node:util'
import { connect, type Review } from './lib/db.ts'

const { values, positionals } = parseArgs({ options: { all: { type: 'boolean' } }, allowPositionals: true })
const [command, ...args] = positionals
const db = connect()
const short = (id: string) => id.slice(0, 8)

async function one(id: string): Promise<Review> {
  const hits = (await db.reviews()).filter((r) => r.id.startsWith(id))
  if (hits.length !== 1) throw new Error(hits.length ? `ambiguous id "${id}"` : `no review "${id}"`)
  return hits[0]
}

switch (command) {
  case 'list': {
    const rows = await db.reviews(values.all ? {} : { status: ['needs_review'] })
    if (!rows.length) console.log(values.all ? 'no reviews' : 'no reviews waiting')
    for (const r of rows) {
      console.log(`${short(r.id)}  ${r.status.padEnd(12)} ${'★'.repeat(r.rating).padEnd(5, '☆')}  ${r.venue_id}  ${r.updated_at.slice(0, 16).replace('T', ' ')}  ${(await db.userEmail(r.user_id)) ?? r.user_id}`)
      if (r.review_note) console.log(`          why: ${r.review_note}`)
      if (r.body) console.log(`          "${r.body.replace(/\n/g, ' ')}"`)
    }
    break
  }
  case 'approve': {
    const r = await one(args[0] ?? '')
    await db.updateReview(r.id, { status: 'published', review_note: null })
    console.log(`✓ ${short(r.id)} published`)
    break
  }
  case 'hide': {
    const r = await one(args[0] ?? '')
    await db.updateReview(r.id, { status: 'hidden', review_note: args[1] ?? 'hidden by hand' })
    console.log(`✓ ${short(r.id)} hidden${args[1] ? `: ${args[1]}` : ''}`)
    break
  }
  default:
    console.error('usage: npm run reviews -- list [--all] | approve <id> | hide <id> "why"')
    process.exitCode = 1
}
