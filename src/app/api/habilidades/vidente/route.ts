import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/server/db'
import { asegurarPerfil } from '@/server/perfil'
import { calcularPotencialPorElemento, resultadoVidentePublico } from '@/server/domain/habilidades'
import { cargarSnapshotPotencial, resolverFacultades } from '@/server/services/habilidades'

export const runtime = 'nodejs'

const bodySchema = z.object({
  elementId: z.string().trim().min(1).max(80),
})

// Adivinación del Vidente: recuento exacto de combinaciones pendientes que el
// perfil puede ejecutar ahora con un elemento descubierto. Solo lectura:
// jamás escribe estadísticas ni toca el progreso.
export async function POST(req: Request) {
  try {
    const profile = await asegurarPerfil()
    const json = await req.json().catch(() => null)
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Petición inválida.' }, { status: 400 })
    }

    // El servidor es la autoridad: la facultad se recalcula aquí, nunca se
    // acepta un "unlocked" del cliente.
    const abilities = await resolverFacultades(prisma, profile.id)
    if (!abilities.seer.unlocked) {
      return NextResponse.json(
        { error: 'Aún no has despertado esta facultad.' },
        { status: 403 },
      )
    }

    const element = await prisma.element.findUnique({
      where: { id: parsed.data.elementId },
      select: { id: true, isActive: true },
    })
    // Sin filtrar existencia real: 404 genérico para inexistente o inactivo.
    if (!element || !element.isActive) {
      return NextResponse.json({ error: 'Ese elemento no está en el archivo.' }, { status: 404 })
    }

    const descubrimiento = await prisma.playerDiscovery.findUnique({
      where: { profileId_elementId: { profileId: profile.id, elementId: element.id } },
      select: { elementId: true },
    })
    if (!descubrimiento) {
      return NextResponse.json(
        { error: 'Solo puedes analizar elementos que ya has descubierto.' },
        { status: 422 },
      )
    }

    const snapshot = await cargarSnapshotPotencial(prisma, profile.id)
    const conteos = calcularPotencialPorElemento(snapshot)
    return NextResponse.json(
      resultadoVidentePublico(element.id, conteos.get(element.id) ?? 0),
    )
  } catch (err) {
    console.error('[api/habilidades/vidente]', err)
    return NextResponse.json(
      { error: 'La adivinación no responde. Inténtalo de nuevo.' },
      { status: 500 },
    )
  }
}
