// University of Cambridge Full Term dates (https://www.cam.ac.uk/about-the-university/term-dates-and-calendars).
// Many College hours apply only in Full Term; outside it we fall back to "vacation" slots where published.
export type Term = { name: string; start: string; end: string }

export const FULL_TERMS: Term[] = [
  { name: 'Michaelmas 2026', start: '2026-10-06', end: '2026-12-04' },
  { name: 'Lent 2027', start: '2027-01-19', end: '2027-03-19' },
  { name: 'Easter 2027', start: '2027-04-27', end: '2027-06-18' },
]

export function currentTerm(isoDate: string): Term | undefined {
  return FULL_TERMS.find((t) => isoDate >= t.start && isoDate <= t.end)
}

export function isFullTerm(isoDate: string): boolean {
  return currentTerm(isoDate) !== undefined
}
