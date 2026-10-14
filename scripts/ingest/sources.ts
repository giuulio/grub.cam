// How each venue (college or University) publishes its menu. Scripted sources have an adapter, or (menus published as
// documents: PDFs, a page, a Sway or Canva) `documents`, read by a parser or the model; a University café's price list
// can be a document too (`prices`). All are fetched by `npm run ingest`; the rest are transcribed by hand or need a
// collaborator in the college. Checked 7 Oct 2026 (colleges), 8 Oct 2026 (University); documents 13 Oct 2026.
import type { MenuSource } from './lib/source.ts'
import { corpus } from './sources/corpus.ts'
import { darwin } from './sources/darwin.ts'
import { downing } from './sources/downing.ts'
import { homerton } from './sources/homerton.ts'
import { jesus } from './sources/jesus.ts'
import { magdalene, magdaleneFormal } from './sources/magdalene.ts'
import { peterhouse } from './sources/peterhouse.ts'
import { robinson } from './sources/robinson.ts'
import { selwyn } from './sources/selwyn.ts'
import { stJohns } from './sources/st-johns.ts'
import { ucsWeekly } from './sources/ucs.ts'
import { wolfson } from './sources/wolfson.ts'
import { churchill } from './sources/churchill.ts'
import { clareHall } from './sources/clare-hall.ts'
import { fitzwilliam } from './sources/fitzwilliam.ts'
import { lucyCavendish } from './sources/lucy-cavendish.ts'
import { newnham } from './sources/newnham.ts'
import { pembroke } from './sources/pembroke.ts'
import { botanicGardenPrices, cavendishPrices, courtyardKitchenPrices, kettlesYardPrices, madingleyPrices, occidentePrices } from './sources/price-lists.ts'
import { stCatharines } from './sources/st-catharines.ts'
import { stEdmunds } from './sources/st-edmunds.ts'
import { trinity } from './sources/trinity.ts'

// University Catering pages that post this week's lunch, all in the same format
const ucs = (venue: string, url: string, notes?: string): MenuSource => ({ venue, channel: 'html', url, cadence: 'weekly, current week only (Mon–Fri lunch)', notes, adapter: ucsWeekly(url), fallback: true })

export const SOURCES: MenuSource[] = [
  // Scripted
  {
    venue: 'corpus-christi/cafeteria',
    channel: 'html',
    url: 'https://www.corpus.cam.ac.uk/foodmenu/',
    cadence: 'daily, about 8 weeks ahead',
    notes: 'Same vendor app as Jesus. Prices, allergens, diet categories.',
    adapter: corpus,
  },
  { venue: 'darwin/servery', channel: 'html', url: 'https://www.darwin.cam.ac.uk/dine/weekly-menu/', cadence: 'weekly tabs, about 5 weeks ahead', adapter: darwin, fallback: true },
  {
    venue: 'downing/servery-great-hall',
    channel: 'json',
    url: 'https://wba.kafoodle.com/17260',
    cadence: 'current week only (Kafoodle group "MICHAELMAS 2026 WEEK n"); past days drop off',
    notes: 'One combined daily menu, stored as both lunch and dinner. No prices.',
    adapter: downing,
  },
  {
    venue: 'homerton/dining-hall',
    channel: 'json',
    url: 'https://www.homerton.cam.ac.uk/catering',
    cadence: 'this week + 3 (weekOffset 0–3)',
    notes: 'JSON endpoint from drupalSettings.cafeteriaMenu.apiEndpoint.',
    adapter: homerton,
  },
  {
    venue: 'jesus/caff',
    channel: 'html',
    url: 'https://apps.jesus.cam.ac.uk/foodmenuview/?event_id=1',
    cadence: 'daily, about 8 weeks ahead',
    notes: 'event_id 1 = lunch, 2 = dinner. Prices, allergens, sold-out flag.',
    adapter: jesus,
  },
  {
    venue: 'magdalene/ramsay-hall',
    channel: 'html',
    url: 'https://viewthe.menu/lyzv',
    cadence: 'weekly, about 2 weeks ahead',
    notes: 'Menus are not listed in date order; pick by the "Com DD/MM/YY" label.',
    adapter: magdalene,
  },
  {
    venue: 'magdalene/hall',
    channel: 'html',
    url: 'https://viewthe.menu/lyzv',
    cadence: 'weekly',
    notes: 'Formal Hall\'s menu ("Formal Hall WK Com DD/MM/YY"), on the same page as Ramsay Hall\'s: a starter, two mains and a dessert each night.',
    adapter: magdaleneFormal,
  },
  {
    venue: 'peterhouse/hall-servery',
    channel: 'json',
    url: 'https://petmenu.co.uk/',
    cadence: 'whole term, from the week before Full Term to the week after',
    notes: 'Student-run, built from College PDFs; "not guaranteed complete or correct".',
    adapter: peterhouse,
  },
  {
    venue: 'robinson/garden-restaurant',
    channel: 'html',
    url: 'https://www.robinson.cam.ac.uk/college-life/garden-restaurant-menu',
    cadence: 'daily, about 2 weeks ahead',
    notes: '?date= returns the following day (in the evening at least); the adapter trusts the heading. Over the October clock change an evening run cannot reach the Monday (?date=2026-10-25 shows the 25th, ?date=2026-10-26 the 27th); daytime runs fetch it and saved days stay.',
    adapter: robinson,
    fallback: true,
  },
  { venue: 'selwyn/hall-servery', channel: 'html', url: 'https://www.sel.cam.ac.uk/current-members/hall-menu', cadence: 'daily, about 4 weeks ahead', adapter: selwyn, fallback: true },
  { venue: 'st-johns/buttery', channel: 'html', url: 'https://menu.joh.cam/', cadence: 'rolling 7 days', adapter: stJohns, fallback: true },
  { venue: 'wolfson/buttery-dining-hall', channel: 'html', url: 'https://www.wolfson.cam.ac.uk/food/cafeteria-menus', cadence: 'rolling, about 2 days back and 3 ahead; a day is filled in meal by meal', adapter: wolfson, fallback: true },
  ucs('west-cambridge/west-hub-canteen', 'https://www.catering.admin.cam.ac.uk/cafes/west-hub-canteen'),
  ucs('west-cambridge/greenwich-house-cafe', 'https://www.catering.admin.cam.ac.uk/cafes/greenwich-house-cafe', 'Hot dishes from the West Hub kitchen.'),
  ucs('west-cambridge/scholars-brew', 'https://www.catering.admin.cam.ac.uk/cafes/scholars-brew'),

  // Documents: read by a parser (Churchill, Newnham) or the model, only when they change (lib/docs.ts, 0043)
  {
    venue: 'churchill/dining-hall',
    channel: 'html',
    url: 'https://www.chu.cam.ac.uk/about/campus/dining-at-college/lunch-and-dinner-menu/',
    cadence: 'weekly, filled in day by day',
    notes: 'One table per day, Lunch and Dinner columns; later days stay empty until posted. Cloudflare in front: plain fetches were answered on 13 Oct 2026.',
    documents: churchill,
  },
  {
    venue: 'clare-hall/dining-hall',
    channel: 'sway',
    url: 'https://sway.cloud.microsoft/b7Zz74Q2g96EIhE9',
    cadence: 'weekly',
    notes: 'Needs JavaScript to render: Chrome draws it and the model reads its text.',
    documents: clareHall,
  },
  {
    venue: 'fitzwilliam/buttery',
    channel: 'pdf',
    url: 'https://www.fitz.cam.ac.uk/cafe-bar-and-buttery',
    cadence: 'weekly',
    notes: 'PDF filenames are not dated; the date is inside the PDF and on the link text. Formal Hall menus are PDFs on the same page.',
    documents: fitzwilliam,
  },
  {
    venue: 'lucy-cavendish/warburton-hall-servery',
    channel: 'canva',
    url: 'https://www.canva.com/design/DAFvirNLKtg/view',
    cadence: 'weekly, same design overwritten',
    notes: 'Embedded on https://www.lucy.cam.ac.uk/dining-hall-and-cafe. Daily posts on instagram.com/lucycavfood. Read from a screenshot: as text its columns scramble. Canva puts a bot check in front of GitHub\'s runners (not got round): run it from a machine it doesn\'t challenge, or transcribe it.',
    documents: lucyCavendish,
  },
  { venue: 'newnham/buttery', channel: 'html', url: 'https://newn.cam.ac.uk/weekly-menus', cadence: 'weekly', notes: 'Today only: https://newn.cam.ac.uk/todays-menu', documents: newnham },
  {
    venue: 'pembroke/servery-trough',
    channel: 'pdf',
    url: 'https://www.pem.cam.ac.uk/college/catering/information-students/servery-menu',
    cadence: 'weekly, 3-week cycle',
    notes: 'The page dates each cycle week (Week 1: w/c 5 Oct, 26 Oct, 16 Nov) and links its PDF once posted (Week 2 went up on 13 Oct): each PDF is read once and copied to every week listed. The unlinked week_2.pdf/week_3.pdf on the server are from 2020.',
    documents: pembroke,
  },
  {
    venue: 'st-catharines/hall-cafeteria',
    channel: 'pdf',
    url: 'https://www.caths.cam.ac.uk/students/college-facilities-and-forms/catering-for-our-community/cafeteria',
    cadence: 'weekly, 4-week cycle',
    notes: 'Each PDF is dated at the top. Dishes are listed by counter 1–3 with no key: tag only what a dish name says. Daily email list: https://lists.cam.ac.uk/sympa/subscribe/caths-menus',
    documents: stCatharines,
  },
  {
    venue: 'st-edmunds/dining-hall',
    channel: 'pdf',
    url: 'https://my.st-edmunds.cam.ac.uk/category/menus/',
    cadence: 'weekly post linking lunch/supper PDFs',
    notes: 'The post also lists one-off time changes, read into that meal\'s note.',
    documents: stEdmunds,
  },
  {
    venue: 'trinity/hall-servery',
    channel: 'pdf',
    url: 'https://www.trin.cam.ac.uk/download/hall-menu-this-week/',
    cadence: 'weekly, current and next week',
    notes: 'This week and https://www.trin.cam.ac.uk/download/hall-menu-next-week/. Its text layer can retain removed dishes beneath cancellation notices or blank meals: the model is told to read the rendered page.',
    documents: trinity,
  },

  // Public, but behind a CAPTCHA (SiteGround's sgcaptcha, even in headless Chrome): transcribed by hand, never got round
  { venue: 'queens/cripps-dining-hall-cafeteria', channel: 'html', url: 'https://www.queens.cam.ac.uk/life-at-queens/catering/dining-hall/weekly-menu/', cadence: 'weekly' },

  // Menus supplied directly; transcribed with ingest:prices or ingest:manual
  { venue: 'gonville-and-caius/old-courts-cafe-bar', channel: 'email', cadence: 'fixed', notes: 'Caius Café breakfast/lunch menu supplied by the JCR Food & Bar representative on 12 Oct 2026; saved with ingest:prices. Hall menus remain separate.' },
  {
    venue: 'sidney-sussex/servery-dining-hall',
    channel: 'email',
    cadence: 'three-week rota, new each term (Mon–Fri lunch, daily dinner)',
    notes: 'Cafeteria menus sent by SSCSU Accommodation & Catering with the College\'s agreement on 14 Oct 2026; each PDF dates its three weeks. Michaelmas 2026 saved with ingest:manual. Friday dinner is "European Night, see posters for details": saved as that note, until a member sends a photo of the poster. Lent\'s rota promised at the start of Lent.',
  },

  // Members only: need a collaborator in the college
  { venue: 'christs/upper-hall', channel: 'intranet', notes: 'https://intranet.christs.cam.ac.uk/upper-hall-menus' },
  { venue: 'clare/buttery', channel: 'intranet', notes: 'https://www.clare.cam.ac.uk/current-students/catering (Clare accounts only)' },
  { venue: 'emmanuel/hall', channel: 'intranet', cadence: 'current and next meal', notes: 'https://apps.emma.cam.ac.uk/college/menus/ (Emmanuel accounts only)' },
  { venue: 'girton/hall-cafeteria', channel: 'email', cadence: 'weekly, Friday internal newsletter' },
  { venue: 'gonville-and-caius/hall', channel: 'intranet', notes: 'Meal-booking system on the intranet' },
  { venue: 'hughes-hall/fenners-dining-hall', channel: 'app', cadence: 'daily', notes: 'UPay app (Hughes accounts only)' },
  { venue: 'kings/servery-dining-hall', channel: 'email', cadence: 'weekly, Sunday member email' },
  { venue: 'murray-edwards/dome-dining-hall', channel: 'intranet', notes: 'My Medwards' },
  { venue: 'trinity-hall/cafeteria', channel: 'intranet', cadence: 'daily' },

  // University: menus that aren't dated (fixed or seasonal) or aren't online. A price list on the venue's page is
  // checked once a day and read when it changes (`prices`); the rest are hand-transcribed or not online
  { venue: 'west-cambridge/occidente', channel: 'html', url: 'https://www.catering.admin.cam.ac.uk/cafes/occidente-kitchen-and-bar', cadence: 'fixed', notes: 'Bistro menu with prices on the page.', prices: occidentePrices },
  {
    venue: 'west-cambridge/cavendish-cafe',
    channel: 'none',
    cadence: 'daily',
    notes: 'Daily hot lunch, not published online (reported). The seasonal café menu PDF linked from https://www.cdc.events/cavendish-cafe/ is its price list, read when it changes; its drinks screen and lunch poster lines (member photos) stay.',
    prices: cavendishPrices,
  },
  { venue: 'downing-site/pathology-cafe', channel: 'none', cadence: 'weekly', notes: 'Menu changes weekly; not published online.' },
  {
    venue: 'west-cambridge/the-servery',
    channel: 'none',
    cadence: 'weekly',
    notes: 'A Mon–Fri hot lunch with prices on a board in the servery, naming weekdays but not the week; not online. A member photo of 12 Oct 2026 was saved for that week only.',
  },
  { venue: 'biomedical-campus/cruk-cafe', channel: 'none', cadence: 'daily', notes: 'Daily menus printed in the café only.' },
  { venue: 'fitzwilliam-museum/courtyard-kitchen', channel: 'pdf', url: 'https://www.cdc.events/events/courtyardkitchen/', cadence: 'seasonal', prices: courtyardKitchenPrices },
  { venue: 'kettles-yard/garden-kitchen', channel: 'pdf', url: 'https://www.thegardenkitchen.uk/gardenkitchenatkettlesyard', cadence: 'fixed', prices: kettlesYardPrices },
  { venue: 'botanic-garden/garden-cafe', channel: 'pdf', url: 'https://www.thegardenkitchen.uk/the-garden-cafe', cadence: 'fixed', prices: botanicGardenPrices },
  { venue: 'madingley-hall/cafe', channel: 'pdf', url: 'https://madingleyhall.cam.ac.uk/dining/the-cafe/', cadence: 'fixed', prices: madingleyPrices },

  // No known menu
  { venue: 'corpus-christi/leckhampton-dining-hall', channel: 'unknown', notes: 'Not on the Corpus foodmenu: its `reference` parameter is ignored (0–5 return the same cafeteria menu, checked 12 Oct 2026).' },
]
