// Which reicon (reicon.dev) stands for what, so every page uses the same one.
import { Coffee, ForkKnife, Pin, Wineglass, type IconComponent } from 'reicon-react'
import type { VenueType } from './types.ts'

export const TYPE_ICON: Record<VenueType, IconComponent> = { hall: ForkKnife, cafe: Coffee, bar: Wineglass, other: Pin }
