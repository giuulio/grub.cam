import { describe, expect, it } from 'vitest'
import { parseManual } from './manual.ts'

const header = 'site: trinity\nvenue: hall-servery\nsource: official PDF\n---\n'

describe('manual menu cancellations', () => {
  it('keeps published dates however far into the future', () => {
    expect(parseManual(header + '2032-10-12 lunch\nPublished soup (V)\n').days[0].date).toBe('2032-10-12')
  })
  it('keeps explicit cancellations without inventing dishes, and omits an empty unpublished meal', () => {
    const m = parseManual(header + '2026-10-13 lunch\nSoup (V)\n2026-10-13 dinner | No dinner – UG freshers formal hall\n2026-10-18 brunch\n')
    expect(m.days).toEqual([
      { date: '2026-10-13', service: 'lunch', items: [{ name: 'Soup', tags: ['vegetarian'], course: 'main' }] },
      { date: '2026-10-13', service: 'dinner', note: 'No dinner – UG freshers formal hall', items: [] },
    ])
  })
  it('recognises a cancellation transcribed on a separate line', () => {
    expect(parseManual(header + '2026-10-17 dinner\nNo dinner – matriculation dinner\n').days[0]).toMatchObject({ items: [], note: 'No dinner – matriculation dinner' })
  })
  it('keeps a meal posted elsewhere as its note alone, still served', () => {
    const m = parseManual(header + '2026-10-16 dinner | European Night, see posters for details\n2026-10-17 dinner\n')
    expect(m.days).toEqual([{ date: '2026-10-16', service: 'dinner', note: 'European Night, see posters for details', items: [] }])
  })
  it('rejects contradictory dishes and a cancellation', () => {
    expect(() => parseManual(header + '2026-10-13 dinner | No dinner – formal hall\nSoup')).toThrow(/cancelled meal/)
  })
})

describe('manual menu alerts', () => {
  it('a leading "!" makes the note an alert, without the mark', () => {
    const m = parseManual(header + '2026-10-13 lunch | ! Served at the top table after a leak\nSoup\n2026-10-13 dinner | Pie night\nPie\n')
    expect(m.days.map((d) => [d.note, d.alert])).toEqual([['Served at the top table after a leak', true], ['Pie night', undefined]])
  })
})
