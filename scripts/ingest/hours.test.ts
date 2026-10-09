import { describe, expect, it } from 'vitest'
import { parseDays, parseHours, parseTimes } from './hours.ts'

const head = 'site: clare\nvenue: buttery\nsource: board by the servery\nobserved: 2026-10-09\n'

describe('parseHours', () => {
  it('reads days as ranges, lists and words', () => {
    expect(parseDays('Mon–Fri')).toEqual(['mon', 'tue', 'wed', 'thu', 'fri'])
    expect(parseDays('Mon-Sat, Sun')).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
    expect(parseDays('Tue, Thu & Sun')).toEqual(['tue', 'thu', 'sun'])
    expect(parseDays('Sunday to Friday')).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sun'])
    expect(parseDays('daily')).toHaveLength(7)
    expect(parseDays('weekends')).toEqual(['sat', 'sun'])
    expect(() => parseDays('Mo, Fish')).toThrow(/not a day/)
  })
  it('reads 24-hour and am/pm times, a shared suffix, noon and midnight', () => {
    expect(parseTimes('12:30–13:30')).toEqual({ start: '12:30', end: '13:30' })
    expect(parseTimes('6.15pm-7.15pm')).toEqual({ start: '18:15', end: '19:15' })
    expect(parseTimes('6.15-7.15pm')).toEqual({ start: '18:15', end: '19:15' })
    expect(parseTimes('8am to 5pm')).toEqual({ start: '08:00', end: '17:00' })
    expect(parseTimes('7pm - midnight')).toEqual({ start: '19:00', end: '00:00' })
    expect(parseTimes('19:30')).toEqual({ start: '19:30' })
    expect(() => parseTimes('25:00-26:00')).toThrow(/not a time/)
  })
  it('reads slots with the header period as default, and a note', () => {
    const h = parseHours(head + 'period: term\n---\nlunch | Mon–Fri | 12:30–13:30\ndinner | Mon-Sun | 18:15-19:15 | all | Sunday from the College page\n# comment\n')
    expect(h).toEqual({
      venue: 'clare/buttery',
      source: 'board by the servery',
      observed_on: '2026-10-09',
      confidence: 'medium',
      slots: [
        { meal: 'lunch', days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '12:30', end: '13:30', period: 'term' },
        { meal: 'dinner', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], start: '18:15', end: '19:15', period: 'all', note: 'Sunday from the College page' },
      ],
    })
  })
  it('gives a start-only line two hours and says the end is unpublished', () => {
    const h = parseHours(head + '---\nformal | Tue, Thu, Sun | 19:30 | term\nbar | Fri | 11pm')
    expect(h.slots[0]).toMatchObject({ meal: 'formal', start: '19:30', end: '21:30', note: 'end not published (about two hours)' })
    expect(h.slots[1]).toMatchObject({ meal: 'bar', start: '23:00', end: '01:00', note: 'end not published' })
  })
  it('rejects unknown meals and periods, and a header without a date', () => {
    expect(() => parseHours(head + '---\nelevenses | Mon | 11:00-11:30')).toThrow()
    expect(() => parseHours(head + '---\nlunch | Mon | 12:00-13:00 | sometimes')).toThrow(/period/)
    expect(() => parseHours('site: c\nvenue: v\nsource: s\n---\nlunch | Mon | 12:00-13:00')).toThrow(/observed/)
  })
})
