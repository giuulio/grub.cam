// Which reicon (reicon.dev) stands for what, so every page uses the same one: a cup and saucer for cafés (a mug reads
// as beer), a cocktail glass for bars, a bow tie for formal hall (reicon has none: drawn here in its 24px, 1.5 stroke).
// The map shows no icons: its pins are the type's colour (see index.css).
import { createIcon, ForkKnife, Home, HotDrink, Wineglass2, type IconComponent } from 'reicon-react'
import type { Scope } from './finder.ts'
import type { VenueType } from './types.ts'

const BOW_TIE = 'M10 10 4.9 7.1C4 6.6 3 7.2 3 8.2v7.6c0 1 1 1.6 1.9 1.1L10 14M14 10l5.1-2.9c.9-.5 1.9.1 1.9 1.1v7.6c0 1-1 1.6-1.9 1.1L14 14'
const KNOT = '<rect x="10" y="9.25" width="4" height="5.5" rx="1.25"'
export const BowTie = createIcon('BowTie', {
  O: `<path d="${BOW_TIE}" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>${KNOT} stroke="currentColor" stroke-width="1.5" fill="none"/>`,
  F: `<path d="${BOW_TIE}Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="currentColor"/>${KNOT} stroke="currentColor" stroke-width="1.5" fill="currentColor"/>`,
})

export const TYPE_ICON: Record<VenueType, IconComponent> = { hall: ForkKnife, cafe: HotDrink, bar: Wineglass2 }

/** The front page's tabs: every venue, then each kind. */
export const SCOPE_ICON: Record<Scope, IconComponent> = { all: Home, ...TYPE_ICON, formal: BowTie }
