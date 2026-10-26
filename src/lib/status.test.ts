import { describe, expect, it } from 'vitest'
import { statusWords } from './status.ts'
import type { Slot } from './types.ts'

const slot = (p: Partial<Slot> = {}): Slot => ({ meal: 'lunch', days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '12:00', end: '13:30', period: 'all', ...p })
const today = '2026-10-07' // a Wednesday

describe('statusWords', () => {
  it('says until when while open, leading with the meal only when asked', () => {
    const s = { kind: 'open', slot: slot(), closesInMin: 30, date: today } as const
    expect(statusWords(s, today)).toMatchObject({ text: 'Open', detail: 'until 13:30' })
    expect(statusWords(s, today, { meal: true })).toMatchObject({ text: 'Lunch', detail: 'until 13:30' })
    // A café-bar's café and bar hours are just open, as a café's are
    expect(statusWords({ ...s, slot: slot({ meal: 'snacks' }) }, today, { meal: true }).text).toBe('Open')
    expect(statusWords({ kind: 'opening', slot: slot({ meal: 'bar', start: '20:00' }), opensInMin: 60, date: today }, today, { meal: true }).text).toBe('Opens 20:00')
  })

  it('gives the time it opens today, tomorrow, or the weekday after that', () => {
    expect(statusWords({ kind: 'opening', slot: slot(), opensInMin: 60, date: today }, today).text).toBe('Opens 12:00')
    expect(statusWords({ kind: 'opening', slot: slot({ meal: 'dinner', start: '18:00' }), opensInMin: 60, date: today }, today, { meal: true })).toMatchObject({ text: 'Dinner 18:00' })
    expect(statusWords({ kind: 'closed', next: { slot: slot(), date: '2026-10-08', opensInMin: 900 } }, today).text).toBe('Opens tomorrow 12:00')
    expect(statusWords({ kind: 'closed', next: { slot: slot(), date: '2026-10-12', opensInMin: 6000 } }, today).text).toBe('Opens Mon 12:00')
    expect(statusWords({ kind: 'closed', next: { slot: slot({ meal: 'breakfast', start: '07:30' }), date: '2026-10-08', opensInMin: 900 } }, today, { meal: true }).text).toBe('Breakfast tomorrow 07:30')
  })

  it('never says formal hall "opens"', () => {
    const formal = slot({ meal: 'formal', start: '19:30', end: '21:00' })
    expect(statusWords({ kind: 'opening', slot: formal, opensInMin: 60, date: today }, today, { meal: true })).toMatchObject({ formal: true, text: 'Formal hall 19:30' })
    expect(statusWords({ kind: 'open', slot: formal, closesInMin: 60, date: today }, today)).toMatchObject({ text: 'Formal hall', detail: 'until 21:00' })
  })

  it('says when nothing is known or nothing is coming', () => {
    expect(statusWords({ kind: 'unknown' }, today).text).toBe('Hours not published')
    expect(statusWords({ kind: 'closed' }, today).text).toBe('Closed')
  })
})
