import { describe, expect, it } from 'vitest'
import type { Slot } from '../types.ts'
import type { LocalNow } from './clock.ts'
import { formatDays } from './clock.ts'
import { openStatus, slotApplies } from './openNow.ts'

const slot = (p: Partial<Slot>): Slot => ({
  meal: 'lunch',
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  start: '12:00',
  end: '14:00',
  period: 'all',
  ...p,
})

// Wed 7 Oct 2026 is in Michaelmas Full Term; Wed 23 Dec 2026 is vacation.
const at = (date: string, hhmm: string): LocalNow => {
  const [h, m] = hhmm.split(':').map(Number)
  const [y, mo, d] = date.split('-').map(Number)
  const idx = (new Date(Date.UTC(y, mo - 1, d)).getUTCDay() + 6) % 7
  return { date, day: (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const)[idx], minutes: h * 60 + m }
}

describe('openStatus', () => {
  it('is open during a weekday lunch slot', () => {
    const s = openStatus([slot({})], at('2026-10-07', '12:30'))
    expect(s.kind).toBe('open')
    if (s.kind === 'open') expect(s.closesInMin).toBe(90)
  })

  it('reports opening later today', () => {
    const s = openStatus([slot({})], at('2026-10-07', '10:00'))
    expect(s.kind).toBe('opening')
    if (s.kind === 'opening') expect(s.opensInMin).toBe(120)
  })

  it('reports closed with next service tomorrow after the last slot', () => {
    const s = openStatus([slot({})], at('2026-10-07', '20:00'))
    expect(s.kind).toBe('closed')
    if (s.kind === 'closed') {
      expect(s.next?.date).toBe('2026-10-08')
      expect(s.next?.opensInMin).toBe(4 * 60 + 12 * 60)
    }
  })

  it('skips the weekend to find Monday', () => {
    const s = openStatus([slot({})], at('2026-10-10', '12:00')) // Saturday
    expect(s.kind).toBe('closed')
    if (s.kind === 'closed') expect(s.next?.date).toBe('2026-10-12')
  })

  it('handles bars crossing midnight', () => {
    const bar = slot({ meal: 'bar', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], start: '17:00', end: '00:00' })
    expect(openStatus([bar], at('2026-10-07', '23:30')).kind).toBe('open')
    const late = slot({ meal: 'bar', days: ['fri'], start: '21:00', end: '01:00' })
    const s = openStatus([late], at('2026-10-10', '00:30')) // Saturday 00:30, Friday's bar still open
    expect(s.kind).toBe('open')
    if (s.kind === 'open') expect(s.closesInMin).toBe(30)
  })

  it('respects term-only slots', () => {
    const term = slot({ period: 'term' })
    expect(slotApplies(term, '2026-10-07')).toBe(true)
    expect(slotApplies(term, '2026-12-23')).toBe(false)
    const vac = slot({ period: 'vacation' })
    expect(slotApplies(vac, '2026-10-07')).toBe(false)
    expect(slotApplies(vac, '2026-12-23')).toBe(true)
  })

  it('picks the day-specific dinner variant', () => {
    const a = slot({ meal: 'dinner', days: ['mon', 'tue', 'fri', 'sun'], start: '17:30', end: '18:30' })
    const b = slot({ meal: 'dinner', days: ['wed', 'thu', 'sat'], start: '17:45', end: '18:45' })
    const s = openStatus([a, b], at('2026-10-07', '18:40')) // Wednesday
    expect(s.kind).toBe('open')
    if (s.kind === 'open') expect(s.slot.start).toBe('17:45')
  })

  it('filters by meal', () => {
    const lunch = slot({})
    const dinner = slot({ meal: 'dinner', start: '18:00', end: '19:00' })
    const s = openStatus([lunch, dinner], at('2026-10-07', '12:30'), ['dinner'])
    expect(s.kind).toBe('opening')
  })

  it('returns unknown with no slots', () => {
    expect(openStatus([], at('2026-10-07', '12:30')).kind).toBe('unknown')
  })
})

describe('formatDays', () => {
  it('compresses runs', () => {
    expect(formatDays(['mon', 'tue', 'wed', 'thu', 'fri'])).toBe('Mon–Fri')
    expect(formatDays(['sat', 'sun'])).toBe('Sat, Sun')
    expect(formatDays(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).toBe('Daily')
    expect(formatDays(['mon', 'wed', 'thu', 'sat', 'sun'])).toBe('Mon, Wed, Thu, Sat, Sun')
  })
})
