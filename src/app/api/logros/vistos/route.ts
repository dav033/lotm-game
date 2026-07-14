import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/server/db'
import { asegurarPerfil } from '@/server/perfil'
import { marcarLogrosNotificados } from '@/server/domain/logros'

export const runtime = 'nodejs'

const schema = z.object({ achievementIds: z.array(z.string().min(1)).min(1).max(20) })

export async function POST(request: Request) {
  try {
    const profile = await asegurarPerfil()
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Petición inválida.' }, { status: 400 })
    }
    await marcarLogrosNotificados(prisma, profile.id, parsed.data.achievementIds)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[api/logros/vistos]', error)
    return NextResponse.json({ error: 'No se pudo registrar el aviso.' }, { status: 500 })
  }
}
