import { Link } from 'react-router'
import { formalBooking, formalDress, formalPrice, formalWhen } from '../lib/formal.ts'
import { formatGbp } from '../lib/prices.ts'
import { siteName, venuePath } from '../lib/site.ts'
import { holdsFormal } from '../lib/summary.ts'
import type { Venue } from '../lib/types.ts'

/**
 * Under the Formal hall tab's list: every formal hall side by side, cheapest first (prices not published last), with
 * the range of members' prices in a sentence. Folded, so the list stays first; prerendered, so "cheapest formal hall
 * cambridge" and "formal hall prices" find it. Only what each college publishes; a gap says so.
 */
export function FormalCompare({ venues }: { venues: Venue[] }) {
  const halls = venues.filter(holdsFormal)
  if (halls.length < 2) return null
  const price = (v: Venue) => v.formal?.price_gbp ?? Infinity
  const sorted = [...halls].sort((a, b) => price(a) - price(b) || siteName(a.site).localeCompare(siteName(b.site)))
  const priced = sorted.filter((v) => v.formal?.price_gbp != null)
  const name = (v: Venue) => `${siteName(v.site)}${halls.filter((o) => o.site.slug === v.site.slug).length > 1 ? ` (${v.name})` : ''}`
  const range =
    priced.length > 1
      ? ` Members’ prices, where published, run from ${formatGbp(priced[0].formal!.price_gbp!)} at ${name(priced[0])} to ${formatGbp(priced.at(-1)!.formal!.price_gbp!)} at ${name(priced.at(-1)!)}.`
      : ''
  return (
    <details className="formal-compare mt-8 border-t border-ink/10 pt-5">
      <summary className="cursor-pointer text-lg font-semibold">Compare every formal hall</summary>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        {halls.length} Cambridge college halls hold formal hall.{range} Dress codes, gowns and booking vary by college; each college’s own page has the final word.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="py-2 pr-4 font-medium">College</th>
              <th className="py-2 pr-4 font-medium">Nights</th>
              <th className="py-2 pr-4 font-medium">Price</th>
              <th className="py-2 pr-4 font-medium">Dress</th>
              <th className="py-2 font-medium">Booking</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((v) => {
              const f = v.formal
              const cell = (s?: string) => s || <span className="text-muted">Not published</span>
              return (
                <tr key={v.id} className="border-t border-ink/10 align-top">
                  <td className="py-2 pr-4">
                    <Link to={venuePath(v)} className="link">{name(v)}</Link>
                  </td>
                  <td className="py-2 pr-4">{cell(formalWhen(v, f).join('; '))}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{cell(f && formalPrice(f))}</td>
                  <td className="py-2 pr-4">{cell(f && formalDress(f))}</td>
                  <td className="py-2">{cell(f && formalBooking(f))}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </details>
  )
}
