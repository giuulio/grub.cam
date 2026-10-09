import { z } from 'zod'

// Scraped and transcribed menus are validated against these before they're saved. The app imports the types.

export const Meal = z.enum(['breakfast', 'brunch', 'lunch', 'dinner', 'formal', 'snacks', 'bar'])
export type Meal = z.infer<typeof Meal>

export const DietTag = z.enum(['vegetarian', 'vegan', 'plant_based', 'halal', 'gluten_free', 'kosher', 'pescatarian', 'dairy_free'])
export type DietTag = z.infer<typeof DietTag>

export const Dish = z.object({
  name: z.string().min(1),
  tags: z.array(DietTag).default([]),
  /** The first price posted; whose it is (members', students') is the venue's `price_terms` */
  price_gbp: z.number().optional(),
  /** The second price posted (non-members', others'), when there is one */
  price2_gbp: z.number().optional(),
  price_text: z.string().optional(),
  course: z.enum(['soup', 'main', 'side', 'dessert', 'other']).optional(),
  sold_out: z.boolean().optional(),
})
export type Dish = z.infer<typeof Dish>

export const MenuDay = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  service: Meal,
  items: z.array(Dish),
  note: z.string().optional(),
})
export type MenuDay = z.infer<typeof MenuDay>

/** What a price list line prices: dishes of that course, or (`meal`) the whole meal. */
export const PriceCourse = z.enum(['soup', 'main', 'side', 'dessert', 'other', 'meal'])
export type PriceCourse = z.infer<typeof PriceCourse>

/** One line of a price list as posted at a venue (scripts/ingest/prices.ts). */
export const PriceItem = z.object({
  section: z.string().optional(),
  name: z.string().min(1),
  /** The first price posted, or the low end of a range; absent when only the second tier is priced */
  price_gbp: z.number().nonnegative().optional(),
  /** The top of a range ("£3.24–£3.96") */
  price_max_gbp: z.number().nonnegative().optional(),
  /** The second price posted: the venue's second tier, non-members' by default */
  non_member_gbp: z.number().nonnegative().optional(),
  /** The meals it applies to; every meal when absent */
  services: z.array(Meal).min(1).optional(),
  /** Absent: an item sold at those meals rather than the price of the day's dishes */
  course: PriceCourse.optional(),
  /** From the codes printed after the name: "Hummus wrap (VE)" */
  tags: z.array(DietTag).optional(),
})
export type PriceItem = z.infer<typeof PriceItem>

/** How a venue publishes its menu (scripts/ingest/sources.ts, copied to venues.menu_channel). */
export type Channel = 'html' | 'json' | 'pdf' | 'sway' | 'canva' | 'app' | 'email' | 'intranet' | 'none' | 'unknown'
