// Usage: npm run submissions -- list [--all]
//        npm run submissions -- show <id> [--dir ~/grub-data/submissions]   <- saves the photo and prints the prompt to paste into a chat model
//        npm run submissions -- transcribe <id> file.txt                    <- the model's (or your) text for it
//        npm run submissions -- approve <id> [--keep-hours] [--dry]         <- parses the text and saves it; replaces the venue's hours unless --keep-hours
//        npm run submissions -- approve --trusted [--dry]                   <- every contributor's row waiting (the ingest Action runs this)
//        npm run submissions -- photos [--dry]                              <- every member's photo queued (the photos Action runs this)
//        npm run submissions -- menus [--dry]                               <- every member's menu queued, checked and published (the same Action)
//        npm run submissions -- reject <id> "why"                           <- a published photo or menu is taken down again
// The queue the `submit` Edge Function fills (supabase/functions/submit). A row's `transcription` is a complete file
// in the ingest:manual (menu), ingest:prices (prices) or ingest:hours (hours) format; approve parses it with those same
// parsers, so what can be saved by hand can be saved from here, and nothing else can.
//
// A member's menu (kind menu), once they've confirmed its text, is queued by the submit function and published by the
// photos Action without a person (`menus`), when it reads, is for the venue it was sent for, its days run from yesterday
// to a week ahead, and the venue's menu isn't fetched by a script; otherwise it waits for a person, saying why.
//
// A member's photo of the venue (kind photo) is published as ingest:photo would: its sizes written to public/photos
// (commit them; the photos Action does) and its row added ahead of the venue's others, credited to the sender's name
// under CC BY 4.0, the licence the form grants. The submit function queues the ones a model has passed.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { header, prompt, type Transcribable } from '../../supabase/functions/_shared/formats.ts'
import { connect, type Submission } from './lib/db.ts'
import { parseHours } from './hours.ts'
import { parseManual } from './manual.ts'
import { makeVariants, newPhotoPath, writeVariants } from './photo.ts'
import { parsePrices } from './prices.ts'

/** The licence a member grants by sending a photo of a venue (src/pages/Send.tsx says so). */
const MEMBER_LICENCE = 'CC BY 4.0'

const { values, positionals } = parseArgs({
  options: { all: { type: 'boolean' }, trusted: { type: 'boolean' }, dry: { type: 'boolean' }, 'keep-hours': { type: 'boolean' }, dir: { type: 'string' } },
  allowPositionals: true,
})
const [command, ...args] = positionals
const db = connect()

const short = (id: string) => id.slice(0, 8)
const line = (s: Submission) =>
  `${short(s.id)}  ${s.status.padEnd(12)} ${s.kind.padEnd(6)} ${s.venue_id.padEnd(40)} ${s.created_at.slice(0, 16).replace('T', ' ')}${s.photo_path ? '  photo' : ''}${s.contributor_id ? '  contributor' : ''}${s.transcribed_by ? `  by ${s.transcribed_by}` : ''}`

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
  const path = newPhotoPath(s.venue_id)
  const largest = variants.at(-1)!
  const sizes = `${variants.map((v) => v.width).join('/')} px, ${s.credit ?? 'no name'}`
  if (dry) return `${path}: ${sizes}`
  writeVariants(path, variants)
  const v = await db.venue(s.venue_id)
  await db.savePhoto(
    {
      subject: s.venue_id,
      kind: 'venue',
      path,
      widths: variants.map((x) => x.width),
      width: largest.width,
      height: largest.height,
      color,
      alt: s.alt || `${v.name}, ${v.siteName}`,
      credit: s.credit,
      licence: MEMBER_LICENCE,
      source: 'sent in on grub.cam',
      taken_on: s.created_at.slice(0, 10),
      approved: true,
      submission_id: s.id,
    },
    { first: true },
  )
  return `${path}: ${sizes}, now the venue's photo`
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
    if (!dry) await db.savePrices(p.venue, p.observed_on, p.source, p.items)
    return `${p.items.length} prices, replacing the venue's list`
  }
  if (s.kind === 'hours') {
    const h = parseHours(s.transcription)
    if (h.venue !== s.venue_id) throw new Error(`transcription is for ${h.venue}, the submission for ${s.venue_id}`)
    const replace = !values['keep-hours']
    const before = await db.slotsOf(h.venue)
    if (!dry) await db.saveHours(h, { replace, source_kind: 'reported', submission: s.id })
    return `${h.slots.length} slots${replace ? `, replacing ${before.length}` : ', added'}`
  }
  throw new Error(`a ${s.kind} submission is not published from here: act on the note`)
}

/** London's date, `days` from today. */
const londonDate = (days = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(Date.now() + days * 86400000))

/**
 * Why a member's menu can't go up without a person, or null when it can: it must parse, be for its venue, cover only
 * yesterday to a week ahead, and be for a venue no script fetches (a script's menu is the source's own).
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
  const [from, to] = [londonDate(-1), londonDate(7)]
  const off = m.days.find((d) => d.date < from || d.date > to)
  if (off) return `it's for ${off.date}, outside yesterday to a week ahead`
  if ((await db.venue(s.venue_id)).menu_scripted) return 'a script fetches this venue’s menu'
  return null
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
    if (s.date || s.service) console.log(`for: ${[s.date, s.service].filter(Boolean).join(' ')}`)
    if (s.user_email ?? s.contact) console.log(`from: ${s.user_email ?? s.contact}`)
    if (s.note) console.log(`\nnote:\n${s.note}`)
    if (s.photo_path) {
      const file = join(dir, s.photo_path)
      writeFileSync(file, await db.submissionPhoto(s.photo_path))
      console.log(`\nphoto saved to ${file}`)
    }
    if (s.unsure) console.log(`\nthe model wasn't sure: ${s.unsure}`)
    if (s.transcription) console.log(`\ntranscription (${s.transcribed_by}${s.model ? `, ${s.model}` : ''}):\n${s.transcription}`)
    else if (['menu', 'prices', 'hours'].includes(s.kind)) {
      const v = await db.venue(s.venue_id)
      const t = s.kind as Transcribable
      console.log(`\n— paste the photo and this prompt into a chat model, save its answer under this header as a .txt, then: npm run submissions -- transcribe ${short(s.id)} file.txt —\n`)
      console.log(header(t, { site: v.site, venue: v.slug, source: `submission ${s.id}: ${s.photo_path ? 'photo' : 'text'} sent from the venue's page on grub.cam`, observed: s.created_at.slice(0, 10) }))
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
      const v = await db.venue(s.venue_id)
      text = header(s.kind as Transcribable, { site: v.site, venue: v.slug, source: `submission ${s.id}`, observed: s.created_at.slice(0, 10) }) + text
    }
    await db.updateSubmission(s.id, { transcription: text, transcribed_by: 'operator', status: 'needs_review' })
    console.log(`✓ ${short(s.id)} transcribed (${text.split('\n').length} lines); approve it when it reads right`)
    break
  }
  case 'menus': {
    const rows = (await db.submissions({ status: ['queued'] })).filter((s) => s.kind === 'menu')
    if (!rows.length) console.log('no menus queued')
    for (const s of rows) {
      try {
        const hold = await menuHold(s)
        if (hold) {
          if (!values.dry) await db.updateSubmission(s.id, { status: 'needs_review', review_note: hold })
          console.log(`… ${short(s.id)} ${s.venue_id}: waits for a person: ${hold}`)
          continue
        }
        const what = await publish(s, !!values.dry)
        if (!values.dry) await db.updateSubmission(s.id, { status: 'approved', reviewed_at: new Date().toISOString() })
        console.log(`✓ ${short(s.id)} ${s.venue_id} menu: ${what}${values.dry ? ' (dry)' : ''}`)
      } catch (e) {
        process.exitCode = 1
        console.error(`✗ ${short(s.id)} ${s.venue_id}: ${(e as Error).message}`)
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
        console.log(`✓ ${short(s.id)} ${s.venue_id} ${s.kind}: ${what}${values.dry ? ' (dry)' : ''}`)
      } catch (e) {
        failures++
        console.error(`✗ ${short(s.id)} ${s.venue_id}: ${(e as Error).message}`)
      }
    }
    if (failures) process.exitCode = 1
    break
  }
  case 'reject': {
    const s = await one(args[0] ?? '')
    const hidden = s.kind === 'photo' ? await db.hideSubmissionPhoto(s.id) : 0
    // A member's published menu: its days come down (only theirs: a script's or a hand-copied menu for the same day stays)
    const menus = s.kind === 'menu' && s.status === 'approved' && s.transcription ? await db.deleteMenuDays(s.venue_id, parseManual(s.transcription).days, s.contributor_id ? 'contributor' : 'user') : 0
    await db.updateSubmission(s.id, { status: 'rejected', review_note: args[1] ?? null, reviewed_at: new Date().toISOString() })
    console.log(`✓ ${short(s.id)} rejected${args[1] ? `: ${args[1]}` : ''}${hidden ? '; its photo is down, the one before it shows again (after the next build)' : ''}${menus ? `; ${menus} of its menus taken down` : ''}`)
    break
  }
  default:
    console.error('usage: npm run submissions -- list [--all] | show <id> | transcribe <id> file.txt | approve <id> | approve --trusted | photos | menus | reject <id> "why"')
    process.exitCode = 1
}
