import { describe, expect, it } from 'vitest'
import type { Slot } from '../types.ts'
import type { LocalNow } from './clock.ts'
import { formatDays } from './clock.ts'
import { noteTimes, openStatus, servedService, slotApplies, withDayTimes } from './openNow.ts'
import { mealCancelled } from '../menuNotes.ts'

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
  it('says a run with one day out of it as that', () => {
    expect(formatDays(['mon', 'tue', 'wed', 'thu', 'fri', 'sun'])).toBe('Daily except Sat')
    expect(formatDays(['mon', 'tue', 'wed', 'thu', 'fri', 'sun'], true)).toBe('Except Sat')
    expect(formatDays(['mon', 'tue', 'thu', 'fri'])).toBe('Mon–Fri except Wed')
    expect(formatDays(['tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).toBe('Tue–Sun')
    expect(formatDays(['mon', 'wed', 'thu'])).toBe('Mon, Wed, Thu')
  })
})

describe('servedService', () => {
  const week = [slot({ meal: 'lunch' }), slot({ meal: 'brunch', days: ['sat', 'sun'], start: '11:30', end: '13:00' }), slot({ meal: 'dinner', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sun'] })]
  it("files a Saturday 'lunch' under the brunch served that day", () => {
    expect(servedService([{ date: '2026-10-10', service: 'lunch' }], week)).toEqual([{ date: '2026-10-10', service: 'brunch' }])
  })
  it('leaves a meal that is served, and a day without hours, as posted', () => {
    expect(servedService([{ date: '2026-10-07', service: 'lunch' }], week)[0].service).toBe('lunch')
    expect(servedService([{ date: '2026-10-10', service: 'dinner' }], week)[0].service).toBe('dinner')
    expect(servedService([{ date: '2026-10-10', service: 'lunch' }], [])[0].service).toBe('lunch')
  })
  it("doesn't file two menus under one brunch", () => {
    const days = servedService([{ date: '2026-10-10', service: 'breakfast' }, { date: '2026-10-10', service: 'lunch' }], week)
    expect(days.map((d) => d.service)).toEqual(['brunch', 'lunch'])
  })
})

describe('a day’s changed hours', () => {
  // St Edmund's: dinner is usually 18:30–19:45 on weekdays; Monday 12 Oct 2026's menu says 18:00–18:45
  const dinner = slot({ meal: 'dinner', start: '18:30', end: '19:45' })
  const days = [{ date: '2026-10-12', service: 'dinner' as const, note: 'Dinner 18:00–18:45 this Monday' }]
  const at = (date: string, day: LocalNow['day'], hhmm: string): LocalNow => ({ date, day, minutes: Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)) })

  it('reads the times a note gives', () => {
    expect(noteTimes('Dinner 18:00–18:45 this Monday')).toEqual({ start: '18:00', end: '18:45' })
    expect(noteTimes('Brunch 9:30-12:00')).toEqual({ start: '09:30', end: '12:00' })
    expect(noteTimes('Welcome Formal, 19:00')).toBeUndefined()
    expect(noteTimes(undefined)).toBeUndefined()
  })
  it('serves the meal at those times that day, and as usual on others', () => {
    const slots = withDayTimes([dinner], days)
    expect(openStatus(slots, at('2026-10-12', 'mon', '19:00')).kind).toBe('closed')
    expect(openStatus(slots, at('2026-10-12', 'mon', '18:10'))).toMatchObject({ kind: 'open', closesInMin: 35 })
    expect(openStatus(slots, at('2026-10-13', 'tue', '19:00'))).toMatchObject({ kind: 'open', closesInMin: 45 })
  })
  it('leaves the hours alone when the note gives the usual times', () => {
    const same = [{ date: '2026-10-12', service: 'dinner' as const, note: 'Dinner 18:30–19:45' }]
    expect(withDayTimes([dinner], same)).toEqual([dinner])
  })
  it('changes café closing for its date and adds a one-off bar opening without changing the usual slots', () => {
    const cafe = slot({ meal: 'snacks', start: '08:00', end: '21:00' })
    const changed = withDayTimes([cafe], [
      { date: '2026-10-22', service: 'snacks', note: 'Café Lucy 08:00–20:00 this Thursday' },
      { date: '2026-10-22', service: 'bar', note: 'Nautilus Bar 20:00–23:00 this Thursday' },
    ])
    expect(openStatus(changed, at('2026-10-22', 'thu', '20:30'), ['snacks']).kind).toBe('closed')
    expect(openStatus(changed, at('2026-10-22', 'thu', '20:30'), ['bar']).kind).toBe('open')
    expect(openStatus(changed, at('2026-10-29', 'thu', '20:30'), ['snacks']).kind).toBe('open')
    expect(changed.filter((s) => s.meal === 'bar').some((s) => slotApplies(s, '2026-10-29'))).toBe(false)
    expect(cafe).not.toHaveProperty('except')
  })
  it('cancels only the named meal and date, keeping the usual week intact', () => {
    const usual = [slot({}), dinner]
    const changed = withDayTimes(usual, [{ date: '2026-10-13', service: 'dinner', note: 'No dinner – UG freshers formal hall' }])
    expect(openStatus(changed, at('2026-10-13', 'tue', '19:00')).kind).toBe('closed')
    expect(openStatus(changed, at('2026-10-13', 'tue', '12:30')).kind).toBe('open')
    expect(openStatus(changed, at('2026-10-14', 'wed', '19:00')).kind).toBe('open')
    expect(openStatus(usual, at('2026-10-13', 'tue', '19:00')).kind).toBe('open')
  })
  it('does not treat missing menu information or another meal’s cancellation as a closure', () => {
    expect(mealCancelled({ service: 'dinner', note: 'No dinner menu published' })).toBe(false)
    expect(mealCancelled({ service: 'lunch', note: 'No dinner – formal hall' })).toBe(false)
    expect(mealCancelled({ service: 'dinner', note: 'No dinner' })).toBe(true)
  })
})
