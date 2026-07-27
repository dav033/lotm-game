import { NextResponse } from 'next/server'
import { cardsRepository } from '@/server/cardsDb'
import { badRequest } from '@/server/apiError'

export const runtime = 'nodejs'

// Solo desengancha la imagen del proyecto. El archivo se queda en disco a
// proposito: puede seguir usandolo el fondo de una carta.
export async function DELETE(_request: Request, context: { params: Promise<{ imageId: string }> }) {
  try {
    const { imageId } = await context.params
    if (!cardsRepository.deleteImage(imageId)) {
      return NextResponse.json({ error: 'La imagen no existe.' }, { status: 404 })
    }
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return badRequest(error, 'No se pudo borrar la imagen.')
  }
}
