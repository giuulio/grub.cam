import type { DataBundle, MenuFile, VenueView } from './types.ts'

/** Denormalise the bundle into venue views, attaching slots and the most recent menu file. */
export function buildVenueViews(bundle: DataBundle): VenueView[] {
  const slotsByVenue = new Map<string, DataBundle['slots']>()
  for (const s of bundle.slots) {
    const k = `${s.college}/${s.venue}`
    const list = slotsByVenue.get(k) ?? []
    list.push(s)
    slotsByVenue.set(k, list)
  }
  const menuByVenue = new Map<string, MenuFile>()
  for (const m of bundle.menus) {
    const k = `${m.college}/${m.venue}`
    const prev = menuByVenue.get(k)
    if (!prev || m.week > prev.week) menuByVenue.set(k, m)
    else if (m.week === prev.week) prev.days = [...prev.days, ...m.days]
  }
  const out: VenueView[] = []
  for (const college of bundle.colleges) {
    for (const v of college.venues) {
      const id = `${college.slug}/${v.slug}`
      out.push({ ...v, id, college, slots: slotsByVenue.get(id) ?? [], menu: menuByVenue.get(id) })
    }
  }
  return out
}
