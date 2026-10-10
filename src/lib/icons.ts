// Which reicon (reicon.dev) stands for what, so every page uses the same one: a cup and saucer for cafés (a mug reads
// as beer), a cocktail glass for bars, a candle for formal hall. The map shows no icons: its pins are the type's colour
// (see index.css).
import { Candle, ForkKnife, Home, HotDrink, Wineglass2, type IconComponent } from 'reicon-react'
import type { Scope } from './finder.ts'
import type { VenueType } from './types.ts'

export const TYPE_ICON: Record<VenueType, IconComponent> = { hall: ForkKnife, cafe: HotDrink, bar: Wineglass2 }

/** The front page's tabs: every venue, then each kind. */
export const SCOPE_ICON: Record<Scope, IconComponent> = { all: Home, ...TYPE_ICON, formal: Candle }
