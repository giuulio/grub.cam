import { useState, type ReactNode } from 'react'
import { Calendar, Card, Flag, Global, Leaf, Map as MapIcon, Users } from 'reicon-react'
import { Link, useParams, useSearchParams } from 'react-router'
import { BackButton } from '../components/BackButton.tsx'
import { DayMenu } from '../components/DayMenu.tsx'
import { ExternalLink } from '../components/ExternalLink.tsx'
import { Icon } from '../components/Icon.tsx'
import { DayStepper, MenuCalendar } from '../components/MenuCalendar.tsx'
import { ListNote, PriceList } from '../components/MenuRows.tsx'
import { VenuePhoto } from '../components/VenuePhoto.tsx'
import { menuGap } from '../lib/coverage.ts'
import { useMenuDates, useMenuOn, useReady } from '../lib/data.tsx'
import { ACCESS_LABEL, DIET_LABEL, dishTags, MEAL_LABEL, periodSlots, slotOrder, TYPE_LABEL } from '../lib/filters.ts'
import { TYPE_ICON } from '../lib/icons.ts'
import { formatGbp, priceGroups } from '../lib/prices.ts'
import { ISSUES_URL, SITE_NAME, siteName } from '../lib/site.ts'
import { useNow } from '../lib/useNow.ts'
import { dayLabel, dayOfISO, formatDays, formatISODate, isISODate, relativeDay, type LocalNow } from '../lib/time/clock.ts'
import { openStatus, slotApplies, type OpenStatus } from '../lib/time/openNow.ts'
import { isFullTerm } from '../lib/time/termDates.ts'
import { isFormalOnly, venueTypes, type Channel, type DietTag, type Formal, type Venue, type VenuePrice, type VenueType } from '../lib/types.ts'
import { NotFound } from './NotFound.tsx'

/**
 * A venue's page, the same for every kind: name, site and types; a photo and the facts (open now, hours, access,
 * payment, diets, links); then one section per thing it is, each shown even when nothing is known yet. Dining leads
 * with the menu for a date, then formal hall where it's held (first, in a Hall used only for formals); a café or bar
 * leads with its price list, and a café that's a bar by night has both.
 */
export function VenuePage() {
  const params = useParams()
  const { venues } = useReady()
  const now = useNow()

  const venue = venues.find((v) => v.site.slug === params.site && v.slug === params.venue)
  if (!venue) return <NotFound />
  const hasMenu = venue.menu.some((d) => d.items.length) || !!venue.prices?.length

  return (
    <>
      <title>{`${venue.name}, ${siteName(venue.site)}: ${hasMenu ? 'menu and hours' : 'opening hours'} · ${SITE_NAME}`}</title>
      <BackButton up={`/${venue.site.slug}`} />
      <div className="grid gap-y-10 md:grid-cols-[minmax(0,1fr)_17rem] md:grid-rows-[auto_1fr] md:gap-x-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-x-16">
        <Heading venue={venue} />
        {/* Beside the sections; on a phone, open now and the hours come first and the details after the sections */}
        <div className="contents md:col-start-2 md:row-span-2 md:row-start-1 md:block md:min-w-0 md:space-y-6">
          <div className="order-2 min-w-0 space-y-6 md:order-none">
            <VenuePhoto venue={venue} />
            <div className="rounded-2xl border border-ink/10 p-5">
              <StatusLine s={openStatus(venue.slots, now)} now={now} />
              <Hours venue={venue} now={now} />
            </div>
          </div>
          <Details venue={venue} />
        </div>
        <div className="order-3 min-w-0 space-y-16 md:order-none md:col-start-1">
          <Sections key={venue.id} venue={venue} now={now} />
        </div>
      </div>
    </>
  )
}

const holdsFormal = (v: Venue) => !!v.formal || v.slots.some((s) => s.meal === 'formal')

function Heading({ venue }: { venue: Venue }) {
  return (
    <header className="min-w-0">
      <h1 className="text-4xl font-semibold tracking-tight text-balance">{venue.name}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-muted">
        <Link to={`/${venue.site.slug}`} className="transition-colors hover:text-ink">
          {venue.site.short_name ?? venue.site.name}
        </Link>
        {venueTypes(venue).map((t) => (
          <span key={t} className="flex items-center gap-2">
            <span className="type-swatch" data-type={t}>
              <Icon of={TYPE_ICON[t]} className="size-3" />
            </span>
            {TYPE_LABEL[t]}
          </span>
        ))}
        {holdsFormal(venue) && <span>Formal hall</span>}
      </div>
    </header>
  )
}

/** One section per thing the venue is, in the order people look for them. */
function Sections({ venue, now }: { venue: Venue; now: LocalNow }) {
  const types = venueTypes(venue)
  const groups = priceGroups(venue.prices, types)
  const formalOnly = isFormalOnly(venue)
  const out: ReactNode[] = []
  for (const t of types) {
    const title = t === types[0] ? 'Menu' : TYPE_LABEL[t]
    if (t === 'hall') {
      const menu = (
        <Section key="menu" title={title}>
          <DatedMenu venue={venue} now={now} prices={groups.hall} />
        </Section>
      )
      const formal = holdsFormal(venue) && (
        <Section key="formal" title="Formal hall">
          <FormalHall venue={venue} formal={venue.formal ?? {}} />
        </Section>
      )
      out.push(...(formalOnly ? [formal, menu] : [menu, formal]))
    } else
      out.push(
        <Section key={t} title={title}>
          <FixedMenu type={t} lines={groups[t] ?? []} />
        </Section>,
      )
  }
  // A café or bar that posts dishes by date too
  if (types[0] !== 'hall' && venue.menu.some((d) => d.items.length))
    out.push(
      <Section key="daily" title="Daily menu">
        <DatedMenu venue={venue} now={now} />
      </Section>,
    )
  return out
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-5 text-2xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}

const HelpLink = () => (
  <Link to="/coverage" className="text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
    Help get it here
  </Link>
)

/** A café's or bar's list as posted: the same every day, so no dates. */
function FixedMenu({ type, lines }: { type: VenueType; lines: VenuePrice[] }) {
  if (!lines.length)
    return (
      <p className="text-muted">
        {type === 'bar' ? 'No drinks prices here yet.' : 'No menu or prices here yet.'} <HelpLink />
      </p>
    )
  return (
    <div className="space-y-2">
      <PriceList lines={lines} />
      <ListNote tags={lines.flatMap((p) => dishTags(p.tags))} prices={lines} />
    </div>
  )
}

/**
 * The menu for one date (?date=, default today), with a calendar of every date that has one. A Dining venue that has
 * never posted dishes shows its posted list (`prices`) instead, or why there's no menu.
 */
function DatedMenu({ venue, now, prices }: { venue: Venue; now: LocalNow; prices?: VenuePrice[] }) {
  const { snapshot } = useReady()
  const [params, setParams] = useSearchParams()
  const [calendarOpen, setCalendarOpen] = useState(false)
  const asked = params.get('date') ?? ''
  const date = isISODate(asked) ? asked : now.date
  const setDate = (d: string) => setParams(d === now.date ? {} : { date: d }, { replace: true })

  // Dates already loaded show straight away; the full history fills in once fetched.
  const fetched = useMenuDates(venue.id)
  const dates = [...new Set([...(fetched ?? []), ...venue.menu.filter((d) => d.items.length).map((d) => d.date)])].sort()
  const { days, failed } = useMenuOn(venue, date)
  if (!dates.length && !asked) {
    if (prices?.length)
      return (
        <div className="space-y-6">
          <MissingMenu venue={venue} published={false} />
          <PriceList lines={prices} />
          <ListNote tags={prices.flatMap((p) => dishTags(p.tags))} prices={prices} />
        </div>
      )
    // A build-time page only knows this week; in the browser, wait for the history before saying there's none
    return fetched || snapshot ? <MissingMenu venue={venue} /> : null
  }

  // A build-time page can't know what "today" will be when it's read
  const relative = snapshot ? undefined : relativeDay(date, now.date)
  const dayMonth: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', ...(date.slice(0, 4) === now.date.slice(0, 4) ? {} : { year: 'numeric' }) }
  return (
    <div>
      <div className="flex items-center gap-2 border-b border-ink/10 pb-4">
        <button
          type="button"
          onClick={() => setCalendarOpen(!calendarOpen)}
          aria-expanded={calendarOpen}
          aria-label={`${formatISODate(date, { weekday: 'long', ...dayMonth })}: choose another date`}
          className="-ml-2 flex min-w-0 cursor-pointer items-center gap-3 rounded-lg px-2 py-1 text-left transition-colors hover:bg-ink/5"
        >
          <Icon of={Calendar} className="size-5 text-muted" />
          <span className="min-w-0 truncate text-lg font-medium">
            <span className="sm:hidden">{formatISODate(date, { weekday: 'short', ...dayMonth })}</span>
            <span className="hidden sm:inline">{formatISODate(date, { weekday: 'long', ...dayMonth })}</span>
            {relative && <span className="font-normal text-muted"> · {relative}</span>}
          </span>
        </button>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {date !== now.date && (
            <button type="button" onClick={() => setDate(now.date)} className="cursor-pointer rounded-md px-2 py-1 text-sm text-muted transition-colors hover:bg-ink/10 hover:text-ink">
              Today
            </button>
          )}
          <DayStepper value={date} dates={dates} onChange={setDate} />
        </div>
      </div>
      {calendarOpen && (
        <div className="mt-4">
          <MenuCalendar value={date} today={now.date} dates={new Set(dates)} onChange={(d) => (setDate(d), setCalendarOpen(false))} />
        </div>
      )}
      <div className="mt-6">
        {days?.some((d) => d.items.length) ? (
          <DayMenu days={days} slots={venue.slots} date={date} prices={prices} />
        ) : (
          <p className="text-muted">{failed ? "Couldn't load this menu" : days ? 'No menu published for this day' : 'Loading…'}</p>
        )}
      </div>
    </div>
  )
}

const MEMBERS_WHERE: Partial<Record<Channel, string>> = { intranet: 'on the college intranet', app: 'in a college app', email: 'by email' }

/** Why there's no menu here, and how to help. `published: false` leaves out "published, not here yet" (a fixed list is what's published). */
function MissingMenu({ venue, published = true }: { venue: Venue; published?: boolean }) {
  const status = venue.menu_scripted ? undefined : menuGap(venue)
  if (status === 'online' && !published) return null
  const site = venue.site.short_name ?? venue.site.name
  return (
    <div className="text-muted">
      <p>
        {status === 'members'
          ? `The daily menu is posted for ${site} members only, ${MEMBERS_WHERE[venue.menu_channel!] ?? 'not online'}.`
          : status === 'online'
          ? 'Published, not here yet.'
          : status === 'unpublished'
          ? 'The menu isn’t published anywhere we know of.'
          : 'No menu here yet.'}{' '}
        <HelpLink />
      </p>
      {status === 'online' && venue.menu_url && (
        <div className="mt-2">
          <ExternalLink href={venue.menu_url} />
        </div>
      )}
    </div>
  )
}

const DRESS: Record<NonNullable<Formal['dress_code']>, string> = { black_tie: 'black tie', formal: 'jacket and tie, or equivalent', smart: 'smart', relaxed: 'relaxed' }
const sentence = (parts: (string | false | null | undefined)[]) => {
  const s = parts.filter(Boolean).join(', ')
  return s ? s[0].toUpperCase() + s.slice(1) : undefined
}

/** What a member needs to go to formal hall: when, what it costs, guests, dress, how to book. */
function FormalHall({ venue, formal: f }: { venue: Venue; formal: Formal }) {
  const slots = venue.slots.filter((s) => s.meal === 'formal').sort(slotOrder)
  const when = slots.length
    ? slots.map((s) => `${formatDays(s.days)} · ${s.start}${s.period === 'term' ? ', in term' : s.period === 'vacation' ? ', out of term' : ''}`)
    : f.days?.length
    ? [`${formatDays(f.days)} · time not published`]
    : []
  const price = f.price_gbp != null && (
    <>
      {formatGbp(f.price_gbp)}
      {f.guest_gbp != null && ` · guests ${formatGbp(f.guest_gbp)}`}
      {f.prices_seen && <span className="text-muted"> ({formatISODate(f.prices_seen, { month: 'short', year: 'numeric' })})</span>}
    </>
  )
  const n = f.book_days_before
  const deadline = n != null && f.book_by && `by ${f.book_by}${n === 0 ? ' on the day' : n === 1 ? ' the day before' : `, ${n} days before`}`
  const rows: [string, ReactNode][] = [
    ['When', when.length ? when.map((w) => <span key={w} className="block">{w}</span>) : undefined],
    ['Price', price],
    ['Guests', f.guests_allowed === false ? 'No guests' : f.guests_allowed ? (f.guests_max != null ? `Up to ${f.guests_max} per member` : 'Allowed') : undefined],
    ['Dress', sentence([f.dress_code && DRESS[f.dress_code], f.gowns === 'required' ? 'gowns for members' : f.gowns === 'optional' && 'gowns optional'])],
    ['Booking', sentence([f.book_via, deadline])],
  ]
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-6 gap-y-3 sm:max-w-xl">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className={value ? 'text-ink' : 'text-muted'}>{value || 'Not known yet'}</dd>
          </div>
        ))}
      </dl>
      {f.url && <ExternalLink href={f.url} />}
    </div>
  )
}

/** Who can go, how to pay, diets, where it is, its website, and how to report a change. */
function Details({ venue }: { venue: Venue }) {
  const mapped = venue.latitude != null && venue.longitude != null
  const website = venue.url ?? venue.site.official_dining_url
  const payment = paymentText(venue.payment)
  const diets = sentence(venue.dietary.tags.map((t: DietTag) => DIET_LABEL[t].toLowerCase()))
  const report = `${ISSUES_URL}/new?title=${encodeURIComponent(`${venue.name}, ${siteName(venue.site)}: `)}`
  return (
    <ul className="order-4 space-y-3 px-1 md:order-none">
        <Fact icon={Users} known={venue.access.level !== 'unknown'}>
          {venue.access.level !== 'unknown' ? ACCESS_LABEL[venue.access.level] : 'Access not known yet'}
        </Fact>
        <Fact icon={Card} known={!!payment}>
          {payment ?? 'Payment not known yet'}
        </Fact>
        <Fact icon={Leaf} known={!!diets}>
          {diets ? `${diets} options` : 'Diet options not known yet'}
        </Fact>
        <Fact icon={MapIcon} known={mapped}>
          {mapped ? (
            <Link to={`/?place=${encodeURIComponent(venue.id)}`} className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
              On the map
            </Link>
          ) : (
            'Not on the map yet'
          )}
        </Fact>
        {website && (
          <Fact icon={Global} known>
            <ExternalLink href={website} className="text-base" />
          </Fact>
        )}
        <li className="border-t border-ink/10 pt-3">
          <a href={report} target="_blank" rel="noopener" className="flex items-center gap-3 text-sm text-muted transition-colors hover:text-ink">
            <Icon of={Flag} />
            Report a change
          </a>
        </li>
    </ul>
  )
}

function Fact({ icon, known, children }: { icon: Parameters<typeof Icon>[0]['of']; known: boolean; children: ReactNode }) {
  return (
    <li className={`flex items-start gap-3 ${known ? 'text-ink' : 'text-muted'}`}>
      <Icon of={icon} className="mt-1 size-4 text-muted" />
      <span className="min-w-0">{children}</span>
    </li>
  )
}

/** "Bank card, University card · no cash", or undefined when nothing is known. */
function paymentText(p: Venue['payment']): string | undefined {
  const yes = [p.bank_card && 'Bank card', p.university_card && 'University card', p.cash && 'Cash'].filter(Boolean)
  const no = [p.bank_card === false && 'no bank cards', p.cash === false && 'no cash'].filter(Boolean)
  return [yes.join(', '), sentence(no) && (yes.length ? no.join(', ') : sentence(no))].filter(Boolean).join(' · ') || undefined
}

/** The hours for the time of year (term or not), today's in full; the other period's when only those are known. */
function Hours({ venue, now }: { venue: Venue; now: LocalNow }) {
  const { snapshot } = useReady()
  const inTerm = isFullTerm(now.date)
  const current = periodSlots(venue.slots, now.date)
  const shown = current.length ? current : venue.slots.filter((s) => s.period === (inTerm ? 'vacation' : 'term')).sort(slotOrder)
  const seasonal = venue.slots.some((s) => s.period !== 'all')
  const label = seasonal && ((current.length ? inTerm : !inTerm) ? 'In term' : 'Out of term')
  // A café's "Café, Daily" says nothing the page doesn't: name the meal only when there's more than one
  const meals = new Set(shown.map((s) => s.meal)).size > 1
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3 text-sm text-muted">
        <h2 className="font-semibold">Hours</h2>
        {label && <span>{label}</span>}
      </div>
      {shown.length ? (
        <table className="w-full tabular-nums">
          <tbody>
            {shown.map((s, i) => (
              // Today's services stand out, once the page knows what today is
              <tr key={i} className={!snapshot && slotApplies(s, now.date) ? 'text-ink' : 'text-muted'}>
                {meals && <td className="py-0.5 pr-3 align-top">{MEAL_LABEL[s.meal]}</td>}
                <td className="py-0.5 pr-3 align-top">{formatDays(s.days)}</td>
                <td className="py-0.5 text-right align-top whitespace-nowrap">
                  {s.start}–{s.end}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-muted">Not published</p>
      )}
      {!current.length && shown.length > 0 && <p className="mt-2 text-sm text-muted">{inTerm ? 'Term' : 'Out-of-term'} hours not published</p>}
    </div>
  )
}

/** Open now and until when, or the next service; nothing on a prerendered page, which can't know when it's read. */
function StatusLine({ s, now }: { s: OpenStatus; now: LocalNow }) {
  if (useReady().snapshot || s.kind === 'unknown' || (s.kind === 'closed' && !s.next)) return null
  const { slot, date } = s.kind === 'closed' ? s.next! : s
  const day = date === now.date ? '' : `${relativeDay(date, now.date)?.toLowerCase() ?? dayLabel(dayOfISO(date))} `
  // Formal hall is booked, not walked into: say when it is
  const formal = slot.meal === 'formal'
  const title = formal
    ? s.kind === 'open' ? 'Formal hall now' : s.kind === 'opening' ? 'Formal hall today' : 'Next formal hall'
    : s.kind === 'open' ? 'Open now' : s.kind === 'opening' ? 'Opens soon' : 'Closed'
  const detail = s.kind === 'open' ? `until ${slot.end}` : formal ? `${day}${slot.start}` : `${day}${slot.start}–${slot.end}`
  return (
    <div className="mb-4 border-b border-ink/10 pb-4">
      <p className="flex items-center gap-2 text-lg font-semibold">
        {s.kind === 'open' && <span aria-hidden="true" className="size-2.5 rounded-full bg-accent ring-1 ring-accent-ink/20" />}
        {title}
      </p>
      <p className="text-muted tabular-nums">{formal ? detail[0].toUpperCase() + detail.slice(1) : `${MEAL_LABEL[slot.meal]} ${detail}`}</p>
    </div>
  )
}
