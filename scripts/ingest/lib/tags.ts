import type { DietTag, Dish } from '../../schema.ts'

/** Map a source's explicit label (icon alt, tag name, code) to our DietTag. */
export function tagFromLabel(label: string): DietTag | undefined {
  const s = label.trim().toLowerCase()
  if (!s) return undefined
  if (s === 'pb' || /plant.?based/.test(s)) return 'plant_based'
  if (s === 'vv' || s === 've' || s === 'vg' || s === 'vgn' || s === 'vn' || /vegan/.test(s)) return 'vegan'
  if (s === 'v' || /vegetarian/.test(s)) return 'vegetarian'
  if (s === 'h' || s === 'hm' || /halal/.test(s)) return 'halal'
  if (s === 'gf' || /gluten.?free/.test(s)) return 'gluten_free'
  if (/kosher/.test(s)) return 'kosher'
  if (/pescatarian/.test(s)) return 'pescatarian'
  if (s === 'df' || /dairy.?free/.test(s)) return 'dairy_free'
  return undefined
}

export function tagsFromLabels(labels: Iterable<string>): DietTag[] {
  const out = new Set<DietTag>()
  for (const l of labels) {
    const t = tagFromLabel(l)
    if (t) out.add(t)
  }
  if (out.has('plant_based')) out.add('vegan')
  if (out.has('vegan')) out.add('vegetarian')
  return [...out]
}

/**
 * Extract explicit markers from a dish name, e.g. "Lentil dhal (vegan)", "Lamb chilli (halal)", "Soup (V)(GF)".
 * Returns the cleaned name and the tags. Only bracketed/explicit markers count; we never guess from ingredients.
 */
export function tagsFromName(name: string): { name: string; tags: DietTag[] } {
  const found: string[] = []
  const cleaned = name
    .replace(/\(([^)]{1,30})\)/g, (whole, inner: string) => {
      const parts = inner.split(/[,/&]/).map((p) => p.trim())
      if (parts.length && parts.every((p) => tagFromLabel(p))) {
        found.push(...parts)
        return ''
      }
      return whole
    })
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;])/g, '$1')
    .trim()
  return { name: cleaned, tags: tagsFromLabels(found) }
}

export function parsePrice(text: string | undefined): number | undefined {
  if (!text) return undefined
  const m = text.replace(/&pound;/g, '£').match(/£\s*(\d+(?:\.\d{1,2})?)/)
  return m ? Number(m[1]) : undefined
}

export function courseFromHeading(h: string): Dish['course'] {
  const s = h.toLowerCase()
  if (/soup|starter/.test(s)) return 'soup'
  if (/dessert|pudding|sweet/.test(s)) return 'dessert'
  if (/\bsides?\b|accompan|salad bar|bread/.test(s)) return 'side'
  if (/main|dish|meat|fish|plant|vegetarian|vegan|special|pizza|pasta|jacket|carvery|roast|grill|curry|counter/.test(s)) return 'main'
  if (/vegetable|potato|salad/.test(s)) return 'side'
  return 'other'
}

/** "(Breakfast /Brunch)" after a dish: which meals it's on, said already by where it's listed. */
const MEALS_NOTE = /\s*\((?:\s*(?:breakfast|brunch|lunch|dinner|supper)\s*(?:[/,&]|and)?)+\s*\)$/i

export function cleanName(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&pound;/g, '£')
    .replace(/&#0?39;|&rsquo;|’/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\r?\n/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/(,\s*)+/g, ', ')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .replace(MEALS_NOTE, '')
    .trim()
}

/** The 14 allergens UK law has menus declare, by the name we show, and the words sources use for them. `kind`: the word
 * names a particular one ("Wheat" is gluten from wheat), kept as its detail. */
const ALLERGENS: { name: string; re: RegExp; kind?: true }[] = [
  { name: 'celery', re: /^(celery|celeriac)$/ },
  { name: 'gluten', re: /^(gluten|cereals?( (containing|with) gluten)?)$/ },
  { name: 'gluten', re: /^(wheat|barley|rye|oats?|spelt|kamut)$/, kind: true },
  { name: 'crustaceans', re: /^(crustaceans?|crustacea)$/ },
  { name: 'eggs', re: /^eggs?$/ },
  { name: 'fish', re: /^fish$/ },
  { name: 'lupin', re: /^lupine?s?$/ },
  { name: 'milk', re: /^(milk|dairy)$/ },
  { name: 'molluscs', re: /^(molluscs?|mollusks?)$/ },
  { name: 'mustard', re: /^mustard$/ },
  { name: 'nuts', re: /^(tree ?)?nuts?$/ },
  { name: 'peanuts', re: /^(peanuts?|groundnuts?)$/ },
  { name: 'sesame', re: /^sesame( seeds?)?$/ },
  { name: 'soya', re: /^(soya?|soya? ?beans?)$/ },
  { name: 'sulphites', re: /^(sulphur dioxide|sulfur dioxide|sulphites?|sulfites?|so2)(\s*(and|&|\/)\s*(sulphites?|sulfites?))?$/ },
]

const MAY = /^may contain:?\s*/

/**
 * A source's allergen label as we store it: the common name with the source's detail, "may contain" kept in front.
 * "Gluten (wheat, barley)" and "Gluten: Wheat" are "gluten (wheat, barley)" and "gluten (wheat)", "Wheat" is "gluten
 * (wheat)", "Sulphur Dioxide" is "sulphites". Undefined when it isn't one of the 14.
 */
export function allergenFromLabel(label: string): string | undefined {
  let s = label.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.;]+$/, '')
  const may = MAY.exec(s)
  if (may) s = s.slice(may[0].length)
  s = s.replace(/^contains:?\s*/, '')
  const m = /^([^(:]+?)\s*(?::\s*(.+)|\((.+)\))?$/.exec(s)
  if (!m) return undefined
  const [, head, colon, bracket] = m
  const hit = ALLERGENS.find((a) => a.re.test(head))
  if (!hit) return undefined
  const detail = [hit.kind ? head : '', colon ?? bracket ?? ''].filter(Boolean).join(', ')
  return `${may ? 'may contain ' : ''}${hit.name}${detail ? ` (${detail})` : ''}`
}

/**
 * A dish's allergen labels as we store them, in the source's order, what it may contain after what it contains; the
 * details of one allergen together ("gluten (wheat, oats)"). `keep`: a label we don't know is kept as printed, from a
 * source's own allergen list; never dropped there, since what it says may matter to someone.
 */
export function allergensFromLabels(labels: Iterable<string>, keep = true): string[] {
  const order: string[] = []
  const details = new Map<string, string[]>()
  for (const label of labels) {
    const raw = label.trim().replace(/\s+/g, ' ')
    if (!raw || /^(none|n\/a|-|no allergens)$/i.test(raw)) continue
    const a = allergenFromLabel(raw) ?? (keep ? raw.toLowerCase() : undefined)
    if (!a) continue
    const m = /^(.*?)(?: \((.+)\))?$/.exec(a)!
    if (!details.has(m[1])) (details.set(m[1], []), order.push(m[1]))
    const own = details.get(m[1])!
    for (const d of m[2]?.split(/,\s*/) ?? []) if (!own.includes(d)) own.push(d)
  }
  const contains = order.filter((b) => !MAY.test(b))
  // What it may contain, unless it contains it anyway
  const may = order.filter((b) => MAY.test(b) && !contains.includes(b.replace(MAY, '')))
  return [...contains, ...may].map((b) => (details.get(b)!.length ? `${b} (${details.get(b)!.join(', ')})` : b))
}

/** Bracketed groups split at top-level commas and "and"/"&", inner brackets kept: "gluten (wheat, barley), milk". */
function splitTop(s: string): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    const and = depth === 0 && /^\s+(and|&)\s+/i.exec(s.slice(i))
    if (depth === 0 && (c === ',' || and)) {
      parts.push(cur)
      cur = ''
      if (and) i += and[0].length - 1
      continue
    }
    cur += c
  }
  return [...parts, cur].map((p) => p.trim()).filter(Boolean)
}

/**
 * Allergens printed in brackets with a dish, as Sidney's menus do: "Salmon pasta bake (gluten, fish, milk)",
 * "Flapjack (contains: oats, may contain nuts)" or "(may contain: nuts)". Only a bracket whose every part is one of
 * the 14 counts, so "Fish (cod or haddock)" keeps its bracket. Returns the name without them.
 */
export function allergensFromName(name: string): { name: string; allergens: string[] } {
  const found: string[] = []
  let out = ''
  for (let i = 0; i < name.length; i++) {
    if (name[i] !== '(') {
      out += name[i]
      continue
    }
    let depth = 0
    let j = i
    for (; j < name.length; j++) {
      if (name[j] === '(') depth++
      else if (name[j] === ')' && --depth === 0) break
    }
    if (j >= name.length) {
      out += name.slice(i)
      break
    }
    const inner = name.slice(i + 1, j).trim()
    const may = MAY.exec(inner.toLowerCase())
    const parts = splitTop((may ? inner.slice(may[0].length) : inner).replace(/^(contains|allergens):?\s*/i, ''))
    const labels = parts.map((p) => (may ? `may contain ${p}` : p))
    if (labels.length && labels.every((l) => allergenFromLabel(l))) found.push(...labels)
    else out += name.slice(i, j + 1)
    i = j
  }
  return {
    name: out.replace(/\s{2,}/g, ' ').replace(/\s+([,.;])/g, '$1').trim(),
    allergens: allergensFromLabels(found, false),
  }
}
