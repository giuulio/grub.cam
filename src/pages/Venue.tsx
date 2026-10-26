import { Fragment, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Calendar, Flag, Global, Leaf, Map as MapIcon, NoteAdd } from 'reicon-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { DayMenu } from '../components/DayMenu.tsx'
import { ExternalLink } from '../components/ExternalLink.tsx'
import { GapCard, GapLine, SEND_EITHER } from '../components/GapCard.tsx'
import { RatingSummary, Reviews } from '../components/Reviews.tsx'
import { Icon } from '../components/Icon.tsx'
import { DayStepper, MenuCalendar } from '../components/MenuCalendar.tsx'
import { ListNote, PriceList, SentBy } from '../components/MenuRows.tsx'
import { Status } from '../components/Status.tsx'
import { VenueMap } from '../components/VenueMap.tsx'
import { TypeLabel, VenueBanner } from '../components/VenuePhoto.tsx'
import { gapPath, menuGap, venueGaps, type Gap } from '../lib/coverage.ts'
import { useMenuCredits, useMenuDates, useMenuOn, useReady } from '../lib/data.tsx'
import { sentBy } from '../lib/contributors.ts'
import { applyFilters, DEFAULT_FILTERS, DIET_LABEL, dishTags, MEAL_LABEL, mealHours, periodSlots, slotOrder, TYPE_LABEL, weekHours, type Ranked } from '../lib/filters.ts'
import { BowTie } from '../lib/icons.ts'
import { priceGroups } from '../lib/prices.ts'
import { mealCancelled, mealPosted } from '../lib/menuNotes.ts'
import { formalBooking, formalDress, formalGuests, formalPrice, formalWhen } from '../lib/formal.ts'
import { alternateNames, sendPath, siteName, venuePath } from '../lib/site.ts'
import { venueSummary } from '../lib/summary.ts'
import { venueTitle } from '../lib/seo.ts'
import { useMedia } from '../lib/useMedia.ts'
import { useNow } from '../lib/useNow.ts'
import { addDaysISO, formatDays, formatISODate, isISODate, relativeDay, type LocalNow } from '../lib/time/clock.ts'
import { openStatus, withDayTimes } from '../lib/time/openNow.ts'
import { isFullTerm } from '../lib/time/termDates.ts'
import { isFormalOnly, venueTypes, type Channel, type Day, type DietTag, type Formal, type PriceTerms, type Venue, type VenuePrice, type VenueType } from '../lib/types.ts'
import { NotFound } from './NotFound.tsx'

/**
 * A venue's page, the same for every kind: its photo across the top; name, site and types; beside them, as TheFork's
 * booking box, a rail of cards that stays in view: whether it's open, its hours and the menu calendar; where it is, on
 * a map; and what the page is still missing, each a link to send it in. Then the facts (diets, links) and one section
 * per thing it is, each shown even when nothing is known yet. Dining leads with the menu for a date, then formal hall
 * where it's held (first, in a Hall used only for formals); a café or bar leads with its price list, and a café that's
 * a bar by night has both.
 */
export function VenuePage() {
  const params = useParams()
  const { venues } = useReady()
  const now = useNow()
  // Beside the sections on a wide screen; after them on a phone, so the menu isn't pushed down
  const wide = useMedia('(min-width: 768px)')
  // The rail stays in view only when the screen has room for all of it; else it scrolls with the page, never on its own
  const rail = useRef<HTMLElement>(null)
  const fits = useFits(rail, 48)

  const venue = venues.find((v) => v.site.slug === params.site && v.slug === params.venue)
  if (!venue) return <NotFound />
  // The site's venues, for the map: this one in the middle, the others as context
  const neighbours = applyFilters(venues.filter((v) => v.site.slug === venue.site.slug), { ...DEFAULT_FILTERS, date: now.date, exactDate: true }, now)
  const tail = (
    <>
      <MapCard venue={venue} rows={neighbours} />
      <HelpCard venue={venue} />
    </>
  )

  return (
    <>
      <title>{venueTitle(venue)}</title>
      <VenueBanner venue={venue} />
      <div className="grid gap-y-10 md:grid-cols-[minmax(0,1fr)_17rem] md:gap-x-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-x-16">
        {/* The page scrolls past the name, the facts and the sections, while the rail stays beside them; on a phone,
            the hours come after the name, and the facts, the map and the help after the sections */}
        <div className="contents md:col-start-1 md:row-start-1 md:block md:min-w-0">
          <Heading venue={venue} siblings={venues.filter((v) => v.site.slug === venue.site.slug)} date={now.date} />
          <Details venue={venue} />
          <div className="order-3 min-w-0 space-y-16 md:mt-14">
            <Sections key={venue.id} venue={venue} now={now} />
            <Section id="reviews" title="Reviews" aside={<RatingSummary venue={venue} className="text-lg" />}>
              <Reviews key={venue.id} venue={venue} />
            </Section>
          </div>
          {!wide && <div className="order-5 space-y-5">{tail}</div>}
        </div>
        <aside ref={rail} className={`order-2 min-w-0 space-y-5 md:col-start-2 md:row-start-1 md:self-start ${fits ? 'md:sticky md:top-[calc(var(--header-h,0px)+1.5rem)]' : ''}`}>
          <RailCard>
            <section aria-label="Opening hours">
              <p className="mb-4 text-lg empty:hidden">
                <Status s={openStatus(withDayTimes(venue.slots, venue.menu), now)} now={now} meal={new Set(venue.slots.map((s) => s.meal)).size > 1} />
              </p>
              <Hours venue={venue} now={now} />
            </section>
            {showsDatedMenu(venue) && <SideCalendar venue={venue} now={now} />}
          </RailCard>
          {wide && tail}
        </aside>
      </div>
    </>
  )
}

/** Whether an element, with `margin` around it, fits the window's height under the header; measured again as either changes. */
function useFits(ref: RefObject<HTMLElement | null>, margin: number): boolean {
  const [fits, setFits] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setFits(el.offsetHeight + margin + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 0) <= window.innerHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [ref, margin])
  return fits
}

/** One of the rail's cards, bordered as the listing cards are. */
function RailCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-ink/12 bg-canvas p-5 lg:p-6 ${className}`}>{children}</div>
}

/**
 * Where it is: a square map centred on the venue at street zoom (its site's other venues on it too, a click opening
 * theirs), and its location line under it ("First Court", "Li Ka Shing Centre, Robinson Way"), else its site.
 */
function MapCard({ venue, rows }: { venue: Venue; rows: Ranked[] }) {
  const { snapshot } = useReady()
  const navigate = useNavigate()
  const mapped = venue.latitude != null && venue.longitude != null
  return (
    <RailCard className="overflow-hidden">
      {mapped && !snapshot && (
        <div className="rail-map relative isolate -mx-5 -mt-5 mb-4 border-b border-ink/10 lg:-mx-6 lg:-mt-6">
          <VenueMap
            results={rows}
            selected={venue.id}
            focus={venue.id}
            maxZoom={17}
            filtered
            embedded
            controls={false}
            onSelect={(id) => {
              const v = rows.find((r) => r.venue.id === id)?.venue
              if (v && v.id !== venue.id) navigate(venuePath(v))
            }}
          />
        </div>
      )}
      <p className={`flex items-start gap-3 ${mapped || venue.where ? 'text-ink' : 'text-muted'}`}>
        <Icon of={MapIcon} className="mt-1 size-4 shrink-0 text-muted" />
        <span className="min-w-0">{venue.where ?? (mapped ? siteName(venue.site) : 'Not on the map yet')}</span>
      </p>
    </RailCard>
  )
}

/**
 * What this page is still missing that it doesn't already ask for where it would be, each a link to send it (a photo or
 * the text): the menu, a café's or bar's list and the hours each have their own, so they aren't asked for twice; formal
 * hall's details, a photo and unknown diets are here. Nothing when there's nothing else to ask.
 */
function HelpCard({ venue }: { venue: Venue }) {
  const types = venueTypes(venue)
  // From the list /contribute shows for it, so the two never disagree
  const elsewhere = (g: Gap) =>
    g.kind === 'menu' || g.kind === 'hours' || (g.kind === 'prices' && (types.some((t) => t !== 'hall') || venue.menu.some((d) => d.items.length)))
  const missing = venueGaps(venue)
    .filter((g) => !elsewhere(g))
    .map((g): [label: string, to: string] => [g.label, gapPath(venue, g)])
  // Which diets it caters for, unless it's a bar
  if (!venue.dietary.tags.length && types.some((t) => t !== 'bar')) missing.push(['The diet options', sendPath(venue, 'other', { topic: 'diet' })])
  if (!missing.length) return null
  return (
    <RailCard>
      <h2 className="text-lg font-semibold">Help fill this in</h2>
      <p className="mt-1 text-[0.9375rem] text-muted">A photo or the text, sent with your Cambridge account. It goes up once we’ve checked it.</p>
      <ul className="mt-3 space-y-2">
        {missing.map(([label, to]) => (
          <li key={label} className="flex items-start gap-3">
            <Icon of={NoteAdd} className="mt-1 size-4 shrink-0 text-muted" />
            <Link to={to} className="link">{label}</Link>
          </li>
        ))}
      </ul>
    </RailCard>
  )
}

const holdsFormal = (v: Venue) => !!v.formal || v.slots.some((s) => s.meal === 'formal')
/** Dining, or a café or bar that posts dishes by date: a page with a menu for each date, and its calendar. */
const showsDatedMenu = (v: Venue) => v.type === 'hall' || v.menu.some((d) => d.items.length)

/** The menu date (?date=, default today), and every date with a menu: loaded ones straight away, the full history once fetched. */
function useMenuDate(venue: Venue, now: LocalNow) {
  const [params, setParams] = useSearchParams()
  const asked = params.get('date') ?? ''
  const date = isISODate(asked) ? asked : now.date
  const setDate = (d: string) => setParams(d === now.date ? {} : { date: d }, { replace: true })
  const fetched = useMenuDates(venue.id)
  const dates = [...new Set([...(fetched ?? []), ...venue.menu.filter(mealPosted).map((d) => d.date)])].sort()
  return { asked, date, setDate, fetched, dates }
}

/**
 * Beside the menu on wider screens: every date with a menu, always in view. On a phone it opens from the date instead.
 * Nothing until there's a date to pick: a month of greyed-out days only pushed the map down.
 */
function SideCalendar({ venue, now }: { venue: Venue; now: LocalNow }) {
  const { date, setDate, dates } = useMenuDate(venue, now)
  if (!dates.length) return null
  return (
    <div className="hidden border-t border-ink/10 pt-6 md:block">
      <MenuCalendar value={date} today={now.date} dates={new Set(dates)} onChange={setDate} />
    </div>
  )
}

function Heading({ venue, siblings, date }: { venue: Venue; siblings: Venue[]; date: string }) {
  return (
    <header className="order-1 min-w-0">
      {/* Its site over its name, in Dark Cherry as on every row: "Hall" alone doesn't say whose */}
      <Link to={`/${venue.site.slug}`} className="text-lg font-semibold text-site-ink hover:underline">
        {siteName(venue.site)}
      </Link>
      <h1 className="title mt-1 text-4xl leading-[1.1] sm:text-5xl">{venue.name}</h1>
      {/* What it is, its meals and times and its formal hall, in words: the lead search engines read */}
      <p className="mt-3 max-w-prose text-muted">
        {venueSummary(venue, date, siblings)}
        {alternateNames(venue).length > 0 && ` Also listed as ${alternateNames(venue).join(' or ')}.`}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-muted">
        {venueTypes(venue).map((t) => <TypeLabel key={t} type={t} className="gap-2" />)}
        {holdsFormal(venue) && (
          <span className="inline-flex items-center gap-2">
            <span className="type-mark size-5">
              <Icon of={BowTie} className="size-[60%]" />
            </span>
            Formal hall
          </span>
        )}
        {venue.rating && (
          <a href="#reviews" className="text-ink hover:underline">
            <RatingSummary venue={venue} />
          </a>
        )}
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
      const menu = <DatedMenu key="menu" title={title} type="hall" venue={venue} now={now} prices={groups.hall} />
      const formal = holdsFormal(venue) && (
        <Section key="formal" title="Formal hall">
          <FormalHall venue={venue} formal={venue.formal ?? {}} />
        </Section>
      )
      out.push(...(formalOnly ? [formal, menu] : [menu, formal]))
    } else
      out.push(
        <Section key={t} title={title} type={t}>
          <FixedMenu venue={venue} type={t} lines={groups[t] ?? []} terms={venue.price_terms} />
        </Section>,
      )
  }
  // A café or bar that posts dishes by date too
  if (types[0] !== 'hall' && venue.menu.some((d) => d.items.length))
    out.push(<DatedMenu key="daily" title="Daily menu" type={types[0]} venue={venue} now={now} />)
  return out
}

/**
 * A section of the page: its title, with what controls it beside it (a menu's date), then what it holds. `type`: the
 * kind of venue a menu is for, whose colour its course and section headings take.
 */
function Section({ id, title, type, aside, children }: { id?: string; title: string; type?: VenueType; aside?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} data-type={type} className={id ? 'scroll-mt-[calc(var(--header-h,0px)+1.5rem)]' : undefined}>
      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <h2 className="title flex-1 text-3xl">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

/** Who sent the venue's price list or hours, where members did. */
const creditOf = (v: Venue, what: 'prices' | 'hours') => sentBy(v.credits?.filter((c) => c.what === what))

const HelpLink = ({ venue, kind, children = 'Send it' }: { venue: Venue; kind: 'menu' | 'prices' | 'hours'; children?: ReactNode }) => (
  <Link to={sendPath(venue, kind)} className="link text-ink">
    {children}
  </Link>
)

/** A café's or bar's list as posted: the same every day, so no dates. How its prices work, even before there's a list. */
function FixedMenu({ venue, type, lines, terms }: { venue: Venue; type: VenueType; lines: VenuePrice[]; terms?: PriceTerms | null }) {
  if (!lines.length)
    return (
      <div className="space-y-4">
        <GapCard
          title={type === 'bar' ? 'No drinks list yet' : 'No menu or prices yet'}
          body={`Seen the ${type === 'bar' ? 'drinks list' : 'menu'}? ${SEND_EITHER}`}
          to={sendPath(venue, 'prices')}
          action={type === 'bar' ? 'Send the drinks list' : 'Send the menu'}
        />
        {terms?.note && <p>{terms.note}</p>}
      </div>
    )
  return (
    <div className="space-y-2">
      <PriceList lines={lines} terms={terms} />
      <ListNote tags={lines.flatMap((p) => dishTags(p.tags))} prices={lines} note={terms?.note} by={creditOf(venue, 'prices')} />
    </div>
  )
}

/**
 * The menu for one date (?date=, default today), with a calendar of every date that has one. A Dining venue that has
 * never posted dishes shows its posted list (`prices`) instead, or why there's no menu.
 */
function DatedMenu({ title, type, venue, now, prices }: { title: string; type: VenueType; venue: Venue; now: LocalNow; prices?: VenuePrice[] }) {
  const { snapshot } = useReady()
  const [calendarOpen, setCalendarOpen] = useState(false)
  const { asked, date, setDate, fetched, dates } = useMenuDate(venue, now)
  const { days, failed } = useMenuOn(venue, date)
  const menuBy = sentBy(useMenuCredits(venue, date))
  if (!dates.length && !asked) {
    if (prices?.length)
      return (
        <Section title={title} type={type}>
          <div className="space-y-6">
            <MissingMenu venue={venue} published={false} />
            <PriceList lines={prices} terms={venue.price_terms} />
            <ListNote tags={prices.flatMap((p) => dishTags(p.tags))} prices={prices} note={venue.price_terms?.note} by={creditOf(venue, 'prices')} />
          </div>
        </Section>
      )
    // A build-time page only knows this week; in the browser, wait for the history before saying there's none
    return <Section title={title} type={type}>{fetched || snapshot ? <MissingMenu venue={venue} /> : null}</Section>
  }

  // A build-time page can't know what "today" will be when it's read
  const relative = snapshot ? undefined : relativeDay(date, now.date)
  const dayMonth: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', ...(date.slice(0, 4) === now.date.slice(0, 4) ? {} : { year: 'numeric' }) }
  // The date beside the section's title: which day this is, the way to the one before and after, and (on a phone,
  // where the rail's calendar isn't beside it) the calendar
  const day = (
    <div className="flex min-w-0 items-center gap-1 max-sm:w-full">
        <button
          type="button"
          onClick={() => setCalendarOpen(!calendarOpen)}
          aria-expanded={calendarOpen}
          aria-label={`${formatISODate(date, { weekday: 'long', ...dayMonth })}: choose another date`}
          className="flex min-w-0 cursor-pointer items-center gap-3 rounded-lg px-2 py-1 text-left transition-colors hover:bg-ink/5 max-sm:-ml-2 md:pointer-events-none md:cursor-auto"
        >
          <Icon of={Calendar} className="size-5 text-muted md:hidden" />
          <span className="min-w-0 truncate text-lg font-medium">
            <span className="sm:hidden">{formatISODate(date, { weekday: 'short', ...dayMonth })}</span>
            <span className="hidden sm:inline">{formatISODate(date, { weekday: 'long', ...dayMonth })}</span>
            {relative && <span className="font-normal text-muted"> · {relative}</span>}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1 max-sm:ml-auto">
          {date !== now.date && (
            <button type="button" onClick={() => setDate(now.date)} className="cursor-pointer rounded-md px-2 py-1 text-sm text-muted transition-colors hover:bg-ink/10 hover:text-ink">
              Today
            </button>
          )}
          <DayStepper value={date} dates={dates} onChange={setDate} />
        </div>
    </div>
  )
  return (
    <Section title={title} type={type} aside={day}>
      {calendarOpen && (
        <div className="mt-4 md:hidden">
          <MenuCalendar value={date} today={now.date} dates={new Set(dates)} onChange={(d) => (setDate(d), setCalendarOpen(false))} />
        </div>
      )}
      {/* A Dining menu with no price list: said once, over the dishes the prices would be beside */}
      {venue.type === 'hall' && !venue.prices?.length && (
        <div className="mb-8">
          <GapLine to={sendPath(venue, 'prices')} action="Send the price list">
            <span className="font-semibold">No prices here yet.</span> <span className="text-muted">Seen what they charge?</span>
          </GapLine>
        </div>
      )}
      <div>
        {days?.some(mealPosted) ? (
          <>
            <DayMenu
              days={days}
              slots={venue.slots}
              date={date}
              prices={prices}
              terms={venue.price_terms}
              now={!snapshot && date === now.date ? now : undefined}
              pricesBy={creditOf(venue, 'prices')}
              // A member's menu goes up from yesterday on
              send={!snapshot && !venue.menu_scripted && date >= addDaysISO(now.date, -1) ? (meal) => sendPath(venue, 'menu', { date, meal }) : undefined}
            />
            {menuBy && (
              <p className="mt-2 text-sm text-muted">
                This menu was sent in by <SentBy by={menuBy} />
              </p>
            )}
          </>
        ) : (
          <p className="text-muted">
            {failed ? "Couldn't load this menu" : days ? 'No menu published for this day' : 'Loading…'}
            {/* Today's can still be sent in */}
            {days && !failed && !snapshot && date === now.date && !venue.menu_scripted && (
              <>
                {'. '}
                <HelpLink venue={venue} kind="menu">Send today’s menu</HelpLink>
              </>
            )}
          </p>
        )}
      </div>
    </Section>
  )
}

const MEMBERS_WHERE: Partial<Record<Channel, string>> = { intranet: 'on the college intranet', app: 'in a college app', email: 'by email' }

/** Why there's no menu here, and how to help. `published: false` leaves out "published, not here yet" (a fixed list is what's published). */
function MissingMenu({ venue, published = true }: { venue: Venue; published?: boolean }) {
  const status = venue.menu_scripted ? undefined : menuGap(venue)
  if (status === 'online' && !published) return null
  const site = venue.site.short_name ?? venue.site.name
  const [title, lead] =
    status === 'members' ? ['Menu for members only', `${site} posts its daily menu for members only, ${MEMBERS_WHERE[venue.menu_channel!] ?? 'not online'}. A member?`]
    : status === 'online' ? ['Published, not here yet', `${site} publishes this menu, and it isn’t here yet. Seen it?`]
    : status === 'unpublished' ? ['No menu published', `${site} doesn’t publish this menu anywhere we know of. Seen it?`]
    : ['No menu here yet', 'Seen today’s menu?']
  return (
    <GapCard title={title} body={`${lead} ${SEND_EITHER}`} to={sendPath(venue, 'menu')} action="Send today’s menu">
      {status === 'online' && venue.menu_url && (
        <div className="mt-2">
          <ExternalLink href={venue.menu_url} />
        </div>
      )}
    </GapCard>
  )
}

/** What a member needs to go to formal hall: when, what it costs, guests, dress, how to book (in words from lib/formal.ts). */
function FormalHall({ venue, formal: f }: { venue: Venue; formal: Formal }) {
  const when = formalWhen(venue, f)
  const price = formalPrice(f) && (
    <>
      {formalPrice(f)}
      {f.prices_seen && <span className="text-muted"> ({formatISODate(f.prices_seen, { month: 'short', year: 'numeric' })})</span>}
    </>
  )
  const rows: [string, ReactNode][] = [
    ['When', when.length ? when.map((w) => <span key={w} className="block">{w}</span>) : undefined],
    ['Price', price],
    ['Guests', formalGuests(f)],
    ['Dress', formalDress(f)],
    ['Booking', formalBooking(f)],
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

const sentence = (parts: (string | false | null | undefined)[]) => {
  const s = parts.filter(Boolean).join(', ')
  return s ? s[0].toUpperCase() + s.slice(1) : undefined
}

/**
 * Diets when known, its website, and how to report a change, in a line (where it is, and what's missing, including
 * diets, are the rail's).
 */
function Details({ venue }: { venue: Venue }) {
  const website = venue.url ?? venue.site.official_dining_url
  const diets = sentence(venue.dietary.tags.map((t: DietTag) => DIET_LABEL[t].toLowerCase()))
  return (
    <ul className="order-4 flex flex-col gap-x-8 gap-y-3 text-[1.0625rem] sm:flex-row sm:flex-wrap sm:items-baseline md:mt-8 md:border-t md:border-ink/10 md:pt-6">
        {venue.access_note && <li className="w-full">{venue.access_note}</li>}
        {diets && (
          <Fact icon={Leaf} known>
            {diets} options
          </Fact>
        )}
        {website && (
          <Fact icon={Global} known>
            <ExternalLink href={website} className="" />
          </Fact>
        )}
        <li className="border-t border-ink/10 pt-3 sm:border-0 sm:pt-0">
          <Link to={sendPath(venue, 'other')} className="flex items-center gap-3 text-[0.9375rem] text-muted transition-colors hover:text-ink">
            <Icon of={Flag} />
            Report a change
          </Link>
        </li>
    </ul>
  )
}

function Fact({ icon, known, children }: { icon: Parameters<typeof Icon>[0]['of']; known: boolean; children: ReactNode }) {
  return (
    <li className={`flex items-start gap-3 ${known ? 'text-ink' : 'text-muted'}`}>
      <Icon of={icon} className="mt-1 size-[1.125rem] text-muted" />
      <span className="min-w-0">{children}</span>
    </li>
  )
}

/**
 * The hours for the time of year (term or not), the week in as few rows as it takes: days with the same times run
 * together, a day's times in order (the meal each is, on hover; the status line and the menu name them). Walk-in hours
 * only: formal hall is booked, and has its own section (a Hall used only for formals lists those instead). The other
 * period's hours when only those are known.
 */
function Hours({ venue, now }: { venue: Venue; now: LocalNow }) {
  const { snapshot } = useReady()
  const inTerm = isFullTerm(now.date)
  const current = periodSlots(venue.slots, now.date)
  const period = current.length ? current : venue.slots.filter((s) => s.period === (inTerm ? 'vacation' : 'term')).sort(slotOrder)
  const walkIn = period.filter((s) => s.meal !== 'formal')
  const shown = walkIn.length ? walkIn : period
  const seasonal = venue.slots.some((s) => s.period !== 'all')
  const label = seasonal && ((current.length ? inTerm : !inTerm) ? 'In term' : 'Out of term')
  // Today's hours stand out, once the page knows what today is (a prerendered page shows them all alike)
  const today = (days: Day[]) => snapshot || days.includes(now.day)
  const changedToday = snapshot ? [] : withDayTimes(venue.slots, venue.menu).filter((s) => s.date === now.date)
  const cancelledToday = snapshot ? [] : venue.menu.filter((d) => d.date === now.date && mealCancelled(d))
  const by = creditOf(venue, 'hours')
  // None known: the status line over this says so (a prerendered page, which has none, says it here), and the way to send them
  if (!venue.slots.length)
    return (
      <p className="text-muted">
        {snapshot && 'Hours not published. '}
        <HelpLink venue={venue} kind="hours">Send the opening times</HelpLink>
      </p>
    )
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3 text-[0.9375rem] text-muted">
        <h2 className="font-semibold text-ink">{walkIn.length || !shown.length ? 'Hours' : 'Formal hall'}</h2>
        {label && <span>{label}</span>}
      </div>
      {shown.length && new Set(shown.map((s) => s.meal)).size > 1 ? (
        // A meal to a row, named, its times beside it and their days after (under them, in a rail too narrow for both):
        // what's served today in ink, the rest quieter
        <div className="@container">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3.5 gap-y-1.5 tabular-nums @min-[17rem]:grid-cols-[auto_auto_minmax(0,1fr)]">
            {mealHours(shown).map(({ meal, times }) => (
              <Fragment key={meal}>
                <dt className={`font-medium ${today(times.flatMap((t) => t.days)) ? 'text-ink' : 'text-muted'}`}>{MEAL_LABEL[meal]}</dt>
                {times.map((t, n) => (
                  <Fragment key={t.start}>
                    <dd className={`whitespace-nowrap ${n ? 'col-start-2' : ''} ${today(t.days) ? 'text-ink' : 'text-muted'}`}>{t.start}–{t.end}</dd>
                    <dd className="col-start-2 -mt-1.5 text-sm text-muted @min-[17rem]:col-start-auto @min-[17rem]:mt-0">{formatDays(t.days, true)}</dd>
                  </Fragment>
                ))}
              </Fragment>
            ))}
          </dl>
        </div>
      ) : shown.length ? (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-1.5 tabular-nums">
          {weekHours(shown).map((row) => (
            // Today's row stands out, once the page knows what today is
            <div key={row.days.join()} className={`contents ${today(row.days) ? 'text-ink' : 'text-muted'}`}>
              <dt className="whitespace-nowrap">{formatDays(row.days)}</dt>
              {/* A time to a line, so a day of three meals doesn't wrap mid-list */}
              <dd>
                {row.times.map((s) => (
                  <span key={`${s.meal}${s.start}`} title={MEAL_LABEL[s.meal]} className="block whitespace-nowrap">{s.start}–{s.end}</span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-muted">
          Not published. <HelpLink venue={venue} kind="hours">Send the times</HelpLink>
        </p>
      )}
      {!current.length && shown.length > 0 && <p className="mt-2 text-sm text-muted">{inTerm ? 'Term' : 'Out-of-term'} hours not published</p>}
      {by && (
        <p className="mt-2 text-sm text-muted">
          Sent in by <SentBy by={by} />
        </p>
      )}
      {/* The table is the usual week; today's menus can change it (the status line over it already counts the change) */}
      {(changedToday.length > 0 || cancelledToday.length > 0) && (
        <p className="mt-3 text-[0.9375rem] font-medium text-notice tabular-nums">
          Today: {[...changedToday.map((s) => `${MEAL_LABEL[s.meal]} ${s.start}–${s.end}`), ...cancelledToday.map((d) => d.note)].join(', ')}
        </p>
      )}
    </div>
  )
}
