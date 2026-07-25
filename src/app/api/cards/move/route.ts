import { NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { PartInputSchema, UniverseInputSchema } from '@/cards/schema'
import { cardsRepository } from '@/server/cardsDb'
import { badRequest } from '@/server/apiError'

export const runtime = 'nodejs'

// Mueve cartas a otra seccion desde el editor, con la misma semantica que la
// herramienta move_cards del MCP: la seccion se crea si no existe.
const MoveSchema = z
  .object({
    cardIds: z.array(z.uuid()).min(1).max(100),
    universe: UniverseInputSchema.optional(),
    part: PartInputSchema,
  })
  .strict()

export async function POST(request: Request) {
  try {
    const { cardIds, ...target } = MoveSchema.parse(await request.json())
    return NextResponse.json({ cards: cardsRepository.moveCards(cardIds, target) })
  } catch (error) {
    return badRequest(error, 'No se pudieron mover las cartas.')
  }
}
