import { describe, expect, it } from 'vitest'
import { groupMondays } from './downing.ts'

describe('Downing Kafoodle weeks', () => {
  it('reads WEEK n as a week of a three-week cycle from the start of Full Term', () => {
    // Full Term starts Tue 6 Oct 2026: week 1 is Mon 5 Oct; WEEK 1 came back on 26 Oct, WEEK 2 on 2 Nov
    expect(groupMondays('MICHAELMAS 2026 WEEK 1').slice(0, 3)).toEqual(['2026-10-05', '2026-10-26', '2026-11-16'])
    expect(groupMondays('MICHAELMAS 2026 WEEK 2').slice(0, 2)).toEqual(['2026-10-12', '2026-11-02'])
    expect(groupMondays('MICHAELMAS 2026 WEEK 3')[0]).toBe('2026-10-19')
  })
  it('knows no week for a group outside the term dates it has', () => {
    expect(groupMondays('FORMAL HALL MENUS')).toEqual([])
    expect(groupMondays('MICHAELMAS 2031 WEEK 1')).toEqual([])
  })
})
