import type { DietTag, Dish } from '../../schema.ts'

/** Map a source's explicit label (icon alt, tag name, code) to our DietTag. */
export function tagFromLabel(label: string): DietTag | undefined {
  const s = label.trim().toLowerCase()
  if (!s) return undefined
  if (s === 'vv' || s === 've' || s === 'vg' || s === 'vgn' || s === 'vn' || /vegan|plant.?based/.test(s)) return /plant.?based/.test(s) ? 'plant_based' : 'vegan'
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
    .trim()
}
