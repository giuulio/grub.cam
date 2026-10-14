import { afterEach, describe, expect, it, vi } from 'vitest'
import { weekDates } from '../lib/dates.ts'
import { corpus } from './corpus.ts'
import { darwin } from './darwin.ts'
import { downing } from './downing.ts'
import { homerton } from './homerton.ts'
import { jesus } from './jesus.ts'
import { magdalene } from './magdalene.ts'
import { robinson } from './robinson.ts'
import { stJohns } from './st-johns.ts'
import { wolfson } from './wolfson.ts'

// Each source's allergens as its page lists them, in markup cut down from the pages of 14 Oct 2026.

/** Answers the first URL fragment the request contains, in order. */
function serve(pages: [string, string | object][]) {
  vi.stubGlobal('fetch', async (url: string) => {
    const hit = pages.find(([part]) => url.includes(part))
    if (!hit) return new Response('', { status: 404 })
    return new Response(typeof hit[1] === 'string' ? hit[1] : JSON.stringify(hit[1]))
  })
}

afterEach(() => vi.unstubAllGlobals())

const week = '2026-W42'
const ctx = { week, dates: ['2026-10-14'], today: '2026-10-14' }
const dishes = async (adapter: { fetch: typeof jesus.fetch }, c = ctx) => (await adapter.fetch(c)).days.flatMap((d) => d.items).map((i) => [i.name, i.allergens ?? []])

describe('allergens from each source', () => {
  it("Jesus's fm-allergen icons, apart from its diet requirements", async () => {
    serve([['digiboard.php', `<h2>Cafeteria Lunch</h2><table class="fm-menu-courses"><tr><th colspan="1"><h4>Soup</h4></th></tr>
      <tr class="fm-item"><td class="fm-item-label">Creamy carrot soup</td><td class="fm-item-price">£1.10</td>
      <td class="fm-item-icons"><div class="fm-attribute vegan fm-requirement" title="Vegan"><span class="fm-attribute-name">Vegan</span></div></td>
      <td class="fm-dietary-attributes"><div class="fm-attribute celery fm-allergen" title="Celery"><span class="fm-attribute-name">Celery</span></div> <div class="fm-attribute sulphites fm-allergen" title="Sulphites"><span class="fm-attribute-name">Sulphites</span></div></td></tr></table>`]])
    const [day] = (await jesus.fetch(ctx)).days
    expect(day.items[0]).toMatchObject({ name: 'Creamy carrot soup', tags: ['vegan', 'vegetarian'], allergens: ['celery', 'sulphites'] })
  })

  it("Corpus's Allergens column, keeping a label that isn't one of the 14", async () => {
    serve([['corpus.cam.ac.uk', `<div class="accordion"><h3><button aria-controls="sect2"><span class="accordion-title">Lunch</span></button></h3>
      <div id="sect2"><table><tbody><tr class="hide-bg"><td class="hide-label"><h3>Plant Based</h3></td></tr>
      <tr><td><p>Wild mushroom and herb stroganoff</p></td><td><p>£2.10</p></td><td><p>Alcohol, Celery, Sulphur dioxide</p></td></tr>
      <tr><td><p>Steamed rice</p></td><td><p>£0.60</p></td><td><p></p></td></tr></tbody></table></div></div>`]])
    expect(await dishes(corpus)).toEqual([['Wild mushroom and herb stroganoff', ['alcohol', 'celery', 'sulphites']], ['Steamed rice', []]])
  })

  it("Darwin's allergen list, keeping a line of sides whole when it lists them", async () => {
    const row = (name: string, allergens: string[]) =>
      `<tr><td width="70%"> ${name} </td><td width="20%"><ul class="menus-allergenlist">${allergens.map((a) => `<li title="${a}"><span></span>${a[0]}</li>`).join('')}</ul></td><td width="10%">£2.95</td></tr>`
    serve([['darwin.cam.ac.uk', `<div class="menus-content menus-content--current" id="menus-content--42"><h3>Wednesday</h3><table><thead><th colspan="3">Lunch</th></thead><tbody>
      ${row('Quorn &amp; courgette chilli and rice', ['Gluten', 'Soya'])}${row('Sides - Mashed potato, Cider braised red cabbage', ['Nuts', 'Sulphites'])}${row('Sides: Chips, Peas', [])}</tbody></table></div>`]])
    expect(await dishes(darwin)).toEqual([
      ['Quorn & courgette chilli and rice', ['gluten', 'soya']],
      ['Mashed potato, Cider braised red cabbage', ['nuts', 'sulphites']],
      ['Chips', []],
      ['Peas', []],
    ])
  })

  it("Homerton's allergens array", async () => {
    serve([['weekOffset=0', { meta: { weekOffset: 0, start: '2026-10-12', end: '2026-10-18' }, days: [{ date: '2026-10-14T00:00:00', weekday: 'Wednesday', breakfast: [], dinner: [], lunch: [{ name: 'Cauliflower cheese Schnitzel with sauce Mornay', allergens: ['Egg', 'Gluten', 'Milk'], price: '3.73' }, { name: 'Roast of the Day', allergens: [], price: '4.11' }] }] }]])
    expect(await dishes(homerton)).toEqual([['Cauliflower cheese Schnitzel with sauce Mornay', ['eggs', 'gluten', 'milk']], ['Roast of the Day', []]])
  })

  it("Downing's Kafoodle allergens: kinds with their allergen, and what it may contain without them", async () => {
    const allergen = (name: string, isMayContain = false) => ({ name, isMayContain })
    serve([
      ['/search/', { menus: [{ id: 1, name: 'Wednesday', config: null, recipes: [{ id: 7, name: 'Chicken Katsu Curry', tags: [], all_allergens: [allergen('Gluten'), allergen('Gluten: Wheat'), allergen('Soya'), allergen('Nuts', true), allergen('Nuts: Almond', true), allergen('Soya', true)] }] }] }],
      ['/data/17260', { menu_groups: [{ id: 99, name: 'MICHAELMAS 2026 WEEK 2', is_active: true }] }],
    ])
    expect((await dishes(downing, { ...ctx, dates: weekDates(week) }))[0]).toEqual(['Chicken Katsu Curry', ['gluten (wheat)', 'soya', 'may contain nuts']])
  })

  it("Wolfson's allergy information", async () => {
    serve([['wolfson.cam.ac.uk', `<div class="food-menu"><div class="view-content"><h3>Wednesday 14 October 2026</h3><ul class="food-menu__list"><li class="collapse__item"><a class="collapse__top"><h4>Breakfast</h4></a><div class="collapse__body">
      <div class="col-12 single-food-menu-item"><div class="row"><div class="col-md-6"><h4><span></span><span>Grilled Sausage</span></h4></div><div class="col-md-4"><div class="field field--name-field-allergy-information field__items"><div class="field__item">Gluten</div><div class="field__item">Sulphur dioxide</div></div></div>
      <div class="col-md-2 food-menu__prices"><span><span>student</span><span>£0.70</span></span><span><span>others</span><span>£0.95</span></span></div></div></div></div></li></ul></div></div>`]])
    expect(await dishes(wolfson)).toEqual([['Grilled Sausage', ['gluten', 'sulphites']]])
  })

  it("St John's allergens after Contains:, with their kinds", async () => {
    serve([['menu.joh.cam', `<div class="weekday"><h2>Wednesday 14 October</h2><div class="accordion-item"><button class="accordion-header"><span>Lunch</span></button><div class="accordion-content"><div><h2>Mains</h2>
      <div class="flex flex-col"><div class="flex"><p class="text-base font-semibold">Pearl barley, pumpkin and walnut loaf</p></div>
      <div class="mt-2 flex"><span class="rounded-sm bg-green-200/30">Vegan</span><p class="text-primary-text font-bold">Contains:</p><span class="text-primary-text flex items-center rounded-lg"> Celery </span><span class="text-primary-text flex items-center rounded-lg"> Gluten (wheat, barley) </span><span class="text-primary-text flex items-center rounded-lg"> Nuts (walnuts) </span><span class="text-primary-text flex items-center rounded-lg"> Sulphur Dioxide </span></div></div></div></div></div></div>`]])
    expect(await dishes(stJohns)).toEqual([['Pearl barley, pumpkin and walnut loaf', ['celery', 'gluten (wheat, barley)', 'nuts (walnuts)', 'sulphites']]])
  })

  it("Robinson's allergen icons among its diet icons", async () => {
    serve([['robinson.cam.ac.uk', `<h3>Menus for Wed 14 Oct 2026</h3><div class="menuColumn"><h3>On Offer for Lunch</h3><div class="menuItem"><strong>Main Courses</strong><br/>
      Aubergine and pepper Parmigiano with mozzarella and parmesan <br/><em>&pound;3.41 / &pound;4.46</em> <img src="/php/catering/icons/v.gif" alt="Vegetarian"/> <img src="/php/catering/icons/ce.gif" alt="Celery"/> <img src="/php/catering/icons/mi.gif" alt="Milk"/></div></div>`]])
    expect((await robinson.fetch(ctx)).days[0].items[0]).toMatchObject({ tags: ['vegetarian'], allergens: ['celery', 'milk'] })
  })

  it("Magdalene's Ten Kites popovers, in its own words", async () => {
    const recipe = (name: string, contains: string, may = '') => `<div class="k10-recipe"><div class="k10-popover"><div class="k10-popover__labels k10-popover__labels_contain"><b>Contains: </b>${contains}</div>${may && `<div class="k10-popover__labels k10-popover__labels_may"><b>May contain: </b>${may}</div>`}</div><span class="k10-recipe__name"> ${name} </span></div>`
    const ld = { '@context': 'http://schema.org', '@type': 'Menu', name: 'Ramsay Wk3 Com 12/10/2026', hasMenuSection: [{ '@type': 'MenuSection', name: 'Wednesday', hasMenuSection: [{ '@type': 'MenuSection', name: 'Lunch 12-1:30pm', hasMenuItem: [{ '@type': 'MenuItem', name: 'BBQ tofu steak', offers: { price: '3.30' } }, { '@type': 'MenuItem', name: 'Garlic bread', offers: { price: '0.80' } }] }] }] }
    serve([
      ['viewthe.menu', `<div class="k10-menu-selector__option-name" data-menu-identifier="g-1"><span>Ramsay Wk3 Com 12/10/2026</span></div>`],
      ['mguid=g-1', `${recipe('BBQ tofu steak', 'Soya', 'Sesame')}${recipe('Garlic bread', 'Cereals with gluten (wheat), Milk, Sulphur dioxide/sulphites')}<script type="application/ld+json">${JSON.stringify(ld)}</script>`],
    ])
    expect(await dishes(magdalene)).toEqual([['BBQ tofu steak', ['soya', 'may contain sesame']], ['Garlic bread', ['gluten (wheat)', 'milk', 'sulphites']]])
  })
})
