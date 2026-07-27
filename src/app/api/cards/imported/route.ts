import { NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { cardsRepository } from '@/server/cardsDb'
import { badRequest } from '@/server/apiError'
import { storeCardImage } from '@/cards/images'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ReorderSchema = z
  .object({ universeId: z.uuid(), imageIds: z.array(z.uuid()).min(1) })
  .strict()

export async function GET(request: Request) {
  const universeId = new URL(request.url).searchParams.get('universeId') ?? undefined
  return NextResponse.json(
    { images: cardsRepository.listImages(universeId) },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

// Sube los binarios y los cuelga del proyecto de una vez. Se importan tal cual:
// no se convierten en carta ni se editan despues.
export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const universeId = String(form.get('universeId') ?? '')
    if (!universeId) throw new Error('Falta el proyecto de destino.')

    const files = form.getAll('files').filter((value): value is File => value instanceof File)
    if (!files.length) throw new Error('No se recibio ninguna imagen.')
    const rejected = files.filter((file) => !file.type.startsWith('image/'))
    if (rejected.length) {
      throw new Error(`Solo se admiten imagenes: ${rejected.map((file) => file.name).join(', ')}`)
    }

    const stored = await Promise.all(
      files.map(async (file) => ({
        url: await storeCardImage(new Uint8Array(await file.arrayBuffer()), file.type),
        name: file.name,
      })),
    )
    return NextResponse.json(
      { images: cardsRepository.addImages(universeId, stored) },
      { status: 201 },
    )
  } catch (error) {
    return badRequest(error, 'No se pudieron importar las imagenes.')
  }
}

export async function PATCH(request: Request) {
  try {
    const { universeId, imageIds } = ReorderSchema.parse(await request.json())
    return NextResponse.json({ images: cardsRepository.reorderImages(universeId, imageIds) })
  } catch (error) {
    return badRequest(error, 'No se pudieron reordenar las imagenes.')
  }
}
