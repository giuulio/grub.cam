// University cafés whose posted price list is a document on their page: checked once a day, read by the model only
// when it has changed (lib/docs.ts readPriceDocs), and saved over the lines that came from it.
import { parse } from 'node-html-parser'
import { pageText, type DocRef, type PriceSource } from '../lib/docs.ts'
import { fetchText } from '../lib/http.ts'

/** A page's PDF links whose text matches each of `links` (key → link text), as documents known by those keys. */
function pdfLinks(page: string, links: Record<string, RegExp>, label: (key: string) => string): PriceSource {
  return {
    async documents() {
      const anchors = parse(await fetchText(page)).querySelectorAll('a')
      const refs: DocRef[] = []
      for (const [key, text] of Object.entries(links)) {
        const a = anchors.find((a) => text.test(a.text.trim()) && /\.pdf(\?|$)/i.test(a.getAttribute('href') ?? ''))
        if (!a) throw new Error(`no "${text.source}" PDF link on ${page}`)
        refs.push({ key, url: new URL(a.getAttribute('href')!, page).href, kind: 'pdf', label: label(key) })
      }
      return refs
    },
  }
}

export const botanicGardenPrices = pdfLinks('https://www.thegardenkitchen.uk/the-garden-cafe', { menu: /^view menu$/i }, () => "The Garden Café's menu at the Botanic Garden")
export const kettlesYardPrices = pdfLinks('https://www.thegardenkitchen.uk/gardenkitchenatkettlesyard', { menu: /^view menu$/i }, () => "The Garden Kitchen's menu at Kettle's Yard")
export const courtyardKitchenPrices = pdfLinks('https://www.cdc.events/events/courtyardkitchen/', { menu: /current menu/i }, () => "The Courtyard Kitchen's menu at the Fitzwilliam Museum")
export const madingleyPrices = pdfLinks('https://madingleyhall.cam.ac.uk/dining/the-cafe/', { menu: /^cafe menu$/i, drinks: /^drinks menu$/i }, (k) => `Madingley Hall café's ${k === 'drinks' ? 'drinks' : 'food'} menu`)
export const cavendishPrices = pdfLinks('https://www.cdc.events/cavendish-cafe/', { menu: /current menu/i }, () => "The Cavendish Café's seasonal menu")

const OCCIDENTE = 'https://www.catering.admin.cam.ac.uk/cafes/occidente-kitchen-and-bar'
/** Occidente's bistro menu is on its page, priced: the page's main text is the document. */
export const occidentePrices: PriceSource = {
  async documents() {
    const root = parse(await fetchText(OCCIDENTE))
    const main = root.querySelector('#main-content') ?? root
    return [{ key: 'menu', url: OCCIDENTE, kind: 'text', text: pageText(main.innerHTML), label: "Occidente's bistro menu, on its University Catering page" }]
  },
  guide: 'Only the priced menu: leave out the opening hours and the description of the place. "Contains: …" lines are allergens: leave them out. Codes like (GFA, DF) stay in brackets after the name as printed.',
}
