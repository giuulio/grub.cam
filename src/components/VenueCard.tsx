import { Link } from 'react-router'
import type { DietTag } from '../lib/data/types.ts'
import type { Ranked } from '../lib/filters.ts'
import { ACCESS_LABEL } from '../lib/filters.ts'
import type { LocalNow } from '../lib/time/clock.ts'
import { DietTags, ProvenanceBadge, TypeChip } from './Badges.tsx'
import { DishList } from './DishList.tsx'
import { ServiceBadge } from './ServiceBadge.tsx'

export function VenueCard({ item, now, diets, viewingDate }: { item: Ranked; now: LocalNow; diets: DietTag[]; viewingDate: string }) {
  const { venue: v, status, days } = item
  const hasMenuForDay = days.length > 0
  const menuUrl = v.menu?.source_url ?? v.menu_source?.url
  return (
    <article className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold leading-tight">
            <Link to={`/college/${v.college.slug}`} className="hover:underline">
              {v.college.name}
            </Link>
            <span className="text-stone-400"> · </span>
            <span className="font-medium text-stone-700 dark:text-stone-300">{v.name}</span>
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
            <TypeChip type={v.type} />
            <span>{ACCESS_LABEL[v.access.level]}</span>
            {v.payment.bank_card === true && <span>· bank card ok</span>}
            {v.payment.bank_card === false && <span>· no bank cards</span>}
            {v.type !== 'hall' && v.dietary.tags.length > 0 && <DietTags tags={v.dietary.tags} />}
          </div>
        </div>
        <ServiceBadge status={status} now={now} />
      </div>

      {v.college.notice && <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">{v.college.notice}</p>}

      {hasMenuForDay ? (
        <div className="mt-3">
          <DishList days={days} diets={diets} showService={days.length > 1} />
        </div>
      ) : v.menu_source?.status === 'live' ? (
        <p className="mt-3 text-sm text-stone-500">
          {v.menu ? `No menu published for ${viewingDate === now.date ? 'today' : 'this day'}.` : 'Menu not captured yet.'}{' '}
          {menuUrl && (
            <a href={menuUrl} target="_blank" rel="noopener" className="font-medium text-grub-600 hover:underline">
              View on college site ↗
            </a>
          )}
        </p>
      ) : v.type === 'hall' ? (
        <p className="mt-3 text-sm text-stone-500">
          {v.menu_source?.status === 'members_only' ? 'Menu is members-only (intranet/app/email).' : 'No public menu.'}
          {v.serves && <span className="block text-xs">Serves: {v.serves}</span>}
        </p>
      ) : (
        v.serves && <p className="mt-3 text-sm text-stone-500">{v.serves}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
        <span className="truncate">{v.hours_text && status.kind !== 'unknown' ? '' : v.hours_text}</span>
        <span className="flex items-center gap-3">
          {status.kind !== 'unknown' && status.kind !== 'closed' && <ProvenanceBadge prov={status.slot.prov} label="hours" />}
          {menuUrl && hasMenuForDay && (
            <a href={menuUrl} target="_blank" rel="noopener" className="font-medium text-grub-600 hover:underline">
              Source ↗
            </a>
          )}
          <Link to={`/college/${v.college.slug}`} className="font-medium hover:underline">
            Details →
          </Link>
        </span>
      </div>
    </article>
  )
}
