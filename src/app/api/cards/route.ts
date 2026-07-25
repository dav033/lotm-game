import { NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { CardContentSchema, PartInputSchema, UniverseInputSchema } from '@/cards/schema'
import { cardsRepository } from '@/server/cardsDb'
import { badRequest } from '@/server/apiError'

export const runtime = 'nodejs'

// Destino por defecto de las cartas que crea el editor. El MCP sigue eligiendo
// su propio universo/parte en cada lote.
const DEFAULT_UNIVERSE = { name: 'Editor' }
const DEFAULT_PART = { name: 'Borradores', number: 1 }

const CreateCardSchema = z
  .object({
    card: CardContentSchema,
    universe: UniverseInputSchema.optional(),
    part: PartInputSchema.optional(),
  })
  .strict()

export async function POST(request: Request) {
  try {
    const { card, universe, part } = CreateCardSchema.parse(await request.json())
    const [created] = cardsRepository.saveBatch({
      universe: universe ?? DEFAULT_UNIVERSE,
      part: part ?? DEFAULT_PART,
      cards: [card],
    })
    return NextResponse.json({ card: created }, { status: 201 })
  } catch (error) {
    return badRequest(error, 'No se pudo crear la carta.')
  }
}
