import { expect, it } from 'vitest'
import { formalWhen } from './formal.ts'
import type { Venue } from './types.ts'

it('shows dated formal starts without inventing finishing or recurring times', () => {
  const venue = {
    slots: [],
    menu: [
      { date: '2026-10-22', service: 'formal', items: [], note: 'Heritage Formal Hall. Starts 19:00; end not published.' },
      { date: '2026-10-23', service: 'formal', items: [], note: 'Black History Formal Hall. Starts 19:00; end not published.' },
    ],
  } as unknown as Venue
  expect(formalWhen(venue, { days: ['thu', 'fri'] })).toEqual(['Thu 22 Oct · 19:00', 'Fri 23 Oct · 19:00'])
  expect(formalWhen({ ...venue, menu: [] }, { days: ['thu', 'fri'] })).toEqual(['Thu, Fri · time not published'])
})
