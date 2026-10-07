import { z } from 'zod'

// ---------- shared ----------

export const Day = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
export type Day = z.infer<typeof Day>
export const DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export const Meal = z.enum(['breakfast', 'brunch', 'lunch', 'dinner', 'snacks', 'bar'])
export type Meal = z.infer<typeof Meal>

export const DietTag = z.enum([
  'vegetarian',
  'vegan',
  'plant_based',
  'halal',
  'gluten_free',
  'kosher',
  'pescatarian',
  'dairy_free',
])
export type DietTag = z.infer<typeof DietTag>

export const SourceKind = z.enum([
  'official',
  'reported',
  'google_maps',
  'lead',
  'llm_run',
  'scraper',
  'user',
  'unknown',
])
export type SourceKind = z.infer<typeof SourceKind>

export const Confidence = z.enum(['high', 'medium', 'low'])
export type Confidence = z.infer<typeof Confidence>

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM')

export const Provenance = z.object({
  source_kind: SourceKind.default('official'),
  source_url: z.string().url().optional(),
  observed_at: isoDate.optional(),
  confidence: Confidence.default('medium'),
  note: z.string().optional(),
})
export type Provenance = z.infer<typeof Provenance>

// ---------- reference data ----------

export const AccessLevel = z.enum(['public', 'members_guests', 'members_only', 'unknown'])
export type AccessLevel = z.infer<typeof AccessLevel>

export const MenuSource = z.object({
  kind: z.enum(['html', 'pdf', 'docx', 'json', 'app', 'intranet', 'email', 'social', 'none', 'unknown']),
  platform: z.string().optional(),
  url: z.string().url().optional(),
  urls: z.record(z.string(), z.string().url()).optional(),
  data_url: z.string().optional(),
  cadence: z.string().optional(),
  coverage: z.string().optional(),
  includes: z.array(z.string()).default([]),
  status: z.enum(['live', 'members_only', 'none', 'unverified']),
  checked: isoDate,
  notes: z.string().optional(),
})
export type MenuSource = z.infer<typeof MenuSource>

export const VenueType = z.enum(['hall', 'cafe', 'bar', 'other'])
export type VenueType = z.infer<typeof VenueType>

export const Venue = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  type: VenueType,
  where: z.string().optional(),
  hours_text: z.string().optional(),
  access: z.object({
    level: AccessLevel.default('unknown'),
    text: z.string().optional(),
    prov: Provenance.prefault({}),
  }),
  payment: z.object({
    university_card: z.boolean().optional(),
    bank_card: z.boolean().optional(),
    cash: z.boolean().optional(),
    text: z.string().optional(),
    prov: Provenance.prefault({}),
  }),
  prices: z.object({ text: z.string(), prov: Provenance.prefault({}) }).optional(),
  serves: z.string().optional(),
  dietary: z.object({
    tags: z.array(DietTag).default([]),
    text: z.string().optional(),
    prov: Provenance.prefault({}),
  }),
  menu_source: MenuSource.optional(),
})
export type Venue = z.infer<typeof Venue>

export const Formal = z.object({
  where: z.string().optional(),
  days_text: z.string().optional(),
  days: z.array(Day).optional(),
  time: z.string().optional(),
  dress: z.string().optional(),
  format: z.string().optional(),
  booking: z.string().optional(),
  guests: z.string().optional(),
  cost: z.string().optional(),
  prov: Provenance.prefault({}),
})
export type Formal = z.infer<typeof Formal>

export const College = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  short_name: z.string().optional(),
  official_dining_url: z.string().url().optional(),
  reviewed: isoDate,
  notice: z.string().optional(),
  links: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
  venues: z.array(Venue).min(1),
  formal: Formal.optional(),
  notes: z.array(z.string()).default([]),
})
export type College = z.infer<typeof College>

// ---------- structured hours ----------

/** Expand "mon-fri", "daily", "sat,sun", "mon-thu,sat" into Day[]. */
export function expandDays(input: unknown): unknown {
  if (typeof input !== 'string') return input
  const s = input.trim().toLowerCase()
  if (s === 'daily' || s === 'all') return [...DAYS]
  const out: Day[] = []
  for (const part of s.split(',')) {
    const p = part.trim()
    const range = p.match(/^(\w{3})-(\w{3})$/)
    if (range) {
      const a = DAYS.indexOf(range[1] as Day)
      const b = DAYS.indexOf(range[2] as Day)
      if (a < 0 || b < 0) return input
      for (let i = a; ; i = (i + 1) % 7) {
        out.push(DAYS[i])
        if (i === b) break
      }
    } else out.push(p as Day)
  }
  return out
}

export const ServiceSlot = z.object({
  venue: z.string(),
  meal: Meal,
  days: z.preprocess(expandDays, z.array(Day).min(1)),
  start: hhmm,
  end: hhmm,
  period: z.enum(['term', 'vacation', 'all']).default('all'),
  note: z.string().optional(),
  prov: Provenance.prefault({}),
}).strict() // an unquoted "days: sat,sun" inside { } parses as a stray "sun" key — fail instead of dropping it
export type ServiceSlot = z.infer<typeof ServiceSlot>

export const HoursFile = z.object({
  college: z.string(),
  slots: z.array(ServiceSlot),
})
export type HoursFile = z.infer<typeof HoursFile>

// ---------- menus ----------

export const Dish = z.object({
  name: z.string().min(1),
  tags: z.array(DietTag).default([]),
  price_gbp: z.number().optional(),
  price_text: z.string().optional(),
  course: z.enum(['soup', 'main', 'side', 'dessert', 'other']).optional(),
  sold_out: z.boolean().optional(),
})
export type Dish = z.infer<typeof Dish>

export const MenuDay = z.object({
  date: isoDate,
  service: Meal,
  items: z.array(Dish),
  note: z.string().optional(),
})
export type MenuDay = z.infer<typeof MenuDay>

export const MenuFile = z.object({
  college: z.string(),
  venue: z.string(),
  week: z.string().regex(/^\d{4}-W\d{2}$/),
  source_url: z.string().url(),
  fetched_at: z.string(),
  method: z.enum(['script', 'llm', 'manual']),
  note: z.string().optional(),
  days: z.array(MenuDay),
})
export type MenuFile = z.infer<typeof MenuFile>

// ---------- compiled bundle served to the app ----------

export const DataBundle = z.object({
  generated_at: z.string(),
  colleges: z.array(College),
  slots: z.array(ServiceSlot.extend({ college: z.string() })),
  menus: z.array(MenuFile),
})
export type DataBundle = z.infer<typeof DataBundle>
