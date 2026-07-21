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
import {
  elementoDisponiblePorPhaseId,
  faseActualParaPerfil,
  filtroElementoDisponiblePorPhaseIds,
} from '../domain/fases'
import { featuresParaFase } from '../domain/featureGates'

// Carga de datos del sistema de facultades. El dominio (habilidades.ts) es
// puro; aquí solo se construye el snapshot con consultas mínimas y sin N+1.

const SLUGS_FACULTAD = ABILITY_KEYS.map((key) => ABILITY_DEFINITIONS[key].requiredElementSlug)

// Facultades del perfil: deriva de los elementos ACTIVOS descubiertos con los
// slugs requeridos. Consulta deliberadamente mínima (solo slugs).
export async function resolverFacultades(
  db: PrismaClient,
  profileId: string,
): Promise<PlayerAbilities> {
  const { availablePhaseIds } = await faseActualParaPerfil(db, profileId)
  const availableElementFilter = filtroElementoDisponiblePorPhaseIds(availablePhaseIds)
  const descubrimientos = await db.playerDiscovery.findMany({
    where: {
      profileId,
      element: {
        ...availableElementFilter,
        slug: { in: SLUGS_FACULTAD },
      },
    },
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
  const phaseState = await faseActualParaPerfil(db, profileId)
  const { availablePhaseIds } = phaseState
  const features = await featuresParaFase(db, phaseState.sortOrder)
  const availableElementFilter = filtroElementoDisponiblePorPhaseIds(availablePhaseIds)
  const [descubrimientos, resueltas, recetas, avances, avancesPropios, ritualesPropios] =
    await db.$transaction([
      db.playerDiscovery.findMany({
        where: {
          profileId,
          element: availableElementFilter,
        },
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
              element: { select: { isActive: true, availableFromPhaseId: true } },
            },
          },
          outputs: {
            select: {
              element: {
                select: {
                  isActive: true,
                  availableFromPhaseId: true,
                  sequence: {
                    select: {
                      pathway: { select: { isActive: true } },
                      advancesTo: {
                        where: { isActive: true },
                        select: {
                          sourceSequence: {
                            select: {
                              element: { select: { isActive: true, availableFromPhaseId: true } },
                              pathway: { select: { isActive: true } },
                            },
                          },
                        },
                      },
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
              element: { select: { isActive: true, availableFromPhaseId: true } },
            },
          },
          sourceSequence: {
            select: {
              elementId: true,
              element: { select: { isActive: true, availableFromPhaseId: true } },
              pathway: { select: { isActive: true } },
            },
          },
          targetSequence: {
            select: {
              elementId: true,
              element: { select: { isActive: true, availableFromPhaseId: true } },
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
      ingredientesActivos: receta.ingredients.every((i) =>
        elementoDisponiblePorPhaseId(i.element, availablePhaseIds),
      ),
      // Misma regla que el resolvedor: al menos una salida activa y no
      // protegida por un avance que apunte a esa secuencia.
      salidasValidas: receta.outputs.some(
        (output) =>
          elementoDisponiblePorPhaseId(output.element, availablePhaseIds) &&
          salidaRecetaEjecutable(output),
      ),
    })
  }

  const aplicaciones: AplicacionAvancePotencial[] = []
  const propiosIds = new Set(avancesPropios.map((a) => a.advanceId))
  const ritualesCumplidos = new Set(ritualesPropios.map((r) => r.ritualId))

  for (const avance of avances) {
    const activeRituals = avance.rituals.filter((ritual) => ritual.isActive)
    formulas.push({
      actionKey: avance.inputKey,
      ingredientElementIds: [...new Set(avance.ingredients.map((i) => i.elementId))],
      totalUnidades: avance.ingredients.reduce((suma, i) => suma + i.quantity, 0),
      activa: avance.isActive,
      ingredientesActivos: avance.ingredients.every((i) =>
        elementoDisponiblePorPhaseId(i.element, availablePhaseIds),
      ),
      // Creación de avance válida cuando ambos caminos están activos (la
      // misma comprobación que hace combinar.ts al crearlo).
      salidasValidas:
        avanceCreableAhora(avance) &&
        elementoDisponiblePorPhaseId(avance.sourceSequence.element, availablePhaseIds) &&
        elementoDisponiblePorPhaseId(avance.targetSequence.element, availablePhaseIds),
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
      ) &&
        elementoDisponiblePorPhaseId(avance.sourceSequence.element, availablePhaseIds) &&
        elementoDisponiblePorPhaseId(avance.targetSequence.element, availablePhaseIds),
      // Regla idéntica a combinar.ts: sin rituales activos, o al menos uno
      // ya preparado por el perfil.
      ritualSatisfecho: (activeRituals.length === 0 || features.ADVANCEMENT_RITUALS) && ritualesPermitenAplicacion(
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
