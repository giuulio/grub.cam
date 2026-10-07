import { Link } from 'react-router'
import { useData } from '../lib/data/useData.tsx'

export function About() {
  const data = useData()
  const ready = data.status === 'ready'
  const colleges = ready ? data.bundle.colleges : []
  const withMenu = colleges.filter((c) => c.venues.some((v) => v.menu_source?.status === 'live'))
  const without = colleges.filter((c) => !withMenu.includes(c))
  const dishes = ready ? data.bundle.menus.reduce((n, m) => n + m.days.reduce((k, d) => k + d.items.length, 0), 0) : 0

  return (
    <div className="prose prose-stone max-w-none text-sm dark:prose-invert">
      <h1 className="text-2xl font-bold">About Grub</h1>
      <p>
        Grub answers one question: <strong>where can I eat in Cambridge right now, and what's on?</strong> It brings together the dining halls, cafés and bars of all
        31 Colleges, with opening hours, who can get in, how to pay, dietary provision and — for the {withMenu.length} Colleges that publish one — this week's menu.
      </p>
      <h2 className="mt-6 text-lg font-semibold">Where the data comes from</h2>
      <ul className="list-disc pl-5">
        <li>
          <strong>Menus</strong> are re-published from each College's own public page, PDF or app, with a link to the source on every card.{' '}
          {ready && (
            <>
              {dishes.toLocaleString()} dishes are loaded this week. Eleven Colleges are fetched automatically; the rest are transcribed from PDFs and image-based menus.
            </>
          )}
        </li>
        <li>
          <strong>Hours, access and payment</strong> were audited against official College pages on 7 October 2026. Where a fact comes from a secondary source (a student
          visitor report, Google Maps, an old handbook) we say so, and the confidence badge turns amber or red.
        </li>
        <li>
          <strong>Term-time hours</strong> are applied during Full Term (Michaelmas 2026: 6 Oct – 4 Dec). Outside term we only show vacation hours where a College publishes them.
        </li>
      </ul>
      <h2 className="mt-6 text-lg font-semibold">Colleges without a public menu</h2>
      <p>
        {without.map((c, i) => (
          <span key={c.slug}>
            <Link to={`/college/${c.slug}`} className="text-grub-600 hover:underline">
              {c.name}
            </Link>
            {i < without.length - 1 ? ', ' : ''}
          </span>
        ))}
        {without.length > 0 && ' — menus are on members-only intranets, apps or emails. We still list their hours and venues.'}
      </p>
      <h2 className="mt-6 text-lg font-semibold">Caveats</h2>
      <ul className="list-disc pl-5">
        <li>Colleges change hours for formals, feasts and vacations at short notice. A green "Open" means the published timetable says so, not that we've checked the door.</li>
        <li>Diet tags are the College's own labels (V, VG, PB, H, GF). Where a College doesn't label dishes we don't guess.</li>
        <li>Prices are member/student prices unless stated; non-members usually pay more.</li>
      </ul>
      <h2 className="mt-6 text-lg font-semibold">Something wrong?</h2>
      <p>
        Open an issue or pull request on the public repository — every fact lives in a reviewable data file. Ratings, reviews and "report an error" are coming next.
      </p>
      {ready && <p className="text-xs text-stone-500">Data source: {data.source}. Generated {new Date(data.bundle.generated_at).toLocaleString('en-GB', { timeZone: 'Europe/London' })}.</p>}
    </div>
  )
}
