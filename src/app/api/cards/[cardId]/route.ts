import { NextResponse } from 'next/server'
import { CardContentSchema } from '@/cards/schema'
import { cardsRepository } from '@/server/cardsDb'
import { badRequest } from '@/server/apiError'

export const runtime = 'nodejs'

export async function PUT(request: Request, { params }: { params: Promise<{ cardId: string }> }) {
  try {
    const { cardId } = await params
    const body = await request.json()
    const card = CardContentSchema.parse(body.card)
    const updated = cardsRepository.updateCard(cardId, card)
    if (!updated) return NextResponse.json({ error: 'Carta no encontrada.' }, { status: 404 })
    return NextResponse.json({ card: updated })
  } catch (error) {
    return badRequest(error, 'No se pudo guardar la carta.')
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params
  const deleted = cardsRepository.deleteCards([cardId])
  if (!deleted) return NextResponse.json({ error: 'Carta no encontrada.' }, { status: 404 })
  return NextResponse.json({ deleted })
}
