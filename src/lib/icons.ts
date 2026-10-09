// Which reicon (reicon.dev) stands for what, so every page uses the same one: a cup and saucer for cafés (a mug reads
// as beer), a cocktail glass for bars. The map shows no icons: its pins are the type's colour (see index.css).
import { ForkKnife, HotDrink, Wineglass2, type IconComponent } from 'reicon-react'
import type { VenueType } from './types.ts'

export const TYPE_ICON: Record<VenueType, IconComponent> = { hall: ForkKnife, cafe: HotDrink, bar: Wineglass2 }
