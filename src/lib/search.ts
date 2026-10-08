import type { DietTag, Dish, Meal, Venue, VenueType } from './types.ts'

// Search the way established engines do it (Meilisearch, Typesense, Algolia), sized for one city's menus:
// words match exactly, as plurals or synonyms, the last one as a prefix while it's being typed; only a word
// that matches nothing gets typo tolerance. Query words are optional: results are what matches the most of them.
// Ranking is a list of tie-breaks: fewest typos, best field, the query naming the whole thing, most exact words.

/** Keep apostrophes within words: John's, John’s and Johns are identical. */
export function normalizeSearch(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/['’‘]/g, '').replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim().replace(/\s+/g, ' ').replace(/\bsaint\b/g, 'st')
}

const words = (text: string) => normalizeSearch(text).split(' ').filter(Boolean)

/** Dropped from queries ("food at homerton"), unless that leaves nothing or it's the word being typed. */
const STOPWORDS = new Set(['a', 'an', 'and', 'any', 'are', 'at', 'for', 'from', 'i', 'in', 'is', 'me', 'my', 'n', 'near', 'of', 'on', 'or', 'some', 'the', 'to', 'what', 'where', 'with'])

/** Different spellings or names for the same food, seen on the menus. */
const SYNONYMS = [
  ['veggie', 'vegetarian'], ['chips', 'fries', 'frites'], ['mac', 'macaroni'], ['lasagne', 'lasagna'], ['yoghurt', 'yogurt'],
  ['halloumi', 'haloumi'], ['dhal', 'dahl', 'dal'], ['chilli', 'chili'], ['aubergine', 'eggplant'], ['courgette', 'zucchini'],
]
const synonyms = new Map(SYNONYMS.flatMap((group) => group.map((w) => [w, group] as const)))

// What else describes a place or a dish, so "jesus cafe", "homerton lunch" and "vegan curry" mean what they say.
const KIND_WORDS: Record<VenueType, string> = { hall: 'dining', cafe: 'cafe', bar: 'bar', other: '' }
const MEAL_WORDS: Meal[] = ['breakfast', 'brunch', 'lunch', 'dinner']
const dietWords = (tag: DietTag) => tag.replace('_', ' ') + (tag === 'vegan' ? ' vegetarian' : '')

// Where a word matched, best first.
const NAME = 0
const ALIAS = 1
const KIND = 2
const DISH = 3
const TAG = 4

/** A word and the singulars it might be the plural of: "curries" also finds "curry", "pies" finds "pie". */
function forms(w: string): string[] {
  if (w.length < 4 || !w.endsWith('s') || /(ss|us|is)$/.test(w)) return [w]
  return [w, w.slice(0, -1), ...(w.endsWith('es') ? [w.slice(0, -2)] : []), ...(w.endsWith('ies') ? [`${w.slice(0, -3)}y`] : [])]
}

/** Typos allowed in a word of this length. */
const allowed = (w: string) => (w.length >= 8 ? 2 : w.length >= 4 ? 1 : 0)

/**
 * Typos from `a` to `b`, or to the start of `b` with `prefix`: a letter added, dropped, changed or swapped with
 * its neighbour (Damerau–Levenshtein). A different first letter costs one more: people rarely get that wrong.
 */
function typos(a: string, b: string, prefix: boolean): number {
  let before: number[] = []
  let above = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(above[j] + 1, row[j - 1] + 1, above[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) row[j] = Math.min(row[j], before[j - 2] + 1)
    }
    before = above
    above = row
  }
  return (prefix ? Math.min(...above) : above[b.length]) + (a[0] === b[0] ? 0 : 1)
}

/** A place, or one dish on one day's menu there, which also carries its place's names. */
export type SearchDoc = { venue: Venue; dish?: Dish; date?: string; service?: Meal }
type Doc = SearchDoc & { names: string[][] }
type Index = { docs: Doc[]; fields: Map<string, Map<number, number>>; byForm: Map<string, Set<string>> }

/** A loaded data snapshot is immutable. Reuse its index across keystrokes and clock ticks. */
const indexes = new WeakMap<Venue[], Index>()

function indexFor(venues: Venue[]): Index {
  const cached = indexes.get(venues)
  if (cached) return cached
  const docs: Doc[] = []
  // word → document → best field it's in
  const fields = new Map<string, Map<number, number>>()
  const add = (doc: number, text: string, field: number) => {
    for (const w of words(text)) {
      const of = fields.get(w) ?? fields.set(w, new Map()).get(w)!
      of.set(doc, Math.min(of.get(doc) ?? field, field))
    }
  }
  const nameWords = (name: string) => words(name).filter((w) => !STOPWORDS.has(w))
  for (const v of venues) {
    const names = [v.name, v.site.name, v.site.short_name ?? '', v.site.kind === 'college' ? `${v.site.name} College` : ''].filter(Boolean)
    const aliases = [...(v.aliases ?? []), ...(v.site.aliases ?? [])]
    const place = (doc: number, kind: string) => {
      for (const name of names) add(doc, name, NAME)
      for (const alias of aliases) add(doc, alias, ALIAS)
      add(doc, kind, KIND)
    }
    const meals = MEAL_WORDS.filter((m) => v.slots.some((s) => s.meal === m))
    place(docs.push({ venue: v, names: [...names, ...aliases].map(nameWords) }) - 1, [KIND_WORDS[v.type], ...meals].join(' '))
    for (const day of v.menu) for (const dish of day.items) {
      const doc = docs.push({ venue: v, dish, date: day.date, service: day.service, names: [nameWords(dish.name)] }) - 1
      place(doc, KIND_WORDS[v.type])
      add(doc, dish.name, DISH)
      add(doc, [...dish.tags.map(dietWords), MEAL_WORDS.includes(day.service) ? day.service : ''].join(' '), TAG)
    }
  }
  const byForm = new Map<string, Set<string>>()
  for (const w of fields.keys()) for (const f of forms(w)) (byForm.get(f) ?? byForm.set(f, new Set()).get(f)!).add(w)
  const index = { docs, fields, byForm }
  indexes.set(venues, index)
  return index
}

/** One way to match query words: every token must be in the document. */
type Alt = { words: number[]; tokens: string[]; typos: number; exact: boolean }
type WordMatch = { typos: number; field: number; exact: boolean; tokens: Set<string> }
/** `rank` sorts ascending: typos, field, whether the query names the whole thing, exact words. */
export type SearchHit = { dish?: Dish; date?: string; service?: Meal; rank: number[] }

/** The best matches among documents `inScope`, grouped by venue, best first. */
export function searchVenues(venues: Venue[], query: string, inScope: (doc: SearchDoc) => boolean): Map<string, SearchHit[]> {
  const grouped = new Map<string, SearchHit[]>()
  const all = words(query)
  // A trailing space means the last word is finished.
  const typing = !/\s$/.test(query)
  const kept = all.filter((w, i) => !STOPWORDS.has(w) || (typing && i === all.length - 1))
  const q = kept.length ? kept : all
  if (!q.length) return grouped
  const { docs, fields, byForm } = indexFor(venues)
  const vocabulary = [...fields.keys()]
  const scope = docs.map(inScope)
  const isLast = (i: number) => typing && i === q.length - 1

  const exactly = (w: string) => [...new Set(forms(w).flatMap((f) => synonyms.get(f) ?? [f]).flatMap((f) => [...(byForm.get(f) ?? [])]))]
  const startingWith = (w: string) => vocabulary.filter((t) => t.startsWith(w))
  function* matches(alt: Alt): Generator<[number, number]> {
    const [first, ...rest] = alt.tokens.map((t) => fields.get(t)!)
    for (const [doc, field] of first) {
      if (!scope[doc]) continue
      const each = [field, ...rest.map((of) => of.get(doc))]
      if (each.every((f) => f !== undefined)) yield [doc, Math.max(...each)]
    }
  }
  const alts: Alt[] = []
  const found = (i: number) => alts.some((alt) => alt.words.includes(i) && !matches(alt).next().done)

  q.forEach((w, i) => {
    const exact = exactly(w)
    for (const t of exact) alts.push({ words: [i], tokens: [t], typos: 0, exact: true })
    if (isLast(i)) for (const t of startingWith(w)) if (!exact.includes(t)) alts.push({ words: [i], tokens: [t], typos: 0, exact: false })
    // Two words written as one in a name: "dar bar" is DarBar
    if (i + 1 < q.length) {
      const joined = w + q[i + 1]
      for (const t of isLast(i + 1) ? startingWith(joined) : exactly(joined)) alts.push({ words: [i, i + 1], tokens: [t], typos: 0, exact: t === joined })
    }
  })
  q.forEach((w, i) => {
    if (found(i)) return
    // One word written as two: "stjohns" is "st johns"
    for (let at = 2; at <= w.length - 2; at++) {
      for (const left of exactly(w.slice(0, at))) for (const right of exactly(w.slice(at))) alts.push({ words: [i], tokens: [left, right], typos: 1, exact: false })
    }
    // Typos, fewest first, only for a word that matches nothing as typed (so "cake" never finds "hake" or "cafe")
    for (let n = 1; n <= allowed(w) && !found(i); n++) {
      for (const t of vocabulary) {
        if (isLast(i) ? t.length < w.length - n : Math.abs(t.length - w.length) > n) continue
        if (typos(w, t, isLast(i)) === n) alts.push({ words: [i], tokens: [t], typos: n, exact: false })
      }
    }
  })

  const matched = new Map<number, WordMatch[]>()
  for (const alt of alts) {
    for (const [doc, field] of matches(alt)) {
      const byWord = matched.get(doc) ?? matched.set(doc, []).get(doc)!
      for (const i of alt.words) {
        const m = (byWord[i] ??= { typos: alt.typos, field, exact: alt.exact, tokens: new Set() })
        m.typos = Math.min(m.typos, alt.typos)
        m.field = Math.min(m.field, field)
        m.exact ||= alt.exact
        for (const t of alt.tokens) m.tokens.add(t)
      }
    }
  }
  const ranked: { doc: Doc; count: number; rank: number[] }[] = []
  for (const [i, byWord] of matched) {
    const doc = docs[i]
    const hits = byWord.filter(Boolean)
    // A dish matches for what's on it, not for its place's name alone
    if (doc.dish && !hits.some((m) => m.field >= DISH)) continue
    const whole = hits.length === q.length && doc.names.some((name) =>
      name.length > 0 && name.every((t) => hits.some((m) => m.tokens.has(t))) && hits.every((m) => name.some((t) => m.tokens.has(t))))
    const rank = [hits.reduce((n, m) => n + m.typos, 0), Math.max(...hits.map((m) => m.field)), whole ? 0 : 1, -hits.filter((m) => m.exact).length]
    ranked.push({ doc, count: hits.length, rank })
  }
  // Words are optional: keep what matches the most of them
  const most = Math.max(0, ...ranked.map((r) => r.count))
  for (const { doc, count, rank } of ranked) {
    if (count < most) continue
    const hits = grouped.get(doc.venue.id) ?? grouped.set(doc.venue.id, []).get(doc.venue.id)!
    hits.push({ dish: doc.dish, date: doc.date, service: doc.service, rank })
  }
  for (const hits of grouped.values()) hits.sort(compareSearchHits)
  return grouped
}

export function compareSearchHits(a: SearchHit, b: SearchHit): number {
  for (let i = 0; i < a.rank.length; i++) if (a.rank[i] !== b.rank[i]) return a.rank[i] - b.rank[i]
  return 0
}
