import { DIET_LABEL, DIET_SHORT, dishTags } from '../lib/filters.ts'
import { formatGbp, formatPrice, fromList, postedOn, priceHeads, type Price } from '../lib/prices.ts'
import { formatISODate } from '../lib/time/clock.ts'
import type { DietTag, PriceTerms, VenuePrice } from '../lib/types.ts'
import { ExternalLink } from './ExternalLink.tsx'

// The rows every menu and price list is made of: a name with its diet codes, and its price (the first price posted, and
// the second when there is one: members' and others', or however the venue heads them), in fixed columns so prices
// line up down the list.

const PRICE_COL = 'min-w-16 shrink-0 text-right tabular-nums'

/** A posted price list, section by section; unless `narrow`, sections flow into two columns on wide screens. */
export function PriceList({ lines, terms, narrow = false }: { lines: VenuePrice[]; terms?: PriceTerms | null; narrow?: boolean }) {
  const sections = [...new Set(lines.map((p) => p.section))].map((section) => ({ section, rows: lines.filter((p) => p.section === section) }))
  const columns = lines.some((p) => p.non_member_gbp != null) ? 2 : 1
  const heads = priceHeads(columns, terms)
  return (
    <div className={narrow ? 'space-y-4' : 'gap-x-12 lg:columns-2'}>
      {sections.map(({ section, rows }, n) => (
        <div key={section ?? ''} className={narrow ? '' : 'mb-8 break-inside-avoid'}>
          <GroupHead label={section ?? undefined} heads={n === 0 || section ? heads : []} />
          <ul>
            {rows.map((p, i) => (
              <Row key={i} name={p.name} tags={dishTags(p.tags)} price={fromList(p)} columns={columns} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** Under a list: how the venue's prices work (`note`), what its diet codes mean, and when and where its prices were posted. */
export function ListNote({ tags, prices, note }: { tags: DietTag[]; prices?: VenuePrice[]; note?: string }) {
  const used = (Object.keys(DIET_SHORT) as DietTag[]).filter((t) => tags.includes(t))
  const posted = prices?.length ? postedOn(prices) : undefined
  const link = prices?.map((p) => p.source.match(/https?:\/\/[^\s)]+/)?.[0]).find(Boolean)
  if (!used.length && !posted && !note) return null
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted">
      {note && <p className="w-full text-ink">{note}</p>}
      {used.map((t) => (
        <span key={t}>
          <Code tag={t} /> {DIET_LABEL[t]}
        </span>
      ))}
      {posted && <span>Prices as posted {formatISODate(posted, { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
      {link && <ExternalLink href={link} />}
    </div>
  )
}

/**
 * A course or section heading, with the price columns' headings beside it (alone when there's no heading); or, when
 * the whole course has one price (`price`, in `columns` columns), that price, said once for every dish under it, with
 * the columns' headings over it.
 */
export function GroupHead({ label, heads, price, columns = 0 }: { label?: string; heads: string[]; price?: Price; columns?: number }) {
  if (!label && !heads.length) return null
  const cells = heads.map((h) => (
    <span key={h} className={`${PRICE_COL} text-xs whitespace-nowrap text-muted`}>
      {h}
    </span>
  ))
  // Smaller than the dishes under it, so it reads as their heading, not one of them; in the venue's type colour (from
  // the menu's `data-type`), so a long menu's courses stand apart
  const title = <h4 className="type-ink flex-1 text-base font-semibold">{label}</h4>
  if (!price)
    return (
      <div className="mb-1 flex items-baseline gap-4">
        {title}
        {cells}
      </div>
    )
  return (
    <div className="mb-1">
      {cells.length > 0 && <div className="flex justify-end gap-4">{cells}</div>}
      <div className="flex items-baseline gap-4 text-[1.0625rem] sm:text-lg">
        {title}
        <span title={price.text} className={`${PRICE_COL} font-medium`}>{formatPrice(price)}</span>
        {columns > 1 && <span className={`${PRICE_COL} text-muted`}>{price.second != null && formatGbp(price.second)}</span>}
      </div>
    </div>
  )
}

/** A dish or a line of a price list: its name leads, in a medium weight, its price lined up at the right, as TheFork's menus. */
export function Row({ name, tags = [], soldOut, price, columns }: { name: string; tags?: DietTag[]; soldOut?: boolean; price?: Price; columns: number }) {
  return (
    <li className="flex items-baseline gap-4 py-1.5 text-[1.0625rem] sm:text-lg">
      <span className="min-w-0 flex-1">
        <span className={soldOut ? 'text-muted line-through' : 'font-medium text-ink'}>{name}</span>
        {tags.map((t) => (
          <Code key={t} tag={t} className="ml-1.5" />
        ))}
      </span>
      {soldOut ? (
        <span className={`${PRICE_COL} text-sm text-muted`}>Sold out</span>
      ) : (
        columns > 0 && (
          <>
            <span title={price?.text} className={PRICE_COL}>
              {price && formatPrice(price)}
            </span>
            {columns > 1 && <span className={`${PRICE_COL} text-muted`}>{price?.second != null && formatGbp(price.second)}</span>}
          </>
        )
      )}
    </li>
  )
}

export function PriceText({ price, className = '' }: { price: Price; className?: string }) {
  return (
    <span className={`tabular-nums ${className}`}>
      {formatPrice(price)}
      {price.second != null && <span className="text-muted"> · {formatGbp(price.second)}</span>}
    </span>
  )
}

// Meat-free codes on Green, so a vegetarian can run down a menu for them; the rest on grey
const GREEN: DietTag[] = ['vegan', 'plant_based', 'vegetarian']

/** A diet code after a dish (VG, H, GF), as a small tag: easy to find down a menu, small enough that the dish name leads. */
export function Code({ tag, className = '' }: { tag: DietTag; className?: string }) {
  return (
    <abbr
      title={DIET_LABEL[tag]}
      className={`relative -top-px inline-block rounded-[0.3125rem] px-1.5 text-xs leading-[1.375rem] font-semibold tracking-wide no-underline ${GREEN.includes(tag) ? 'bg-open/15 text-open-ink' : 'bg-ink/7 text-muted'} ${className}`}
    >
      {DIET_SHORT[tag]}
    </abbr>
  )
}
