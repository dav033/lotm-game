import { NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { asegurarPerfil } from '@/server/perfil'
import { toPublicAdvance, toPublicElement } from '@/server/domain/publicos'
import { obtenerLogrosPendientes, reconciliarLogros } from '@/server/domain/logros'
import { obtenerRitualesDisponibles } from '@/server/domain/rituales'

export const runtime = 'nodejs'

// Estado del jugador actual: crea el perfil (y su cookie HTTP-only) en la
// primera visita y devuelve solo los elementos ya descubiertos.
export async function GET() {
  try {
    const profile = await asegurarPerfil()
    await prisma.$transaction((tx) => reconciliarLogros(tx, profile.id))

    const [discoveries, advances, totalElementos, pendingAchievements, rituals] = await Promise.all([
      prisma.playerDiscovery.findMany({
        where: { profileId: profile.id, element: { isActive: true } },
        include: { element: true },
        orderBy: { firstDiscoveredAt: 'asc' },
      }),
      prisma.playerAdvance.findMany({
        where: { profileId: profile.id, quantity: { gt: 0 }, advance: { isActive: true } },
        include: {
          advance: {
            include: {
              ingredients: {
                include: { element: { select: { name: true } } },
                orderBy: { id: 'asc' },
              },
            },
          },
        },
        orderBy: { firstObtainedAt: 'asc' },
      }),
      prisma.element.count({ where: { isActive: true } }),
      obtenerLogrosPendientes(prisma, profile.id),
      obtenerRitualesDisponibles(prisma, profile.id),
    ])

    const elementosDescubiertos = discoveries.map((d) => ({
      ...toPublicElement(d.element),
      firstDiscoveredAt: d.firstDiscoveredAt.toISOString(),
      timesCreated: d.timesCreated,
    }))
    const avances = advances.map((owned) => ({
      ...toPublicAdvance(owned.advance),
      firstDiscoveredAt: owned.firstObtainedAt.toISOString(),
      timesCreated: owned.timesCreated,
      quantity: owned.quantity,
    }))

    return NextResponse.json({
      elementos: [...elementosDescubiertos, ...avances],
      totalElementos,
      descubiertos: elementosDescubiertos.length,
      porcentaje:
        totalElementos === 0
          ? 0
          : Math.round((elementosDescubiertos.length / totalElementos) * 100),
      pendingAchievements,
      rituals,
    })
  } catch (err) {
    console.error('[api/estado]', err)
    return NextResponse.json({ error: 'No se pudo cargar tu progreso.' }, { status: 500 })
  }
}
