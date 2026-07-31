import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import JSZip from 'jszip'
import { CardPngRenderer } from './render'
import { filenameForCard, slugify, type CardContent } from './schema'
import type { StoredCard } from './repository'

type RenderCard = (content: CardContent) => Promise<Uint8Array>

export type CardExportResult = {
  filePath: string
  fileUri: string
  filename: string
  cardCount: number
}

export function resolveCardExportDir(): string {
  return path.resolve(process.env.CARDS_EXPORT_DIR || path.join('data', 'card-exports'))
}

export async function createCardsZip(
  cards: StoredCard[],
  renderCard: RenderCard,
): Promise<Buffer> {
  if (!cards.length) throw new Error('No hay cartas que coincidan con el filtro solicitado.')
  const zip = new JSZip()
  // Anidar en carpetas solo cuando hace falta para distinguir cartas de
  // origenes distintos. La mayoria de las exportaciones son de un unico
  // universo y una unica parte (el caso que reporto el usuario), y ahi
  // anidar universo/parte no aporta nada — solo suma dos niveles de carpeta
  // que, extraidos en Windows dentro de la carpeta que ya crea el propio
  // zip, ayudaban a pasarse del limite de ruta.
  const multipleUniverses = new Set(cards.map((card) => card.universe.id)).size > 1
  const multipleParts = new Set(cards.map((card) => card.part.id)).size > 1

  for (const card of cards) {
    const partPrefix = card.part.number ? `${String(card.part.number).padStart(2, '0')}-` : ''
    // Tope duro además del de slugify(): algunos tipos de carta (Tarot Member)
    // combinan dos slugs y podrían acercarse al límite de ruta de Windows aun
    // con el slug individual ya recortado.
    const base = `${String(card.position).padStart(3, '0')}_${filenameForCard(card.content)}`
    const filename = `${base.slice(0, 50)}.png`
    const folder = multipleUniverses
      ? `${card.universe.slug}/${partPrefix}${card.part.slug}`
      : multipleParts
        ? `${partPrefix}${card.part.slug}`
        : ''
    zip.file(folder ? `${folder}/${filename}` : filename, await renderCard(card.content))
  }

  // Solo imagenes: nada de manifest.json ni otros archivos extra, a pedido
  // expreso — el zip es para importar/repasar las cartas, no para inspeccionar
  // metadata.
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

export async function exportCardsToZip(
  cards: StoredCard[],
  requestedFilename?: string,
): Promise<CardExportResult> {
  const outputDir = resolveCardExportDir()
  await fs.mkdir(outputDir, { recursive: true })
  const fallbackName = cards.length === 1
    ? filenameForCard(cards[0].content)
    : cards.every(({ universe }) => universe.id === cards[0].universe.id)
      ? cards[0].universe.slug
      : 'all-card-universes'
  // El nombre del zip es la carpeta que Windows crea al extraerlo — se
  // recorta agresivo (stem corto + id corto, sin UUID de 36 caracteres ni
  // fecha) porque ese nombre despues se anida bajo carpetas de
  // universo/parte y cada carta, y sumado todo se pasaba del limite de ruta
  // de Windows (0x80010135).
  const stem = slugify(requestedFilename?.replace(/\.zip$/i, '') || fallbackName).slice(0, 30)
  const shortId = randomUUID().slice(0, 8)
  const filename = `${stem}-${shortId}.zip`
  const filePath = path.join(outputDir, filename)
  const renderer = await CardPngRenderer.create()

  try {
    const archive = await createCardsZip(cards, (content) => renderer.render(content))
    await fs.writeFile(filePath, archive)
  } finally {
    await renderer.close()
  }

  return {
    filePath,
    fileUri: pathToFileURL(filePath).href,
    filename,
    cardCount: cards.length,
  }
}
