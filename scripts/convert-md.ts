// One-off: convert colleges/*.md research notes into data/colleges/*.yaml.
// Run: npx tsx scripts/convert-md.ts   (then review every file by hand)
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { stringify } from 'yaml'
import { College, type AccessLevel, type DietTag, type Provenance, type Venue } from './schema.ts'

const SRC = 'colleges'
const OUT = 'data/colleges'
mkdirSync(OUT, { recursive: true })

const COLLEGE_NAMES: Record<string, string> = {
  christs: "Christ's",
  churchill: 'Churchill',
  clare: 'Clare',
  'clare-hall': 'Clare Hall',
  'corpus-christi': 'Corpus Christi',
  darwin: 'Darwin',
  downing: 'Downing',
  emmanuel: 'Emmanuel',
  fitzwilliam: 'Fitzwilliam',
  girton: 'Girton',
  'gonville-and-caius': 'Gonville & Caius',
  homerton: 'Homerton',
  'hughes-hall': 'Hughes Hall',
  jesus: 'Jesus',
  kings: "King's",
  'lucy-cavendish': 'Lucy Cavendish',
  magdalene: 'Magdalene',
  'murray-edwards': 'Murray Edwards',
  newnham: 'Newnham',
  pembroke: 'Pembroke',
  peterhouse: 'Peterhouse',
  queens: "Queens'",
  robinson: 'Robinson',
  selwyn: 'Selwyn',
  'sidney-sussex': 'Sidney Sussex',
  'st-catharines': "St Catharine's",
  'st-edmunds': "St Edmund's",
  'st-johns': "St John's",
  trinity: 'Trinity',
  'trinity-hall': 'Trinity Hall',
  wolfson: 'Wolfson',
}

type Section = { title: string; fields: Record<string, string>; sub: Record<string, string>; bullets: string[] }

function parse(md: string) {
  const lines = md.replace(/\r/g, '').split('\n')
  const fm: Record<string, string> = {}
  let i = 0
  if (lines[0] === '---') {
    i = 1
    while (lines[i] !== '---') {
      const m = lines[i].match(/^(\w+):\s*(.*)$/)
      if (m) fm[m[1]] = m[2]
      i++
    }
    i++
  }
  const links: { label: string; url: string }[] = []
  const sections: Section[] = []
  let cur: Section | null = null
  for (; i < lines.length; i++) {
    const l = lines[i]
    if (l.startsWith('# ')) continue
    if (l.startsWith('[Master index]')) {
      for (const m of l.matchAll(/\[([^\]]+)\]\((https?:[^)]+)\)/g)) links.push({ label: m[1], url: m[2] })
      continue
    }
    if (l.startsWith('## ')) {
      cur = { title: l.slice(3).trim(), fields: {}, sub: {}, bullets: [] }
      sections.push(cur)
      continue
    }
    if (!cur) continue
    let m = l.match(/^- \*\*([^*]+):\*\*\s*(.*)$/)
    if (m) {
      cur.fields[m[1]] = m[2].trim()
      continue
    }
    m = l.match(/^  - \*\*([^*]+):\*\*\s*(.*)$/)
    if (m) {
      cur.sub[m[1]] = m[2].trim()
      continue
    }
    if (l.startsWith('- ')) cur.bullets.push(l.slice(2))
    else if (l.trim() && Object.keys(cur.sub).length) {
      // continuation of a multi-line sub-field value (e.g. Homerton notes)
      const last = Object.keys(cur.sub).at(-1)!
      cur.sub[last] += ' ' + l.trim()
    }
  }
  return { fm, links, sections }
}

const clean = (s?: string) => (s === undefined || s === '' || s === '—' || s === '?' ? undefined : s)

function prov(text: string | undefined, checked: string): Provenance {
  const p: Provenance = { source_kind: 'official', confidence: 'high', observed_at: checked }
  if (!text) return { source_kind: 'unknown', confidence: 'low' }
  const rep = text.match(/\[reported ([0-9/]+)\]\(([^)]+)\)/) ?? text.match(/\[reported ([0-9/]+)\]/)
  const gm = text.match(/\[Google Maps, ([0-9-]+)\]/)
  const lead = /\[lead:/.test(text)
  const q = text.trim().startsWith('?') || text.includes(' ?') || text.includes('(times ?)')
  if (text.trim() === '?') return { source_kind: 'unknown', confidence: 'low' }
  if (rep && !/official page wins|official/.test(text)) {
    p.source_kind = 'reported'
    p.confidence = 'low'
    const yr = rep[1].slice(0, 4)
    p.observed_at = `${yr}-01-01`
    if (rep[2]) p.source_url = rep[2]
    p.note = `reported ${rep[1]}`
  } else if (gm && !/official|agrees/.test(text)) {
    p.source_kind = 'google_maps'
    p.confidence = 'medium'
    p.observed_at = gm[1]
  } else if (lead) {
    p.source_kind = 'lead'
    p.confidence = 'low'
  } else if (q) {
    p.confidence = 'medium'
  }
  return p
}

function accessLevel(t?: string): AccessLevel {
  if (!t || t.trim() === '?') return 'unknown'
  const s = t.toLowerCase()
  if (/\bpublic\b|unaccompanied visitors admitted|everyone is welcome|non-members allowed|open to all/.test(s)) return 'public'
  if (/members only|member booking required|college card required|card reader|members; visitors must be with|must be with a|guests only|members\+guests/.test(s)) {
    if (/members\+guests|must be with|guests|and their guests/.test(s)) return 'members_guests'
    return 'members_only'
  }
  if (/members and guests|members\+guests|students, staff, fellows/.test(s)) return 'members_guests'
  return 'unknown'
}

function payment(t?: string) {
  const s = (t ?? '').toLowerCase()
  const out: Venue['payment'] = { text: clean(t), prov: { source_kind: 'official', confidence: 'medium' } }
  if (!t || t.trim() === '?') return { prov: { source_kind: 'unknown' as const, confidence: 'low' as const } }
  if (/university card|college card|upay|camcard|member card|dining card|college bill|college account|epos/.test(s)) out.university_card = true
  if (/bank card|debit|credit card|contactless/.test(s)) out.bank_card = true
  if (/no cash|cashless/.test(s)) out.cash = false
  else if (/\bcash\b/.test(s)) out.cash = true
  if (/upay only|no cash or bank cards|college card only/.test(s)) out.bank_card = false
  return out
}

function dietTags(t?: string): DietTag[] {
  const s = (t ?? '').toLowerCase()
  const tags = new Set<DietTag>()
  if (/vegetarian|\bv\b|\(v\b/.test(s)) tags.add('vegetarian')
  if (/vegan|\bvg\b/.test(s)) tags.add('vegan')
  if (/plant-based|\bpb\b/.test(s)) tags.add('plant_based')
  if (/halal/.test(s)) tags.add('halal')
  if (/gluten/.test(s)) tags.add('gluten_free')
  if (/kosher/.test(s)) tags.add('kosher')
  if (/pescatarian/.test(s)) tags.add('pescatarian')
  if (/dairy|lactose/.test(s)) tags.add('dairy_free')
  return [...tags]
}

function slugify(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function menuSource(sub: Record<string, string>, fallbackChecked: string) {
  if (!Object.keys(sub).length) return undefined
  const kindRaw = (sub.Kind ?? 'unknown').toLowerCase()
  const km = kindRaw.match(/^(\w+)(?:\s*\(([^)]+)\))?/)
  let kind: string = km?.[1] ?? 'unknown'
  if (kind === '?') kind = 'unknown'
  const platform = km?.[2]
  const urlField = sub.URL ?? ''
  const urls = [...urlField.matchAll(/(?:(\w+)\s+)?(https?:\/\/\S+)/g)]
  const statusRaw = (sub.Status ?? 'unverified').toLowerCase()
  const status = statusRaw.startsWith('live')
    ? 'live'
    : statusRaw.startsWith('members')
      ? 'members_only'
      : statusRaw.startsWith('none')
        ? 'none'
        : 'unverified'
  const ms: Record<string, unknown> = {
    kind,
    platform,
    status,
    checked: sub.Checked ?? fallbackChecked,
    cadence: clean(sub.Cadence),
    coverage: clean(sub.Coverage),
    includes: clean(sub.Includes)
      ? sub.Includes.split(/,\s*(?![^()]*\))/).map((x) => x.trim())
      : [],
    notes: clean(sub.Notes),
  }
  if (urls.length === 1) ms.url = urls[0][2]
  else if (urls.length > 1) {
    ms.url = urls[0][2]
    ms.urls = Object.fromEntries(urls.map((u, i) => [u[1] ?? `link${i + 1}`, u[2]]))
  }
  if (sub.Data) ms.data_url = sub.Data.replace(/`/g, '').trim()
  return ms
}

// Hand-reviewed corrections to the keyword heuristics above (venue key = college/venue-slug).
// Diet tags mean "reliably available or labelled at every service", not "on request".
const DIET_OVERRIDES: Record<string, DietTag[]> = {
  'clare-hall/dining-hall': ['vegetarian', 'vegan', 'gluten_free'], // Sway menu tags PB / V / GF
  'corpus-christi/cafeteria': ['vegetarian', 'vegan', 'plant_based'],
  'darwin/servery': ['vegetarian', 'vegan', 'plant_based'],
  'homerton/dining-hall': ['vegetarian', 'vegan'], // halal on request only
  'peterhouse/hall-servery': ['vegetarian', 'vegan'], // VV codes per dish; others on request
  'queens/cripps-dining-hall-cafeteria': ['vegetarian', 'vegan', 'halal'], // menu tags Vegan / V / Halal
  'robinson/garden-restaurant-dining-hall': ['vegetarian', 'vegan'],
  'selwyn/hall-servery': ['vegetarian', 'halal'],
  'st-catharines/hall-cafeteria': ['vegetarian', 'vegan'], // priced veg/vegan main daily; rest on request
  'st-edmunds/dining-hall': ['vegetarian', 'vegan', 'plant_based'],
  'magdalene/ramsay-hall': ['vegetarian', 'vegan'], // viewthe.menu has vegan/vegetarian filters
}
const ACCESS_OVERRIDES: Record<string, AccessLevel> = {
  'corpus-christi/cafeteria': 'members_guests',
  'clare/river-room': 'members_only',
}
const PAYMENT_OVERRIDES: Record<string, Partial<Venue['payment']>> = {
  'fitzwilliam/buttery': { university_card: true, bank_card: true },
}

for (const f of readdirSync(SRC).filter((x) => x.endsWith('.md'))) {
  const slug = f.replace(/\.md$/, '')
  const { fm, links, sections } = parse(readFileSync(join(SRC, f), 'utf8'))
  const checked = fm.reviewed
  const venues: Record<string, unknown>[] = []
  let formal: Record<string, unknown> | undefined
  let notes: string[] = []
  for (const s of sections) {
    if (s.title === 'Formal') {
      const fl = s.fields
      formal = {
        where: clean(fl.Where),
        days_text: clean(fl.Days),
        time: clean(fl.Time),
        dress: clean(fl.Dress),
        format: clean(fl.Format),
        booking: clean(fl.Booking),
        guests: clean(fl.Guests),
        cost: clean(fl.Cost),
        prov: { source_kind: 'official', confidence: 'medium', observed_at: checked },
      }
      continue
    }
    if (s.title === 'Notes') {
      notes = s.bullets
      continue
    }
    const fl = s.fields
    const hours = clean(fl.Hours)
    const vslug = slugify(s.title)
    const key = `${slug}/${vslug}`
    venues.push({
      slug: vslug,
      name: s.title,
      type: (fl.Type ?? 'other').trim(),
      where: clean(fl.Where),
      hours_text: hours,
      access: { level: ACCESS_OVERRIDES[key] ?? accessLevel(fl.Access), text: clean(fl.Access), prov: prov(fl.Access, checked) },
      payment: { ...payment(fl.Payment), ...PAYMENT_OVERRIDES[key] },
      prices: clean(fl.Prices) ? { text: fl.Prices, prov: prov(fl.Prices, checked) } : undefined,
      serves: clean(fl.Serves),
      dietary: { tags: DIET_OVERRIDES[key] ?? dietTags(fl.Dietary), text: clean(fl.Dietary), prov: prov(fl.Dietary, checked) },
      menu_source: menuSource(s.sub, checked),
    })
  }
  const college = {
    slug,
    name: COLLEGE_NAMES[slug] ?? slug,
    official_dining_url: links[0]?.url,
    reviewed: checked,
    notice: clean(fm.notice),
    links: links.slice(1),
    venues,
    formal,
    notes,
  }
  const parsed = College.safeParse(college)
  if (!parsed.success) {
    console.error(`✗ ${slug}`, parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  '))
    continue
  }
  writeFileSync(join(OUT, `${slug}.yaml`), stringify(college, { lineWidth: 0 }))
  console.log(`✓ ${slug} (${venues.length} venues)`)
}
