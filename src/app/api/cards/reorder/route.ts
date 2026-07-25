import { NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { cardsRepository } from '@/server/cardsDb'
import { badRequest } from '@/server/apiError'

export const runtime = 'nodejs'

const ReorderSchema = z
  .object({
    partId: z.uuid(),
    cardIds: z.array(z.uuid()).min(1),
  })
  .strict()

export async function POST(request: Request) {
  try {
    const { partId, cardIds } = ReorderSchema.parse(await request.json())
    return NextResponse.json({ cards: cardsRepository.reorderPart(partId, cardIds) })
  } catch (error) {
    return badRequest(error, 'No se pudo reordenar.')
  }
}
