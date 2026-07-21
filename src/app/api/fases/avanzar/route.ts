import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/server/db'
import { asegurarPerfil } from '@/server/perfil'
import { completarFaseActual, CompletePhaseError } from '@/server/services/completarFase'

export const runtime = 'nodejs'

const schema = z.object({
  expectedPhaseSlug: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
})

export async function POST(request: Request) {
  try {
    const profile = await asegurarPerfil()
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Petición inválida.' }, { status: 400 })
    return NextResponse.json(
      await completarFaseActual(prisma, profile.id, parsed.data.expectedPhaseSlug),
    )
  } catch (error) {
    if (error instanceof CompletePhaseError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      )
    }
    console.error('[api/fases/avanzar]', error)
    return NextResponse.json({ error: 'No se pudo completar la fase.' }, { status: 500 })
  }
}
