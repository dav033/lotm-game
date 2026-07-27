import { NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { cardsRepository } from '@/server/cardsDb'
import { badRequest } from '@/server/apiError'
import { MAX_CARD_DURATION, MIN_CARD_DURATION } from '@/cards/repository'

export const runtime = 'nodejs'

// `seconds: null` borra la excepcion y devuelve el elemento a la duracion
// global que se elige al exportar.
const DurationSchema = z
  .object({
    kind: z.enum(['card', 'image']),
    id: z.uuid(),
    seconds: z.number().min(MIN_CARD_DURATION).max(MAX_CARD_DURATION).nullable(),
  })
  .strict()

export async function PATCH(request: Request) {
  try {
    const { kind, id, seconds } = DurationSchema.parse(await request.json())
    if (kind === 'card') {
      const card = cardsRepository.setCardDuration(id, seconds)
      if (!card) return NextResponse.json({ error: 'Carta no encontrada.' }, { status: 404 })
      return NextResponse.json({ card })
    }
    const image = cardsRepository.setImageDuration(id, seconds)
    if (!image) return NextResponse.json({ error: 'Imagen no encontrada.' }, { status: 404 })
    return NextResponse.json({ image })
  } catch (error) {
    return badRequest(error, 'No se pudo cambiar la duracion.')
  }
}
