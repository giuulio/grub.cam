// How each college publishes its menus. Scripted sources have an adapter and are fetched by
// `npm run ingest`; the rest are transcribed by hand or need a collaborator in the college.
// Checked 7 Oct 2026.
import type { MenuSource } from './lib/source.ts'
import { corpus } from './sources/corpus.ts'
import { darwin } from './sources/darwin.ts'
import { downing } from './sources/downing.ts'
import { homerton } from './sources/homerton.ts'
import { jesus } from './sources/jesus.ts'
import { magdalene } from './sources/magdalene.ts'
import { peterhouse } from './sources/peterhouse.ts'
import { robinson } from './sources/robinson.ts'
import { selwyn } from './sources/selwyn.ts'
import { stJohns } from './sources/st-johns.ts'
import { wolfson } from './sources/wolfson.ts'

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
  { venue: 'darwin/servery', channel: 'html', url: 'https://www.darwin.cam.ac.uk/dine/weekly-menu/', cadence: 'weekly tabs, about 5 weeks ahead', adapter: darwin },
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
    cadence: 'weekly',
    notes: 'Menus are not listed in date order; pick by the "Com DD/MM/YY" label.',
    adapter: magdalene,
  },
  {
    venue: 'peterhouse/hall-servery',
    channel: 'json',
    url: 'https://petmenu.co.uk/',
    cadence: 'whole term',
    notes: 'Student-run, built from College PDFs; "not guaranteed complete or correct".',
    adapter: peterhouse,
  },
  {
    venue: 'robinson/garden-restaurant-dining-hall',
    channel: 'html',
    url: 'https://www.robinson.cam.ac.uk/college-life/garden-restaurant-menu',
    cadence: 'daily, about 2 weeks ahead',
    notes: '?date= returns the following day; the adapter trusts the heading.',
    adapter: robinson,
  },
  { venue: 'selwyn/hall-servery', channel: 'html', url: 'https://www.sel.cam.ac.uk/current-members/hall-menu', cadence: 'daily, about 4 weeks ahead', adapter: selwyn },
  { venue: 'st-johns/buttery', channel: 'html', url: 'https://menu.joh.cam/', cadence: 'rolling 7 days', adapter: stJohns },
  { venue: 'wolfson/buttery-dining-hall', channel: 'html', url: 'https://www.wolfson.cam.ac.uk/food/cafeteria-menus', cadence: 'current week only', adapter: wolfson },

  // Public, transcribed by hand. PDFs: curl -A "Mozilla/5.0" URL | pdftotext -layout - -
  // Sway/Canva: Chrome --headless=new --dump-dom URL
  { venue: 'churchill/dining-hall', channel: 'html', url: 'https://www.chu.cam.ac.uk/about/campus/dining-at-college/lunch-and-dinner-menu/', cadence: 'weekly' },
  {
    venue: 'clare-hall/dining-hall',
    channel: 'sway',
    url: 'https://sway.cloud.microsoft/b7Zz74Q2g96EIhE9',
    cadence: 'weekly',
    notes: 'Needs JavaScript to render.',
  },
  {
    venue: 'fitzwilliam/buttery',
    channel: 'pdf',
    url: 'https://www.fitz.cam.ac.uk/cafe-bar-and-buttery',
    cadence: 'weekly',
    notes: 'PDF filenames are not dated; the date is inside the PDF and on the link text.',
  },
  {
    venue: 'lucy-cavendish/warburton-hall-servery',
    channel: 'canva',
    url: 'https://www.canva.com/design/DAFvirNLKtg/view',
    cadence: 'weekly, same design overwritten',
    notes: 'Embedded on https://www.lucy.cam.ac.uk/dining-hall-and-cafe. Daily posts on instagram.com/lucycavfood.',
  },
  { venue: 'newnham/buttery', channel: 'html', url: 'https://newn.cam.ac.uk/weekly-menus', cadence: 'weekly', notes: 'Today only: https://newn.cam.ac.uk/todays-menu' },
  {
    venue: 'pembroke/servery-trough',
    channel: 'pdf',
    url: 'https://www.pem.cam.ac.uk/college/catering/information-students/servery-menu',
    cadence: 'weekly, 3-week cycle',
    notes: 'Only the current cycle week is linked.',
  },
  { venue: 'queens/cripps-dining-hall-cafeteria', channel: 'html', url: 'https://www.queens.cam.ac.uk/life-at-queens/catering/dining-hall/weekly-menu/', cadence: 'weekly' },
  {
    venue: 'st-catharines/hall-cafeteria',
    channel: 'pdf',
    url: 'https://www.caths.cam.ac.uk/students/college-facilities-and-forms/catering-for-our-community/cafeteria',
    cadence: 'weekly, 4-week cycle',
    notes: 'Each PDF is dated at the top. Counters: 1 meat/fish, 2 vegetarian, 3 plant-based. Daily email list: https://lists.cam.ac.uk/sympa/subscribe/caths-menus',
  },
  {
    venue: 'st-edmunds/dining-hall',
    channel: 'pdf',
    url: 'https://my.st-edmunds.cam.ac.uk/category/menus/',
    cadence: 'weekly post linking lunch/supper PDFs',
    notes: 'The post also lists one-off time changes.',
  },
  {
    venue: 'trinity/hall-servery',
    channel: 'pdf',
    url: 'https://www.trin.cam.ac.uk/download/hall-menu-this-week/',
    cadence: 'weekly',
    notes: 'Needs a browser user agent (plain curl gets 403).',
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

  // No known menu
  { venue: 'sidney-sussex/servery-dining-hall', channel: 'none' },
  { venue: 'corpus-christi/leckhampton-dining-hall', channel: 'unknown', notes: 'Check whether the Corpus foodmenu `reference` parameter selects Leckhampton.' },
]
