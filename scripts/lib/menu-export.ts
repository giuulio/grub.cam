import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

export type Row = Record<string, unknown>
export type ExportData = Record<'sites' | 'venues' | 'menu_days' | 'menu_items' | 'venue_prices' | 'service_slots', Row[]>
export const EXPORT_TABLES = {
  sites: ['slug,name,short_name,kind,official_dining_url', 'slug.asc'],
  venues: ['id,site,slug,name,type,url,menu_channel,menu_url,menu_scripted,price_terms,menu_labelling', 'id.asc'],
  menu_days: ['id,venue_id,date,service,note,alert,source_url,fetched_at,method,content_hash', 'id.asc'],
  menu_items: ['menu_day_id,position,dish_id,name,tags,allergens,course,price_gbp,price2_gbp,price_text,sold_out', 'menu_day_id.asc,position.asc'],
  venue_prices: ['venue_id,position,section,name,description,price_gbp,price_max_gbp,price_from,non_member_gbp,non_member_text,services,course,tags,observed_on,source', 'venue_id.asc,position.asc'],
  service_slots: ['id,venue_id,meal,days,start_time,end_time,period', 'id.asc'],
} satisfies Record<keyof ExportData, string[]>

export const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex')
export function csv(rows: Row[]): string {
  assert(rows.length, 'Cannot export a table without headers')
  const headers = Object.keys(rows[0])
  const field = (v: unknown) => {
    if (v == null) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
  }
  return [headers.join(','), ...rows.map((r) => headers.map((h) => field(r[h])).join(','))].join('\r\n') + '\r\n'
}
function publicSource(v: unknown): unknown {
  if (typeof v !== 'string') return v ?? null
  if (/\/storage\/v1\/object\/(?:sign|authenticated)\/|[?&](?:token|access_token|apikey|signature)=|sb_secret_|\beyJ[A-Za-z0-9_-]+\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(v)) return null
  try { const url = new URL(v); if (url.username || url.password) return null } catch { /* descriptive reference */ }
  return v
}
const array = (value: unknown): string[] => Array.isArray(value) ? value.map(String) : []
function flags(tags: unknown) {
  const ts = array(tags)
  return { tags_json: ts, labelled_vegan_or_plant_based: ts.includes('vegan') || ts.includes('plant_based'),
    labelled_vegetarian_or_vegan: ts.some((t) => ['vegetarian', 'vegan', 'plant_based'].includes(t)), has_any_diet_tag: ts.length > 0 }
}

export function exportRows(data: ExportData, date: string, served: Map<string, string>) {
  const sites = new Map(data.sites.map((s) => [s.slug, s]))
  const venues = new Map(data.venues.map((v) => [v.id, v]))
  const menus = new Map(data.menu_days.map((d) => [d.id, d]))
  assert.equal(venues.size, data.venues.length, 'Duplicate venue IDs')
  assert.equal(menus.size, data.menu_days.length, 'Duplicate menu IDs')
  const identity = (id: unknown) => {
    const v = venues.get(id); assert(v, 'Missing venue')
    const s = sites.get(v.site); assert(s, 'Missing site')
    return { site_id: s.slug, site_name: s.name, site_kind: s.kind, venue_id: v.id, venue_name: v.name, venue_type: v.type }
  }
  const counts = new Map<unknown, number>()
  const keys = new Set<string>()
  for (const i of data.menu_items) {
    assert(menus.has(i.menu_day_id), 'Item has no menu')
    const key = `${i.menu_day_id}/${i.position}`; assert(!keys.has(key), 'Duplicate dish appearance'); keys.add(key)
    counts.set(i.menu_day_id, (counts.get(i.menu_day_id) ?? 0) + 1)
  }
  const menuRows = data.menu_days.map((d) => ({ menu_id: d.id, ...identity(d.venue_id), date: d.date, service: d.service,
    service_served: served.get(String(d.id)) ?? d.service, note: d.note, alert: d.alert, item_count: counts.get(d.id) ?? 0,
    is_future_menu: String(d.date) > date, source_url: publicSource(d.source_url), fetched_at: d.fetched_at, method: d.method }))
  const menuMap = new Map(menuRows.map((d) => [d.menu_id, d]))
  const itemRows = data.menu_items.map((i) => {
    const d = menuMap.get(i.menu_day_id)!
    return { menu_id: d.menu_id, position: i.position, dish_id: String(i.dish_id), ...identity(d.venue_id), date: d.date,
      service: d.service, service_served: d.service_served, name: i.name, course: i.course, ...flags(i.tags),
      allergens_json: i.allergens, price_gbp: i.price_gbp, price2_gbp: i.price2_gbp, price_text: i.price_text, sold_out: i.sold_out,
      is_future_menu: d.is_future_menu, source_url: d.source_url, fetched_at: d.fetched_at, method: d.method }
  })
  const venueRows = data.venues.map((v) => {
    const terms = (v.price_terms ?? {}) as Row, labels = (v.menu_labelling ?? {}) as Row
    return { ...identity(v.id), venue_slug: v.slug, site_short_name: sites.get(v.site)!.short_name,
      official_dining_url: publicSource(sites.get(v.site)!.official_dining_url), venue_url: publicSource(v.url),
      menu_channel: v.menu_channel, menu_url: publicSource(v.menu_url), menu_scripted: v.menu_scripted,
      price_tiers_json: terms.tiers, price_terms_note: terms.note, price_terms_source: publicSource(terms.source),
      source_diet_codes: labels.diet_codes ?? 'unknown', source_allergens: labels.allergens ?? 'unknown',
      labelling_source_url: publicSource(labels.source_url), labelling_checked_on: labels.checked_on, labelling_note: labels.note }
  })
  const priceRows = data.venue_prices.map((p) => ({ ...identity(p.venue_id), position: p.position, section: p.section, name: p.name,
    description: p.description, line_kind: p.course == null ? 'item' : 'course_or_meal_price', course: p.course,
    services_json: p.services, ...flags(p.tags), price_gbp: p.price_gbp, price_max_gbp: p.price_max_gbp,
    non_member_gbp: p.non_member_gbp, non_member_text: p.non_member_text, observed_on: p.observed_on,
    source: publicSource(p.source), price_from: p.price_from }))
  const coverageRows = data.venues.map((v) => {
    const ds = menuRows.filter((d) => d.venue_id === v.id), its = itemRows.filter((i) => i.venue_id === v.id)
    const dates = ds.map((d) => String(d.date)).sort()
    return { ...identity(v.id), dated_menu_count: ds.length, distinct_menu_dates: new Set(dates).size,
      first_menu_date: dates[0] ?? null, last_menu_date: dates.at(-1) ?? null,
      menus_through_export_date: ds.filter((d) => !d.is_future_menu).length, future_menu_count: ds.filter((d) => d.is_future_menu).length,
      menus_without_items: ds.filter((d) => d.item_count === 0).length, item_appearances: its.length,
      labelled_vegan_or_plant_based_count: its.filter((i) => i.labelled_vegan_or_plant_based).length,
      items_without_diet_tags: its.filter((i) => !i.has_any_diet_tag).length, items_without_course: its.filter((i) => i.course == null).length,
      standing_menu_line_count: priceRows.filter((p) => p.venue_id === v.id).length }
  })
  const sort = (a: Row, b: Row) => `${a.venue_id}/${a.date ?? ''}/${a.service ?? ''}`.localeCompare(`${b.venue_id}/${b.date ?? ''}/${b.service ?? ''}`) || Number(a.position ?? 0) - Number(b.position ?? 0)
  return { 'menu_items.csv': itemRows.sort(sort), 'menus.csv': menuRows.sort(sort), 'venues.csv': venueRows.sort(sort),
    'standing_menu_items.csv': priceRows.sort(sort), 'coverage.csv': coverageRows.sort(sort) }
}

export const DEFINITIONS: Record<string, string> = {
  menu_id: 'Unique stored menu-day ID; joins items to menus. Item row key is menu_id + zero-based position.',
  dish_id: 'Text identifier grouping normalised dish names within a site; not a recipe identity.',
  date: 'Published service date, YYYY-MM-DD on the Europe/London calendar.',
  service: 'Stored source meal. Unique menu key: venue_id + date + service.',
  service_served: 'Derived Grub meal mapping using current service slots and Full Term calendar, e.g. Saturday Lunch to brunch; service retains the original key.',
  tags_json: 'JSON array of recorded diet tags. plant_based implies vegan, vegan implies vegetarian. Includes explicit whole-dish name labels; no recipe inference. [] means no tags recorded.',
  allergens_json: 'JSON array of source allergens and may-contain wording. [] means none recorded, never allergen-free or vegan.',
  labelled_vegan_or_plant_based: 'true if either tag is recorded. false means label absent, NOT non-vegan.',
  labelled_vegetarian_or_vegan: 'true if vegetarian, vegan or plant_based is recorded. A vegetarian-only label does not establish non-vegan status.',
  has_any_diet_tag: 'Any recorded diet tag, including halal or gluten_free. Does not establish known vegan status.',
  price_gbp: 'First posted price in GBP (or low end of a posted range). See venues price tiers/rules. Missing is not free.',
  price2_gbp: 'Second posted dated-dish price in GBP; see venues price tiers/rules.',
  non_member_gbp: 'Second standing-list price in GBP; its actual tier name is in venues.price_tiers_json, not necessarily non-member.',
  price_max_gbp: 'High end of a posted price range, GBP.', price_from: 'true means the posted price starts From this amount; false means not marked From.',
  price_tiers_json: 'JSON array of posted price-column names, in source order; blank means unknown. Do not compute percentage discounts.',
  services_json: 'JSON array of services for a standing item/price. Blank means no restriction recorded; does not establish daily dated availability.',
  course: 'Dated dish course: soup/main/side/dessert/other, blank unknown. On a standing list a nonblank course (also meal) prices a whole course or meal.',
  line_kind: 'item or course_or_meal_price. Do not count the latter as food options. Individual items may be drinks.',
  observed_on: 'Date a standing-list line was observed; not a menu service date or validity interval.',
  fetched_at: 'When this saved menu version was fetched/saved, not necessarily publication time or last successful check.',
  method: 'Save method: script/manual/user/contributor. script can include model-assisted document reading.',
  note: 'Menu-level source note, including possible cancellations or a menu posted elsewhere.',
  alert: 'Source note marked as a disruption; not every cancellation is an alert.',
  item_count: 'Stored dish appearances for this menu. Zero-item notes are retained; zero does not automatically mean closure.',
  source_url: 'Menu source reference; private storage links, token-bearing references and email references are omitted.',
  source: 'Standing-list source reference; access-sensitive references are omitted.',
  source_diet_codes: 'Verified separate diet-code/badge convention: present/absent/mixed/unknown. Explicit wording in names is distinct; even present does not guarantee every item is classified.',
  source_allergens: 'Verified source allergen convention: present/absent/mixed/unknown. Separate from vegan suitability.',
  labelling_checked_on: 'Date the labelling convention was verified, not a validity interval.',
  labelling_source_url: 'Evidence source for the convention; applies to that source, not necessarily later member photos.',
  labelling_note: 'Scope, wording and limits of the source labelling assessment.',
  is_future_menu: 'true when date is after the fixed export calendar date. Published future menus are plans.',
  site_kind: 'college or university.', venue_type: 'Stored base type hall/cafe/bar; a cafe can also operate as a bar.',
  name: 'Stored dish/price-list wording; ingest may normalise typography and extract diet/allergen labels.',
  position: 'Zero-based source order within its menu or venue price list.',
  sold_out: 'Posted sold-out marker. Blank unknown; not a sales or portions measure.',
  first_menu_date: 'First stored date; does not imply continuous coverage.', last_menu_date: 'Last stored date; does not imply continuous coverage.',
  items_without_diet_tags: 'Dated appearances without any diet tags; not non-vegan items.',
  labelled_vegan_or_plant_based_count: 'Dated appearances with either label, including future dates in this extract.',
  menus_without_items: 'Menu records without dish rows. Consult their notes.',
  menu_scripted: 'Configured for scripted ingestion; not a completeness guarantee.',
}
