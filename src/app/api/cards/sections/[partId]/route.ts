import { NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { cardsRepository } from '@/server/cardsDb'
import { badRequest } from '@/server/apiError'

export const runtime = 'nodejs'

const RenameSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    number: z.int().positive().nullable().optional(),
  })
  .strict()

export async function PATCH(request: Request, { params }: { params: Promise<{ partId: string }> }) {
  try {
    const { partId } = await params
    const patch = RenameSchema.parse(await request.json())
    const part = cardsRepository.renamePart(partId, patch)
    return NextResponse.json({ part })
  } catch (error) {
    return badRequest(error, 'No se pudo renombrar la seccion.')
  }
}
