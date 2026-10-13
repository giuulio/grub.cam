// Usage: npm run submissions -- list [--all]
//        npm run submissions -- show <id> [--dir ~/grub-data/submissions]   <- saves the photo and prints the prompt to paste into a chat model
//        npm run submissions -- transcribe <id> file.txt                    <- the model's (or your) text for it
//        npm run submissions -- approve <id> [--keep-hours] [--dry]         <- parses the text and saves it; replaces the venue's hours unless --keep-hours
//        npm run submissions -- approve --trusted [--dry]                   <- every contributor's row waiting (the ingest Action runs this)
//        npm run submissions -- photos [--dry]                              <- every member's photo queued (the photos Action runs this)
//        npm run submissions -- live [--wait 600]                           <- turns on the published photos the site now serves (after the commit's deploy)
//        npm run submissions -- publish [--dry]                             <- every member's menu, price list and hours queued, checked and published (the same Action; `menus` is the old name)
//        npm run submissions -- reject <id> "why"                           <- a published photo or menu is taken down again, a price list's or hours' predecessor put back
//        npm run submissions -- digest                                      <- what's waiting, as Markdown for the review issue (the queue Action)
//        npm run submissions -- notify <issue>                              <- announce every new receipt on GitHub (the queue Action)
//        npm run submissions -- smoke [--venue v] [--photo f.jpg [--site s]] [--review] <- sends something in end to end as a throwaway member, then removes it (smoke.ts)
// The queue the `submit` Edge Function fills (supabase/functions/submit). A row's `transcription` is a complete file
// in the ingest:manual (menu), ingest:prices (prices) or ingest:hours (hours) format; approve parses it with those same
// parsers, so what can be saved by hand can be saved from here, and nothing else can.
//
// A member's menu (kind menu), once they've confirmed its text, is queued by the submit function and published by the
// photos Action without a person (`menus`), when it reads, is for the venue it was sent for, its days are yesterday
// or later (no future cutoff), and the venue's menu isn't fetched by a script; otherwise it waits for a person, saying why. A
// member's price list or hours goes the same way (since 0032), when it reads and is for its venue: the submit function
// has already had a model check any reading the sender edited. A price list adds to the venue's (0041): its sections
// replace the ones under the same headings and the others stay, so two boards sent one after the other both go up.
// What it replaces is kept with the row (`replaced`), and rejecting it puts that back where it's still the venue's: a
// price list's sections that are still its own, hours unless they've been replaced again since.
//
// A member's photo of the venue (kind photo), or of a site itself for its page's banner (`site`, 0040), is published as
// ingest:photo would: its sizes written to public/photos (commit them; the photos Action does) and its row added ahead
// of the venue's (or site's) others, credited to the sender's name under CC BY 4.0, the licence the form grants, but
// unapproved until `live` finds its files served, so the page keeps its old photo until the deploy is done. The submit
// function queues the ones a model has passed.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { header, prompt, type Transcribable } from '../../supabase/functions/_shared/formats.ts'
import { connect, type Submission } from './lib/db.ts'
import { parseHours } from './hours.ts'
import { parseManual } from './manual.ts'
import { makeVariants, newPhotoPath, writeVariants } from './photo.ts'
import { mergeList, parsePrices, replaceSections, savedList, sectionKey, unnamedColumns } from './prices.ts'
import { SITE_URL } from '../../src/lib/site.ts'
import { deliverNotices, githubDelivery } from './lib/notifications.ts'

/** The licence a member grants by sending a photo of a venue (src/pages/Send.tsx says so). */
const MEMBER_LICENCE = 'CC BY 4.0'

const { values, positionals } = parseArgs({
  options: { all: { type: 'boolean' }, trusted: { type: 'boolean' }, dry: { type: 'boolean' }, 'keep-hours': { type: 'boolean' }, dir: { type: 'string' }, wait: { type: 'string' }, venue: { type: 'string' }, site: { type: 'string' }, photo: { type: 'string' }, review: { type: 'boolean' } },
  allowPositionals: true,
})
const [command, ...args] = positionals
const db = connect()

const short = (id: string) => id.slice(0, 8)
/** What it's about, as its page's path: a venue's id, or a site's slug (a photo for its page's banner, 0040) */
const subjectOf = (s: Pick<Submission, 'venue_id' | 'site'>) => s.venue_id ?? s.site ?? ''
/** The venue a menu, price list, hours or correction is for: only a photo can be a site's */
const venueOf = (s: Submission) => {
  if (!s.venue_id) throw new Error(`${short(s.id)} is a photo of ${s.site}, not of a venue`)
  return s.venue_id
}
/** Every photo sent with it, first to last */
const photosOf = (s: Submission) => s.photo_paths ?? (s.photo_path ? [s.photo_path] : [])
const photoWord = (s: Submission) => (photosOf(s).length > 1 ? `${photosOf(s).length} photos` : photosOf(s).length ? 'photo' : '')
const line = (s: Submission) =>
  `${short(s.id)}  ${s.status.padEnd(12)} ${(s.topic ? `${s.kind}:${s.topic}` : s.kind).padEnd(14)} ${subjectOf(s).padEnd(40)} ${s.created_at.slice(0, 16).replace('T', ' ')}${photoWord(s) ? `  ${photoWord(s)}` : ''}${s.contributor_id ? '  contributor' : ''}${s.transcribed_by ? `  by ${s.transcribed_by}` : ''}${s.review_note ? `  — ${s.review_note}` : ''}`

async function one(id: string): Promise<Submission> {
  const rows = await db.submissions({})
  const hits = rows.filter((r) => r.id === id || r.id.startsWith(id))
  if (hits.length !== 1) throw new Error(hits.length ? `ambiguous id "${id}"` : `no submission "${id}"`)
  return hits[0]
}

/** A member's photo: its sizes into public/photos, then its row, first among the venue's photos so it's the one shown. */
async function publishPhoto(s: Submission, dry: boolean): Promise<string> {
  if (!s.photo_path) throw new Error('no photo with it')
  const { variants, color } = await makeVariants(Buffer.from(await db.submissionPhoto(s.photo_path)))
  const subject = subjectOf(s)
  const path = newPhotoPath(subject)
  const largest = variants.at(-1)!
  const sizes = `${variants.map((v) => v.width).join('/')} px, ${s.credit ?? 'no name'}`
  if (dry) return `${path}: ${sizes}`
  writeVariants(path, variants)
  // Its alt text is the model's; failing that, what it's of
  const of = s.venue_id ? await db.venue(s.venue_id).then((v) => `${v.name}, ${v.siteName}`) : await db.site(subject).then((x) => x.name)
  await db.savePhoto(
    {
      subject,
      kind: 'venue',
      path,
      widths: variants.map((x) => x.width),
      width: largest.width,
      height: largest.height,
      color,
      alt: s.alt || of,
      credit: s.credit,
      licence: MEMBER_LICENCE,
      source: 'sent in on grub.cam',
      taken_on: s.created_at.slice(0, 10),
      // Shown once its files are served (`live`): approved now, the venue would show its tile, not its old photo, until the deploy
      approved: false,
      submission_id: s.id,
    },
    { first: true },
  )
  return `${path}: ${sizes}; the ${s.venue_id ? 'venue' : 'site'}'s photo once deployed (commit public/photos; \`live\` turns it on)`
}

/**
 * Turns on each member's photo whose files the site now serves, checking every 15 s for up to `waitMs` (the deploy
 * after the photos commit takes a few minutes). Whatever isn't served by then waits for the next run, and the run fails
 * so the Action says so.
 */
async function live(waitMs: number) {
  const base = process.env.VITE_PHOTOS_URL ?? `${SITE_URL}/photos`
  let pending = await db.photosAwaitingDeploy()
  if (!pending.length) return console.log('no photos waiting for their deploy')
  const until = Date.now() + waitMs
  for (;;) {
    const served = await Promise.all(pending.map(async (p) => (await fetch(`${base}/${p.path}-${p.widths[0]}.webp?check=${Date.now()}`, { method: 'HEAD' }).catch(() => null))?.ok ?? false))
    for (const p of pending.filter((_, i) => served[i])) {
      await db.approvePhoto(p.id)
      console.log(`✓ ${short(p.submission_id)} ${subjectOf(p)}: photo served, now shown`)
    }
    pending = pending.filter((_, i) => !served[i])
    if (!pending.length) return
    if (Date.now() > until) break
    await new Promise((r) => setTimeout(r, 15000))
  }
  for (const p of pending) console.error(`✗ ${short(p.submission_id)} ${subjectOf(p)}: ${base}/${p.path} not served yet; the next run checks again`)
  process.exitCode = 1
}

/** Parses a transcription with its kind's parser and saves it. Returns what was saved, for the log line. */
async function publish(s: Submission, dry: boolean): Promise<string> {
  if (s.kind === 'photo') return publishPhoto(s, dry)
  if (!s.transcription) throw new Error('no transcription yet (show it, then transcribe)')
  const method = s.contributor_id ? 'contributor' : 'user'
  if (s.kind === 'menu') {
    const m = parseManual(s.transcription)
    if (m.venue !== s.venue_id) throw new Error(`transcription is for ${m.venue}, the submission for ${s.venue_id}`)
    const dishes = m.days.reduce((n, d) => n + d.items.length, 0)
    if (!dry) {
      await db.saveMenu(m.venue, m.source_url, m.fetched_at, method, m.days)
      await db.logRun({ venue_id: m.venue, method, started_at: new Date().toISOString(), status: m.days.length ? 'ok' : 'empty', days: m.days.length, dishes })
    }
    return `${m.days.length} services, ${dishes} dishes (${m.days.map((d) => `${d.date} ${d.service}`).join(', ')})`
  }
  if (s.kind === 'prices') {
    const p = parsePrices(s.transcription)
    if (p.venue !== s.venue_id) throw new Error(`transcription is for ${p.venue}, the submission for ${s.venue_id}`)
    const unnamed = unnamedColumns(p, (await db.priceTerms(p.venue))?.tiers)
    if (unnamed) throw new Error(unnamed)
    const before = await db.rowsOf('venue_prices', p.venue)
    const merged = mergeList(savedList(before), p)
    const kept = merged.length - p.items.length
    if (!dry) {
      await db.updateSubmission(s.id, { replaced: before })
      await db.saveList(p.venue, merged)
      const renamed = p.columns && (await db.nameColumns(p.venue, p.columns))
      if (renamed) await db.updateSubmission(s.id, { replaced_terms: renamed })
    }
    return `${p.items.length} prices, replacing ${before.length - kept}${kept ? `, keeping ${kept} in other sections` : ''}${p.columns ? `; columns ${p.columns.join(' | ')}` : ''}`
  }
  if (s.kind === 'hours') {
    const h = parseHours(s.transcription)
    if (h.venue !== s.venue_id) throw new Error(`transcription is for ${h.venue}, the submission for ${s.venue_id}`)
    const replace = !values['keep-hours']
    const before = await db.rowsOf('service_slots', h.venue)
    if (!dry) {
      await db.updateSubmission(s.id, { replaced: before })
      await db.saveHours(h, { replace, source_kind: 'reported', submission: s.id })
    }
    return `${h.slots.length} slots${replace ? `, replacing ${before.length}` : ', added'}`
  }
  throw new Error(`a ${s.kind} submission is not published from here: act on the note`)
}

/** London's date, `days` from today. */
const londonDate = (days = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(Date.now() + days * 86400000))

/**
 * Why a member's menu can't go up without a person, or null when it can: it must parse, be for its venue, cover only
 * yesterday or later, and be for a venue no script fetches (a script's menu is the source's own). No future cutoff.
 */
async function menuHold(s: Submission): Promise<string | null> {
  if (!s.transcription) return 'no text to publish'
  let m: ReturnType<typeof parseManual>
  try {
    m = parseManual(s.transcription)
  } catch (e) {
    return `it doesn't read: ${(e as Error).message}`
  }
  if (m.venue !== s.venue_id) return `the text is for ${m.venue}`
  if (!m.days.some((d) => d.items.length)) return 'no dishes in it'
  const from = londonDate(-1)
  const off = m.days.find((d) => d.date < from)
  if (off) return `it's for ${off.date}, before yesterday`
  if ((await db.venue(s.venue_id)).menu_scripted) return 'a script fetches this venue’s menu'
  return null
}

/**
 * Why a member's price list or hours can't go up without a person, or null when it can: it must read and be for its
 * venue, prices no more than £100, and a list with two prices a line must say whose each is (or the venue already does).
 */
async function listHold(s: Submission): Promise<string | null> {
  if (!s.transcription) return 'no text to publish'
  try {
    if (s.kind === 'prices') {
      const p = parsePrices(s.transcription)
      if (p.venue !== s.venue_id) return `the text is for ${p.venue}`
      if (!p.items.length) return 'no prices in it'
      const odd = p.items.find((i) => Math.max(i.price_gbp ?? 0, i.price_max_gbp ?? 0, i.non_member_gbp ?? 0) > 100)
      if (odd) return `${odd.name} costs more than £100`
      const unnamed = unnamedColumns(p, (await db.priceTerms(p.venue))?.tiers)
      if (unnamed) return unnamed
    } else {
      const h = parseHours(s.transcription)
      if (h.venue !== s.venue_id) return `the text is for ${h.venue}`
      if (!h.slots.length) return 'no hours in it'
    }
  } catch (e) {
    return `it doesn't read: ${(e as Error).message}`
  }
  return null
}

/** Whether what published hours replaced can be put back: the venue's slots are still all this submission's. */
async function stillCurrent(s: Submission): Promise<boolean> {
  return (await db.rowsOf('service_slots', venueOf(s))).every((r) => (r.prov as { submission?: string } | null)?.submission === s.id)
}

/**
 * A published price list taken down: each of its sections still all its own goes back to what it replaced there
 * (comes out, when it was new); a section someone has sent again since stays. A list published before 0041 replaced
 * the venue's whole: while all of it is still its own, the whole list before it goes back.
 */
async function unpublishPrices(s: Submission, replaced: Record<string, unknown>[], transcription: string): Promise<string> {
  const venue = venueOf(s)
  const now = savedList(await db.rowsOf('venue_prices', venue))
  const own = (l: { source: string }) => l.source.startsWith(`submission ${s.id}`)
  if (now.every(own)) {
    await db.restoreRows('venue_prices', venue, replaced)
    return `; the price list before it (${replaced.length} rows) put back`
  }
  const sections = [...new Set(parsePrices(transcription).items.map((i) => sectionKey(i.section)))]
  const back = new Set(sections.filter((k) => now.some((l) => sectionKey(l.section) === k && own(l)) && now.every((l) => sectionKey(l.section) !== k || own(l))))
  if (!back.size) return "; its sections have been sent again since, so nothing is put back"
  await db.saveList(venue, replaceSections(now, back, savedList(replaced).filter((l) => back.has(sectionKey(l.section)))))
  return `; ${back.size === sections.length ? 'its sections' : `${back.size} of its ${sections.length} sections`} put back as they were before it`
}

const KIND_WORD: Record<Submission['kind'], string> = { menu: 'menu', prices: 'price list', hours: 'hours', photo: 'photo of the venue', other: 'correction' }
/** "correction (hours)": a correction says what it's about */
const what = (s: Submission) => `${KIND_WORD[s.kind]}${s.topic ? ` (${s.topic})` : ''}`

/**
 * What's waiting for a person, as Markdown for the review issue: no email addresses, notes or photos (the repo, and
 * so the issue, is public), just what, where, how long and why, and the commands to act on each; then yesterday's
 * model spend.
 */
async function digest(): Promise<string> {
  const rows = await db.submissions({ status: ['received', 'transcribed', 'needs_review'] })
  const out = ['The queue of what members sent in that waits for a person. Updated by the queue Action; act with `npm run submissions -- show <id>`, then `approve <id>` or `reject <id> "why"`.', '']
  if (!rows.length) out.push('**Nothing waiting.**')
  else {
    const counts = Object.entries(rows.reduce<Record<string, number>>((n, s) => ({ ...n, [KIND_WORD[s.kind]]: (n[KIND_WORD[s.kind]] ?? 0) + 1 }), {}))
    out.push(`**${rows.length} waiting:** ${counts.map(([k, n]) => `${n} ${k}${n > 1 && !k.endsWith('s') ? 's' : ''}`).join(', ')}`, '')
    out.push('| id | what | venue | waiting | why |', '|---|---|---|---|---|')
    for (const s of rows) {
      const v = s.venue_id ? await db.venue(s.venue_id).then((x) => ({ name: x.name, of: x.siteName })).catch(() => null) : await db.site(subjectOf(s)).then((x) => ({ name: x.name, of: 'its page' })).catch(() => null)
      const days = Math.floor((Date.now() - Date.parse(s.created_at)) / 86400000)
      const why = s.review_note ?? (s.kind === 'other' ? 'a correction to read' : s.status === 'received' ? 'no model read it' : s.status === 'transcribed' ? 'the sender hasn’t confirmed the text' : s.contributor_id ? 'a contributor’s, approved by the ingest Action' : 'prices and hours wait for a person')
      const where = v ? `[${v.name}, ${v.of}](https://grub.cam/${subjectOf(s)})` : subjectOf(s)
      out.push(`| \`${short(s.id)}\` | ${what(s)}${photoWord(s) ? ` (${photoWord(s)})` : ''} | ${where} | ${days ? `${days} d` : 'today'} | ${why.replace(/\|/g, '/')} |`)
    }
  }
  // Reviews held back: which venue, the stars and why, never the words (they're held back for a reason) or who
  const reviews = await db.reviews({ status: ['needs_review'] }).catch(() => [])
  if (reviews.length) {
    out.push('', `**${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'} held back.** Read them with \`npm run reviews -- list\`, then \`approve <id>\` or \`hide <id> "why"\`.`, '')
    out.push('| id | venue | stars | why |', '|---|---|---|---|')
    for (const r of reviews) out.push(`| \`${short(r.id)}\` | ${r.venue_id} | ${r.rating} | ${(r.review_note ?? '').replace(/\|/g, '/')} |`)
  }
  const spend = await db.modelSpend(new Date(Date.now() - 86400000).toISOString()).catch(() => null)
  out.push('', spend ? `Model calls in the last day: ${spend.calls}, $${spend.usd.toFixed(2)}.` : 'Model spend unknown (model_calls unreadable).')
  return out.join('\n')
}

switch (command) {
  case 'list': {
    const rows = await db.submissions(values.all ? {} : { status: ['received', 'transcribed', 'needs_review', 'queued'] })
    if (!rows.length) console.log('nothing waiting')
    for (const s of rows) console.log(line(s))
    break
  }
  case 'show': {
    const s = await one(args[0] ?? '')
    const dir = values.dir ?? join(homedir(), 'grub-data', 'submissions')
    mkdirSync(dir, { recursive: true })
    console.log(line(s))
    console.log(`page: https://grub.cam/${subjectOf(s)}`)
    if (s.date || s.service) console.log(`for: ${[s.date, s.service].filter(Boolean).join(' ')}`)
    if (s.user_email ?? s.contact) console.log(`from: ${s.user_email ?? s.contact}`)
    if (s.note) console.log(`\nnote:\n${s.note}`)
    for (const path of photosOf(s)) {
      const file = join(dir, path)
      writeFileSync(file, await db.submissionPhoto(path))
      console.log(`${path === photosOf(s)[0] ? '\n' : ''}photo saved to ${file}`)
    }
    if (s.unsure) console.log(`\nthe model wasn't sure: ${s.unsure}`)
    if (s.transcription) console.log(`\ntranscription (${s.transcribed_by}${s.model ? `, ${s.model}` : ''}):\n${s.transcription}`)
    else if (['menu', 'prices', 'hours'].includes(s.kind)) {
      const v = await db.venue(venueOf(s))
      const t = s.kind as Transcribable
      console.log(`\n— paste the photo and this prompt into a chat model, save its answer under this header as a .txt, then: npm run submissions -- transcribe ${short(s.id)} file.txt —\n`)
      console.log(header(t, { site: v.site, venue: v.slug, source: `submission ${s.id}: ${photoWord(s) || 'text'} sent from the venue's page on grub.cam`, observed: s.created_at.slice(0, 10) }))
      console.log(prompt({ kind: t, venue: { name: v.name, type: v.type, site: v.siteName }, date: s.date ?? undefined, service: s.service ?? undefined, note: s.note ?? undefined }))
    }
    break
  }
  case 'transcribe': {
    const s = await one(args[0] ?? '')
    if (!args[1]) throw new Error('usage: transcribe <id> file.txt')
    let text = readFileSync(args[1], 'utf8').trim() + '\n'
    if (!text.includes('\n---\n') && ['menu', 'prices', 'hours'].includes(s.kind)) {
      // a body alone: give it the header
      const v = await db.venue(venueOf(s))
      text = header(s.kind as Transcribable, { site: v.site, venue: v.slug, source: `submission ${s.id}`, observed: s.created_at.slice(0, 10) }) + text
    }
    await db.updateSubmission(s.id, { transcription: text, transcribed_by: 'operator', status: 'needs_review' })
    console.log(`✓ ${short(s.id)} transcribed (${text.split('\n').length} lines); approve it when it reads right`)
    break
  }
  case 'menus':
  case 'publish': {
    const rows = (await db.submissions({ status: ['queued'] })).filter((s) => ['menu', 'prices', 'hours'].includes(s.kind))
    if (!rows.length) console.log('no menus, price lists or hours queued')
    for (const s of rows) {
      try {
        const hold = s.kind === 'menu' ? await menuHold(s) : await listHold(s)
        if (hold) {
          if (!values.dry) await db.updateSubmission(s.id, { status: 'needs_review', review_note: hold })
          console.log(`… ${short(s.id)} ${subjectOf(s)}: waits for a person: ${hold}`)
          continue
        }
        const what = await publish(s, !!values.dry)
        if (!values.dry) await db.updateSubmission(s.id, { status: 'approved', reviewed_at: new Date().toISOString() })
        console.log(`✓ ${short(s.id)} ${subjectOf(s)} ${s.kind}: ${what}${values.dry ? ' (dry)' : ''}`)
      } catch (e) {
        process.exitCode = 1
        console.error(`✗ ${short(s.id)} ${subjectOf(s)}: ${(e as Error).message}`)
      }
    }
    break
  }
  case 'approve':
  case 'photos': {
    const rows =
      command === 'photos' ? (await db.submissions({ status: ['queued'] })).filter((s) => s.kind === 'photo')
      : values.trusted ? await db.submissions({ status: ['needs_review'], trusted: true })
      : [await one(args[0] ?? '')]
    if (!rows.length) console.log(command === 'photos' ? 'no photos queued' : 'nothing trusted waiting')
    let failures = 0
    for (const s of rows) {
      try {
        const what = await publish(s, !!values.dry)
        if (!values.dry) await db.updateSubmission(s.id, { status: 'approved', reviewed_at: new Date().toISOString() })
        console.log(`✓ ${short(s.id)} ${subjectOf(s)} ${s.kind}: ${what}${values.dry ? ' (dry)' : ''}`)
      } catch (e) {
        failures++
        console.error(`✗ ${short(s.id)} ${subjectOf(s)}: ${(e as Error).message}`)
      }
    }
    if (failures) process.exitCode = 1
    break
  }
  case 'reject': {
    const s = await one(args[0] ?? '')
    const hidden = s.kind === 'photo' ? await db.hideSubmissionPhoto(s.id) : 0
    // A member's published menu: its days come down (only theirs: a script's or a hand-copied menu for the same day stays)
    const menus = s.kind === 'menu' && s.status === 'approved' && s.transcription ? await db.deleteMenuDays(venueOf(s), parseManual(s.transcription).days, s.contributor_id ? 'contributor' : 'user') : 0
    // A published price list or hours: what it replaced goes back, where it's still the venue's
    let restored = ''
    if (s.kind === 'prices' && s.status === 'approved' && s.replaced && s.transcription) restored = await unpublishPrices(s, s.replaced, s.transcription)
    else if (s.kind === 'hours' && s.status === 'approved' && s.replaced) {
      if (await stillCurrent(s)) {
        await db.restoreRows('service_slots', venueOf(s), s.replaced)
        restored = `; the hours before it (${s.replaced.length} rows) put back`
      } else restored = `; the venue's hours changed again since, so nothing is put back`
    }
    // Columns it named go back too, unless they've been renamed since
    if (s.kind === 'prices' && s.status === 'approved' && s.replaced_terms && s.transcription) {
      const named = parsePrices(s.transcription).columns
      if (JSON.stringify((await db.priceTerms(venueOf(s)))?.tiers ?? null) === JSON.stringify(named ?? null)) {
        await db.setPriceTerms(venueOf(s), s.replaced_terms.before)
        restored += `; its column names (${named?.join(' | ')}) taken back${s.replaced_terms.before?.tiers ? `, to ${s.replaced_terms.before.tiers.join(' | ')}` : ''}`
      }
    }
    await db.updateSubmission(s.id, { status: 'rejected', review_note: args[1] ?? null, reviewed_at: new Date().toISOString() })
    console.log(`✓ ${short(s.id)} rejected${args[1] ? `: ${args[1]}` : ''}${hidden ? '; its photo is down, the one before it shows again (after the next build)' : ''}${menus ? `; ${menus} of its menus taken down` : ''}${restored}`)
    break
  }
  case 'live':
    await live(Number(values.wait ?? 600) * 1000)
    break
  case 'digest':
    console.log(await digest())
    break
  case 'notify': {
    const rows = await db.pendingNotices()
    const posted = await deliverNotices(rows, githubDelivery(args[0] ?? '', (id) => db.acknowledgeNotice(id)))
    console.log(`${posted} new submission notifications; ${rows.length} acknowledged`)
    break
  }
  case 'smoke':
    await (await import('./smoke.ts')).smoke({ venue: values.venue ?? 'clare/buttery', site: values.site, photo: values.photo, review: values.review })
    break
  default:
    console.error('usage: npm run submissions -- list [--all] | show <id> | transcribe <id> file.txt | approve <id> | approve --trusted | photos | live | publish | reject <id> "why" | digest | notify <issue> | smoke')
    process.exitCode = 1
}
