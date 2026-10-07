// Types are derived from the zod schemas in scripts/schema.ts so the app, seed and ingest never drift.
export type {
  AccessLevel,
  College,
  Confidence,
  DataBundle,
  Day,
  DietTag,
  Dish,
  Formal,
  Meal,
  MenuDay,
  MenuFile,
  MenuSource,
  Provenance,
  ServiceSlot,
  SourceKind,
  Venue,
  VenueType,
} from '../../../scripts/schema.ts'
export { DAYS } from '../../../scripts/schema.ts'

import type { College, MenuFile, ServiceSlot, Venue } from '../../../scripts/schema.ts'

export type SlotWithCollege = ServiceSlot & { college: string }

/** Denormalised venue used throughout the UI. */
export type VenueView = Venue & {
  id: string
  college: College
  slots: SlotWithCollege[]
  menu?: MenuFile
}
