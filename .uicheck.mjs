// Sonda temporal: el MCP escribe y el editor debe reflejarlo sin recargar.
import { chromium } from 'playwright'
import { CardRepository } from './src/cards/repository.ts'

const base = process.env.BASE_URL || 'http://localhost:3000'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(`${base}/cartas`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(4000)
const before = await page.locator('.film-thumb').count()
console.log('miniaturas al abrir:', before)

const mcp = new CardRepository()
const [card] = mcp.saveBatch({
  universe: { name: 'Sonda vivo' }, part: { name: 'T', number: 1 },
  cards: [{ type: 'Tier', pathway: 'Moon', rank: 'S', points: ['Escrita por el MCP'] }],
})
const t0 = Date.now()
await page.waitForFunction(
  (n) => document.querySelectorAll('.film-thumb').length > n,
  before,
  { timeout: 8000 },
).then(() => console.log(`el MCP crea -> el editor la muestra en ${Date.now() - t0}ms`))
 .catch(() => console.log('el MCP crea -> NO aparecio en 8s'))

// Edita la carta activa desde el MCP.
await page.locator('.film-thumb').last().click()
await page.waitForTimeout(700)
mcp.updateCard(card.id, { type: 'Tier', pathway: 'Moon', rank: 'F', points: ['Editada en vivo'] })
const t1 = Date.now()
await page.waitForFunction(
  () => document.querySelector('textarea')?.value?.includes('Editada en vivo'),
  null, { timeout: 8000 },
).then(() => console.log(`el MCP edita la carta activa -> reflejado en ${Date.now() - t1}ms`))
 .catch(() => console.log('el MCP edita -> NO se reflejo en 8s'))

// Borrado desde el MCP.
const t2 = Date.now()
mcp.deleteCards([card.id])
await page.waitForFunction((n) => document.querySelectorAll('.film-thumb').length === n, before, { timeout: 8000 })
  .then(() => console.log(`el MCP borra -> desaparece en ${Date.now() - t2}ms`))
  .catch(() => console.log('el MCP borra -> NO desaparecio en 8s'))

mcp['db'].prepare("DELETE FROM universes WHERE slug='sonda-vivo'").run()
mcp.close()
console.log('errores de consola:', errors.length ? errors.slice(0, 3) : 'ninguno')
await browser.close()
