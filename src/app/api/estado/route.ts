import { NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { asegurarPerfil } from '@/server/perfil'
import { sequenceLabelOf, toPublicAdvance, toPublicElement } from '@/server/domain/publicos'
import { obtenerLogrosPendientes, reconciliarLogros } from '@/server/domain/logros'
import { obtenerEstadoRitual } from '@/server/domain/rituales'
import { facultadesDesdeSlugs } from '@/server/domain/habilidades'

export const runtime = 'nodejs'

// Estado del jugador actual: crea el perfil (y su cookie HTTP-only) en la
// primera visita y devuelve solo los elementos ya descubiertos.
export async function GET() {
  try {
    const profile = await asegurarPerfil()
    await prisma.$transaction((tx) => reconciliarLogros(tx, profile.id))

    const [discoveries, advances, totalElementos, pendingAchievements, ritualState] = await Promise.all([
      prisma.playerDiscovery.findMany({
        where: { profileId: profile.id, element: { isActive: true } },
        include: { element: { include: { sequence: { include: { pathway: true } } } } },
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
              sourceSequence: { include: { pathway: true } },
            },
          },
        },
        orderBy: { firstObtainedAt: 'asc' },
      }),
      prisma.element.count({ where: { isActive: true } }),
      obtenerLogrosPendientes(prisma, profile.id),
      obtenerEstadoRitual(prisma, profile.id),
    ])

    const elementosDescubiertos = discoveries.map((d) => ({
      ...toPublicElement(d.element),
      sequenceLabel: sequenceLabelOf(d.element.sequence),
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
      ritualState,
      // Solo metadatos de desbloqueo de facultades; los recuentos de
      // potencial se calculan aparte, bajo demanda de cada facultad.
      abilities: facultadesDesdeSlugs(new Set(discoveries.map((d) => d.element.slug))),
    })
  } catch (err) {
    console.error('[api/estado]', err)
    return NextResponse.json({ error: 'No se pudo cargar tu progreso.' }, { status: 500 })
  }
}
