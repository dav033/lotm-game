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
  generatedAt = new Date().toISOString(),
): Promise<Buffer> {
  if (!cards.length) throw new Error('No hay cartas que coincidan con el filtro solicitado.')
  const zip = new JSZip()

  for (const card of cards) {
    const partPrefix = card.part.number ? `${String(card.part.number).padStart(2, '0')}-` : ''
    const folder = `${card.universe.slug}/${partPrefix}${card.part.slug}`
    const filename = `${String(card.position).padStart(3, '0')}_${filenameForCard(card.content)}.png`
    zip.file(`${folder}/${filename}`, await renderCard(card.content))
  }

  zip.file(
    'manifest.json',
    JSON.stringify(
      {
        version: 3,
        generatedAt,
        cards: cards.map((card) => ({
          id: card.id,
          position: card.position,
          universe: card.universe,
          part: card.part,
          content: card.content,
        })),
      },
      null,
      2,
    ),
  )
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
  const stem = slugify(requestedFilename?.replace(/\.zip$/i, '') || fallbackName)
  const filename = `${stem}-${new Date().toISOString().slice(0, 10)}-${randomUUID()}.zip`
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
