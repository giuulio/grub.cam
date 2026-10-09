import { DIET_LABEL, DIET_SHORT, dishTags } from '../lib/filters.ts'
import { formatGbp, fromList, postedOn, type Price } from '../lib/prices.ts'
import { formatISODate } from '../lib/time/clock.ts'
import type { DietTag, VenuePrice } from '../lib/types.ts'
import { ExternalLink } from './ExternalLink.tsx'

// The rows every menu and price list is made of: a name with its diet codes, and its price (members', and others' when
// they differ), in fixed columns so prices line up down the list.

const PRICE_COL = 'w-16 shrink-0 text-right tabular-nums'

/** A posted price list, section by section; unless `narrow`, sections flow into two columns on wide screens. */
export function PriceList({ lines, narrow = false }: { lines: VenuePrice[]; narrow?: boolean }) {
  const sections = [...new Set(lines.map((p) => p.section))].map((section) => ({ section, rows: lines.filter((p) => p.section === section) }))
  const columns = lines.some((p) => p.non_member_gbp != null) ? 2 : 1
  return (
    <div className={narrow ? 'space-y-4' : 'gap-x-12 lg:columns-2'}>
      {sections.map(({ section, rows }, n) => (
        <div key={section ?? ''} className={narrow ? '' : 'mb-8 break-inside-avoid'}>
          <GroupHead label={section ?? undefined} columns={(n === 0 || !!section) && columns === 2} />
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

/** Under a list: what its diet codes mean, and when and where its prices were posted. */
export function ListNote({ tags, prices }: { tags: DietTag[]; prices?: VenuePrice[] }) {
  const used = (Object.keys(DIET_SHORT) as DietTag[]).filter((t) => tags.includes(t))
  const posted = prices?.length ? postedOn(prices) : undefined
  const link = prices?.map((p) => p.source.match(/https?:\/\/[^\s)]+/)?.[0]).find(Boolean)
  if (!used.length && !posted) return null
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted">
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

/** A course or section heading, with the price columns' headings beside it (alone when there's no heading). */
export function GroupHead({ label, columns }: { label?: string; columns: boolean }) {
  if (!label && !columns) return null
  return (
    <div className="mb-1 flex items-baseline gap-4 text-sm text-muted">
      <h4 className="flex-1 font-semibold">{label}</h4>
      {columns && (
        <>
          <span className={`${PRICE_COL} text-xs`}>Members</span>
          <span className={`${PRICE_COL} text-xs`}>Others</span>
        </>
      )}
    </div>
  )
}

export function Row({ name, tags = [], soldOut, price, columns }: { name: string; tags?: DietTag[]; soldOut?: boolean; price?: Price; columns: number }) {
  return (
    <li className="flex items-baseline gap-4 py-1.5">
      <span className="min-w-0 flex-1">
        <span className={soldOut ? 'text-muted line-through' : 'text-ink'}>{name}</span>
        {tags.map((t) => (
          <Code key={t} tag={t} className="ml-1.5 align-[2px]" />
        ))}
      </span>
      {soldOut ? (
        <span className={`${PRICE_COL} text-sm text-muted`}>Sold out</span>
      ) : (
        columns > 0 && (
          <>
            <span title={price?.text} className={PRICE_COL}>
              {price?.gbp != null ? formatGbp(price.gbp) : price?.text}
            </span>
            {columns > 1 && <span className={`${PRICE_COL} text-muted`}>{price?.nonMember != null && formatGbp(price.nonMember)}</span>}
          </>
        )
      )}
    </li>
  )
}

export function PriceText({ price, className = '' }: { price: Price; className?: string }) {
  return (
    <span className={`tabular-nums ${className}`}>
      {price.gbp != null && formatGbp(price.gbp)}
      {price.nonMember != null && <span className="text-muted"> · {formatGbp(price.nonMember)}</span>}
    </span>
  )
}

export function Code({ tag, className = '' }: { tag: DietTag; className?: string }) {
  return (
    <abbr title={DIET_LABEL[tag]} className={`inline-block min-w-6 rounded border border-ink/15 px-1 text-center text-[11px] leading-4 font-medium text-muted no-underline ${className}`}>
      {DIET_SHORT[tag]}
    </abbr>
  )
}
