import type { PrismaClient } from '@/generated/prisma/client'
import { faseActualParaPerfil, filtroElementoDisponiblePorPhaseIds } from '../domain/fases'
import { calcularRevisionMemoria, filtrarClavesValidas } from '../domain/memoriaAprendiz'

// Carga de datos de la Memoria del Aprendiz. El dominio (memoriaAprendiz.ts)
// es puro; aquí solo se hace la consulta mínima y se le pasa al filtro.
export async function cargarMemoriaAprendiz(db: PrismaClient, profileId: string) {
  const { availablePhaseIds } = await faseActualParaPerfil(db, profileId)
  const [rows, discoveries] = await Promise.all([
    db.playerCombinationStat.findMany({
      where: {
        profileId,
        attempts: { gt: 0 },
        successes: 0,
        recipeId: null,
        advanceId: null,
      },
      select: { inputKey: true, lastAttemptAt: true },
      orderBy: { inputKey: 'asc' },
    }),
    db.playerDiscovery.findMany({
      where: {
        profileId,
        element: filtroElementoDisponiblePorPhaseIds(availablePhaseIds),
      },
      select: { element: { select: { slug: true } } },
    }),
  ])

  const discoveredSlugs = new Set(discoveries.map((d) => d.element.slug))
  const failedInputKeys = filtrarClavesValidas(rows, (slug) => discoveredSlugs.has(slug))
  const latest = rows.reduce<Date | null>(
    (max, row) => (!max || row.lastAttemptAt > max ? row.lastAttemptAt : max),
    null,
  )

  return {
    revision: calcularRevisionMemoria(failedInputKeys.length, latest),
    failedInputKeys,
  }
}
