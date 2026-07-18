import type { PrismaClient } from '@/generated/prisma/client'
import {
  ABILITY_KEYS,
  ABILITY_DEFINITIONS,
  facultadesDesdeSlugs,
  type AplicacionAvancePotencial,
  type FormulaPotencial,
  type PlayerAbilities,
  type SnapshotPotencial,
} from '../domain/habilidades'
import {
  aplicacionAvanceTieneContenidoActivo,
  avanceCreableAhora,
  ritualesPermitenAplicacion,
  salidaRecetaEjecutable,
} from '../domain/reglasCombinacion'

// Carga de datos del sistema de facultades. El dominio (habilidades.ts) es
// puro; aquí solo se construye el snapshot con consultas mínimas y sin N+1.

const SLUGS_FACULTAD = ABILITY_KEYS.map((key) => ABILITY_DEFINITIONS[key].requiredElementSlug)

// Facultades del perfil: deriva de los elementos ACTIVOS descubiertos con los
// slugs requeridos. Consulta deliberadamente mínima (solo slugs).
export async function resolverFacultades(
  db: PrismaClient,
  profileId: string,
): Promise<PlayerAbilities> {
  const descubrimientos = await db.playerDiscovery.findMany({
    where: { profileId, element: { isActive: true, slug: { in: SLUGS_FACULTAD } } },
    select: { element: { select: { slug: true } } },
  })
  return facultadesDesdeSlugs(new Set(descubrimientos.map((d) => d.element.slug)))
}

// Snapshot completo del potencial actual del perfil: descubrimientos activos,
// inputKeys ya resueltas con éxito, fórmulas candidatas (recetas y creación
// de avances) y aplicaciones de avances poseídos. Las REGLAS de validez se
// trasladan como banderas fieles al resolvedor real (combinar.ts); la decisión
// final la toma el cálculo puro del dominio.
export async function cargarSnapshotPotencial(
  db: PrismaClient,
  profileId: string,
): Promise<SnapshotPotencial> {
  const [descubrimientos, resueltas, recetas, avances, avancesPropios, ritualesPropios] =
    await db.$transaction([
      db.playerDiscovery.findMany({
        where: { profileId, element: { isActive: true } },
        select: { elementId: true },
      }),
      db.playerCombinationStat.findMany({
        where: { profileId, successes: { gt: 0 } },
        select: { inputKey: true },
      }),
      db.recipe.findMany({
        select: {
          inputKey: true,
          isActive: true,
          ingredients: {
            select: {
              elementId: true,
              quantity: true,
              element: { select: { isActive: true } },
            },
          },
          outputs: {
            select: {
              element: {
                select: {
                  isActive: true,
                  sequence: {
                    select: {
                      advancesTo: { where: { isActive: true }, select: { id: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      db.advance.findMany({
        select: {
          id: true,
          inputKey: true,
          isActive: true,
          ingredients: {
            select: {
              elementId: true,
              quantity: true,
              element: { select: { isActive: true } },
            },
          },
          sourceSequence: {
            select: { elementId: true, pathway: { select: { isActive: true } } },
          },
          targetSequence: {
            select: {
              elementId: true,
              element: { select: { isActive: true } },
              pathway: { select: { isActive: true } },
            },
          },
          rituals: { select: { id: true, isActive: true } },
        },
      }),
      db.playerAdvance.findMany({
        where: { profileId, quantity: { gt: 0 } },
        select: { advanceId: true },
      }),
      db.playerRitual.findMany({ where: { profileId }, select: { ritualId: true } }),
    ])

  const formulas: FormulaPotencial[] = []

  for (const receta of recetas) {
    formulas.push({
      actionKey: receta.inputKey,
      ingredientElementIds: [...new Set(receta.ingredients.map((i) => i.elementId))],
      totalUnidades: receta.ingredients.reduce((suma, i) => suma + i.quantity, 0),
      activa: receta.isActive,
      ingredientesActivos: receta.ingredients.every((i) => i.element.isActive),
      // Misma regla que el resolvedor: al menos una salida activa y no
      // protegida por un avance que apunte a esa secuencia.
      salidasValidas: receta.outputs.some(salidaRecetaEjecutable),
    })
  }

  const aplicaciones: AplicacionAvancePotencial[] = []
  const propiosIds = new Set(avancesPropios.map((a) => a.advanceId))
  const ritualesCumplidos = new Set(ritualesPropios.map((r) => r.ritualId))

  for (const avance of avances) {
    formulas.push({
      actionKey: avance.inputKey,
      ingredientElementIds: [...new Set(avance.ingredients.map((i) => i.elementId))],
      totalUnidades: avance.ingredients.reduce((suma, i) => suma + i.quantity, 0),
      activa: avance.isActive,
      ingredientesActivos: avance.ingredients.every((i) => i.element.isActive),
      // Creación de avance válida cuando ambos caminos están activos (la
      // misma comprobación que hace combinar.ts al crearlo).
      salidasValidas: avanceCreableAhora(avance),
    })

    aplicaciones.push({
      actionKey: `advance-application:${avance.id}`,
      sourceElementId: avance.sourceSequence.elementId,
      targetElementId: avance.targetSequence.elementId,
      owned: propiosIds.has(avance.id),
      advanceActivo: avance.isActive,
      contenidoActivo: aplicacionAvanceTieneContenidoActivo(
        avance,
        avance.sourceSequence.elementId,
      ),
      // Regla idéntica a combinar.ts: sin rituales activos, o al menos uno
      // ya preparado por el perfil.
      ritualSatisfecho: ritualesPermitenAplicacion(
        avance.rituals.map((ritual) => ({
          isActive: ritual.isActive,
          preparado: ritualesCumplidos.has(ritual.id),
        })),
      ),
    })
  }

  return {
    discoveredElementIds: new Set(descubrimientos.map((d) => d.elementId)),
    resolvedInputKeys: new Set(resueltas.map((r) => r.inputKey)),
    formulas,
    aplicaciones,
  }
}
