import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/server/db'
import { asegurarPerfil } from '@/server/perfil'
import { realizarRitual, RitualError } from '@/server/domain/rituales'

export const runtime = 'nodejs'

const schema = z.object({ ritualId: z.string().trim().min(1).max(100) })

export async function POST(request: Request) {
  try {
    const profile = await asegurarPerfil()
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Petición inválida.' }, { status: 400 })
    return NextResponse.json(
      await prisma.$transaction((tx) => realizarRitual(tx, profile.id, parsed.data.ritualId)),
    )
  } catch (error) {
    if (error instanceof RitualError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      )
    }
    console.error('[api/rituales/realizar]', error)
    return NextResponse.json({ error: 'El ritual no pudo completarse.' }, { status: 500 })
  }
}
