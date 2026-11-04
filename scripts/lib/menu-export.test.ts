import { describe, expect, it } from 'vitest'
import { csv, exportRows, type ExportData } from './menu-export.ts'
describe('research menu export', () => {
  const data: ExportData = {
    sites: [{ slug: 'test', name: 'Test', kind: 'college' }], venues: [{ id: 'test/hall', site: 'test', name: 'Hall', menu_labelling: { diet_codes: 'absent', allergens: 'present' } }],
    menu_days: [{ id: 'm1', venue_id: 'test/hall', date: '2026-11-04', service: 'lunch', note: 'Menu elsewhere' }, { id: 'm2', venue_id: 'test/hall', date: '2026-11-05', service: 'dinner' }],
    menu_items: [{ menu_day_id: 'm2', position: 0, dish_id: 1, name: 'Curry', tags: [], allergens: [] }], venue_prices: [], service_slots: [],
  }
  it('keeps zero-item menus, unknown labels, source conventions and future dates distinct', () => {
    const out = exportRows(data, '2026-11-04', new Map())
    expect(out['menus.csv'][0].item_count).toBe(0)
    expect(out['menu_items.csv'][0]).toMatchObject({ labelled_vegan_or_plant_based: false, is_future_menu: true })
    expect(out['venues.csv'][0]).toMatchObject({ source_diet_codes: 'absent', source_allergens: 'present' })
    expect(out['coverage.csv'][0]).toMatchObject({ item_appearances: 1, menus_without_items: 1, future_menu_count: 1 })
  })
  it('rejects duplicate item keys and missing parents rather than silently losing rows', () => {
    expect(() => exportRows({ ...data, menu_items: [...data.menu_items, ...data.menu_items] }, '2026-11-04', new Map())).toThrow(/Duplicate/)
    expect(() => exportRows({ ...data, menu_days: [] }, '2026-11-04', new Map())).toThrow(/no menu/)
  })
  it('preserves commas, quotes, newlines, booleans, zero, null and JSON arrays in CSV', () => {
    expect(csv([{ name: 'Rice, "beans"\nSoup', price: 0, tags: ['vegan'], flag: false, unknown: null }])).toBe('name,price,tags,flag,unknown\r\n"Rice, ""beans""\nSoup",0,"[""vegan""]",false,\r\n')
  })
})
