import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/server/db'
import { asegurarPerfil } from '@/server/perfil'
import { combinarParaPerfil, CombinationError } from '@/server/domain/combinar'

// SQLite vive en el proceso de Node; nada de edge runtime aquí.
export const runtime = 'nodejs'

const bodySchema = z.object({
  // Exactamente dos unidades. Puede repetirse el mismo slug (Ojo + Ojo).
  elementos: z.tuple([
    z.string().trim().min(1).max(80),
    z.string().trim().min(1).max(80),
  ]),
  confirmRitualRisk: z.boolean().optional().default(false),
})

export async function POST(req: Request) {
  try {
    const profile = await asegurarPerfil()
    const json = await req.json().catch(() => null)
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Petición inválida.' }, { status: 400 })
    }
    const result = await combinarParaPerfil(prisma, profile.id, parsed.data.elementos, {
      confirmRitualRisk: parsed.data.confirmRitualRisk,
    })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof CombinationError) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    console.error('[api/combine]', err)
    return NextResponse.json(
      { error: 'El archivo guarda silencio. Inténtalo de nuevo.' },
      { status: 500 },
    )
  }
}
