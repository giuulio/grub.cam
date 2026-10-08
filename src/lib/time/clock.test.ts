import { describe, expect, it } from 'vitest'
import { addMonthsYM, isISODate, monthCells, relativeDay } from './clock.ts'

describe('calendar helpers', () => {
  it('lays a month out Monday-first', () => {
    // 1 Oct 2026 is a Thursday
    const cells = monthCells('2026-10')
    expect(cells.slice(0, 4)).toEqual([null, null, null, '2026-10-01'])
    expect(cells.at(-1)).toBe('2026-10-31')
    expect(monthCells('2027-02').filter(Boolean)).toHaveLength(28)
  })
  it('steps months across years', () => {
    expect(addMonthsYM('2026-12', 1)).toBe('2027-01')
    expect(addMonthsYM('2026-01', -1)).toBe('2025-12')
  })
  it('accepts only real dates', () => {
    expect(isISODate('2026-10-08')).toBe(true)
    expect(isISODate('2026-02-30')).toBe(false)
    expect(isISODate('8 Oct')).toBe(false)
  })
  it('names nearby days', () => {
    expect(relativeDay('2026-10-09', '2026-10-08')).toBe('Tomorrow')
    expect(relativeDay('2026-10-07', '2026-10-08')).toBe('Yesterday')
    expect(relativeDay('2026-10-12', '2026-10-08')).toBeUndefined()
  })
})
