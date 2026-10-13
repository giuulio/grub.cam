import { describe, expect, it } from 'vitest'
import { ago, scored, standings, tally } from './contributors.ts'
import type { Contribution } from './types.ts'

const venues = [
  { id: 'c/hall', type: 'hall' as const },
  { id: 'c/cafe', type: 'cafe' as const },
]
let n = 0
const row = (over: Partial<Contribution>): Contribution => ({
  id: `id${++n}`,
  venue_id: 'c/cafe',
  kind: 'prices',
  topic: null,
  date: null,
  service: null,
  author: 'Ada Lovelace',
  member: 'ada',
  created_at: '2026-10-13T10:00:00Z',
  published_at: '2026-10-13T10:05:00Z',
  ...over,
})

describe('scored', () => {
  it('scores what each adds: a menu most, a café price list or hours next, a hall price list or a photo least', () => {
    const points = scored(
      [
        row({ kind: 'menu', venue_id: 'c/hall', date: '2026-10-13', service: 'lunch' }),
        row({ kind: 'prices' }),
        row({ kind: 'prices', venue_id: 'c/hall' }),
        row({ kind: 'hours' }),
        row({ kind: 'photo' }),
        row({ kind: 'other', topic: 'formal' }),
      ],
      venues,
    ).map((r) => [r.kind, r.venue_id, r.points])
    expect(points).toEqual([
      ['menu', 'c/hall', 4],
      ['prices', 'c/cafe', 3],
      ['prices', 'c/hall', 1],
      ['hours', 'c/cafe', 3],
      ['photo', 'c/cafe', 1],
      ['other', 'c/cafe', 1],
    ])
  })

  it('counts only the first of a kind for a venue on a (London) day, whoever sent it', () => {
    const rows = scored(
      [
        row({ kind: 'photo', created_at: '2026-10-13T12:35:00Z', member: 'ada' }),
        row({ kind: 'photo', created_at: '2026-10-13T12:34:00Z', member: 'bob', author: 'Bob' }),
        // 00:30 on the 14th in London: another day
        row({ kind: 'photo', created_at: '2026-10-13T23:30:00Z' }),
      ],
      venues,
    )
    expect(rows.map((r) => [r.member, r.created_at.slice(11, 16), r.points])).toEqual([
      ['bob', '12:34', 1],
      ['ada', '12:35', 0],
      ['ada', '23:30', 1],
    ])
  })

  it('counts each menu day and meal once, whenever it was sent', () => {
    const rows = scored(
      [
        row({ kind: 'menu', venue_id: 'c/hall', date: '2026-10-14', service: 'lunch' }),
        row({ kind: 'menu', venue_id: 'c/hall', date: '2026-10-14', service: 'dinner' }),
        row({ kind: 'menu', venue_id: 'c/hall', date: '2026-10-14', service: 'lunch', created_at: '2026-10-14T09:00:00Z' }),
      ],
      venues,
    )
    expect(rows.map((r) => r.points)).toEqual([4, 4, 0])
  })
})

describe('standings', () => {
  const rows = scored(
    [
      row({ member: 'ada', kind: 'hours', created_at: '2026-10-12T09:00:00Z' }),
      row({ member: 'bob', author: 'Bob', kind: 'prices', created_at: '2026-10-13T09:00:00Z' }),
      row({ member: 'ada', author: 'Ada L.', kind: 'photo', created_at: '2026-10-13T11:00:00Z' }),
      row({ member: 'cat', author: 'Cat', kind: 'menu', venue_id: 'c/hall', date: '2026-10-05', service: 'lunch', created_at: '2026-10-05T12:00:00Z' }),
    ],
    venues,
  )

  it('adds up points since a date, most first, a tie to whoever got there first', () => {
    expect(standings(rows, '2026-10-12').map((s) => [s.author, s.points])).toEqual([
      ['Ada L.', 4],
      ['Bob', 3],
    ])
    expect(standings(rows, '2026-10-13').map((s) => [s.author, s.points])).toEqual([
      ['Bob', 3],
      ['Ada L.', 1],
    ])
    expect(standings(rows, '').map((s) => s.author)).toEqual(['Cat', 'Ada L.', 'Bob'])
  })

  it('says what the points are for', () => {
    expect(tally(standings(rows, '').find((s) => s.member === 'ada')!.counts)).toBe('1 set of hours · 1 photo')
    expect(tally({ menu: 3, prices: 1 })).toBe('3 menus · 1 price list')
  })
})

describe('ago', () => {
  const now = new Date('2026-10-13T15:00:00Z')
  it('says when as a person would', () => {
    expect(ago('2026-10-13T14:59:30Z', now)).toBe('just now')
    expect(ago('2026-10-13T14:35:00Z', now)).toBe('25 min ago')
    expect(ago('2026-10-13T12:00:00Z', now)).toBe('3 h ago')
    expect(ago('2026-10-12T12:00:00Z', now)).toBe('yesterday')
    expect(ago('2026-10-09T12:00:00Z', now)).toBe('9 Oct')
  })
})
