import { z } from 'zod'

// Scraped and transcribed menus are validated against these before they're saved. The app imports the types.

export const Meal = z.enum(['breakfast', 'brunch', 'lunch', 'dinner', 'snacks', 'bar'])
export type Meal = z.infer<typeof Meal>

export const DietTag = z.enum(['vegetarian', 'vegan', 'plant_based', 'halal', 'gluten_free', 'kosher', 'pescatarian', 'dairy_free'])
export type DietTag = z.infer<typeof DietTag>

export const Dish = z.object({
  name: z.string().min(1),
  tags: z.array(DietTag).default([]),
  price_gbp: z.number().optional(),
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

/** How a venue publishes its menu (scripts/ingest/sources.ts, copied to venues.menu_channel). */
export type Channel = 'html' | 'json' | 'pdf' | 'sway' | 'canva' | 'app' | 'email' | 'intranet' | 'none' | 'unknown'
