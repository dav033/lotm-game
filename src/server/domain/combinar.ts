import type { PrismaClient } from '@/generated/prisma/client'
import type { Db } from '../db'
import { desbloquearEspontaneos } from './descubrimientos'
import { buildRecipeInputKey } from './inputKey'
import { concederLogrosPorElementos } from './logros'
import {
  elementoDisponiblePorPhaseId,
  faseActualParaPerfil,
  filtroElementoDisponiblePorPhaseIds,
} from './fases'
import { advanceIdFromToken, sequenceLabelOf, toPublicAdvance, toPublicElement } from './publicos'
import {
  aplicacionAvanceTieneContenidoActivo,
  avanceCreableAhora,
  decidirAplicacionRitual,
  salidaRecetaEjecutable,
} from './reglasCombinacion'
import {
  MENSAJE_SIN_RECETA,
  type CombineResult,
  type PathwayReveal,
  type RecipeOutputData,
} from './tipos'
import { RITUAL_KNOWLEDGE_ELEMENT_SLUG } from './ritualKnowledge'
import { featuresParaFase } from './featureGates'

// Error de reglas del juego: su mensaje sí es apto para mostrarse al jugador.
export class CombinationError extends Error {}

// Reconstruye la ruta de categorías (raíz → hoja) subiendo por los padres.
export async function categoryPathOf(db: Db, categoryId: string): Promise<string[]> {
  const names: string[] = []
  let current: string | null = categoryId
  for (let depth = 0; current && depth < 10; depth++) {
    const cat: { name: string; parentId: string | null } | null =
      await db.category.findUnique({
        where: { id: current },
        select: { name: true, parentId: true },
      })
    if (!cat) break
    names.unshift(cat.name)
    current = cat.parentId
  }
  return names
}

async function combinarAvanceConSecuencia(
  db: PrismaClient,
  profileId: string,
  slugs: [string, string],
  advanceIndex: number,
  confirmRitualRisk: boolean,
  availablePhaseIds: ReadonlySet<string>,
  advancementRitualsEnabled: boolean,
): Promise<CombineResult> {
  const advanceToken = slugs[advanceIndex]
  const advanceId = advanceIdFromToken(advanceToken)
  const sequenceSlug = slugs[advanceIndex === 0 ? 1 : 0]
  if (!advanceId || advanceIdFromToken(sequenceSlug)) {
    throw new CombinationError('Solo puedes combinar un avance con una secuencia.')
  }

  return db.$transaction(async (tx) => {
  const [advance, sequenceElement, owned, ritualKnowledge] = await Promise.all([
    tx.advance.findUnique({
      where: { id: advanceId },
      include: {
        ingredients: {
          include: { element: { select: { name: true } } },
          orderBy: { id: 'asc' },
        },
        sourceSequence: { include: { element: true, pathway: true } },
        targetSequence: {
          include: {
            element: {
              include: {
                discoveries: { where: { profileId }, select: { profileId: true } },
              },
            },
            pathway: true,
          },
        },
        rituals: {
          include: {
            players: { where: { profileId }, select: { profileId: true } },
            failureOutputs: {
              include: {
                element: { include: { sequence: { include: { pathway: true } } } },
              },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    }),
    tx.element.findUnique({
      where: { slug: sequenceSlug },
      include: {
        discoveries: { where: { profileId }, select: { profileId: true } },
      },
    }),
    tx.playerAdvance.findUnique({
      where: { profileId_advanceId: { profileId, advanceId } },
    }),
    tx.playerDiscovery.findFirst({
      where: {
        profileId,
        element: {
          slug: RITUAL_KNOWLEDGE_ELEMENT_SLUG,
          ...filtroElementoDisponiblePorPhaseIds(availablePhaseIds),
        },
      },
      select: { elementId: true },
    }),
  ])

  if (!advance || !advance.isActive || !owned || owned.quantity < 1) {
    throw new CombinationError('No posees ese avance o ya no está disponible.')
  }
  if (!sequenceElement || !elementoDisponiblePorPhaseId(sequenceElement, availablePhaseIds)) {
    throw new CombinationError('La secuencia seleccionada no está disponible.')
  }

  if (sequenceElement.discoveries.length === 0) {
    throw new CombinationError('Aún no has descubierto esa secuencia.')
  }

  const inputKey = buildRecipeInputKey([
    { slug: advanceToken, quantity: 1 },
    { slug: sequenceSlug, quantity: 1 },
  ])
  const isValid =
    aplicacionAvanceTieneContenidoActivo(advance, sequenceElement.id) &&
    elementoDisponiblePorPhaseId(advance.sourceSequence.element, availablePhaseIds) &&
    elementoDisponiblePorPhaseId(advance.targetSequence.element, availablePhaseIds) &&
    advance.targetSequence.element.discoveries.length === 0
  const activeRituals = advance.rituals.filter((ritual) => ritual.isActive)
  if (isValid && activeRituals.length > 0 && !advancementRitualsEnabled) {
    throw new CombinationError('Los rituales de avance aún no están disponibles.')
  }
  const ritualDecision = isValid
    ? decidirAplicacionRitual(
        advance.rituals.map((ritual) => ({
          isActive: ritual.isActive,
          preparado: ritual.players.length > 0,
        })),
        ritualKnowledge !== null,
        confirmRitualRisk,
      )
    : 'ALLOW'
  if (ritualDecision === 'KNOWLEDGE_REQUIRED') {
    return {
      kind: 'RITUAL_KNOWLEDGE_REQUIRED',
      message:
        'El avance responde, pero no comprendes la preparación necesaria para aplicarlo con seguridad.',
    }
  }
  if (ritualDecision === 'PREPARATION_REQUIRED') {
    return {
      kind: 'RITUAL_PREPARATION_REQUIRED',
      confirmationRequired: true,
      message: 'Esta ascensión no está protegida. Intentarla puede tener consecuencias.',
    }
  }
  if (confirmRitualRisk && !isValid) {
    return {
      kind: 'RESOLVED',
      success: false,
      message: 'La ascensión ya no puede intentarse en estas condiciones.',
      inputKey,
      results: [],
      isNewPathwayUnlock: false,
      pathwayReveal: null,
      consumedSlugs: [],
      unlockedAchievements: [],
    }
  }
  const missingRitual = ritualDecision === 'CONFIRMED_UNPROTECTED_FAILURE'
  const now = new Date()

    await tx.playerProfile.update({ where: { id: profileId }, data: { lastSeenAt: now } })
    await tx.playerCombinationStat.upsert({
      where: { profileId_inputKey: { profileId, inputKey } },
      create: {
        profileId,
        inputKey,
        advanceId: advance.id,
        attempts: 1,
        successes: isValid && !missingRitual ? 1 : 0,
        firstAttemptAt: now,
        lastAttemptAt: now,
      },
      update: {
        attempts: { increment: 1 },
        successes: isValid && !missingRitual ? { increment: 1 } : undefined,
        advanceId: advance.id,
        lastAttemptAt: now,
      },
    })

    if (!isValid) {
      return {
        kind: 'RESOLVED',
        success: false,
        message: 'El avance no reconoce esa secuencia.',
        inputKey,
        results: [],
        isNewPathwayUnlock: false,
        pathwayReveal: null,
        consumedSlugs: [],
        unlockedAchievements: [],
      } satisfies CombineResult
    }

    if (missingRitual) {
      const results: RecipeOutputData[] = []
      const consequences = new Map(
        activeRituals
          .flatMap((ritual) => ritual.failureOutputs)
          .filter(
            (consequence) =>
              elementoDisponiblePorPhaseId(consequence.element, availablePhaseIds) &&
              (!consequence.element.sequence || consequence.element.sequence.pathway.isActive),
          )
          .map((consequence) => [consequence.elementId, consequence]),
      )
      for (const consequence of consequences.values()) {
        const previous = await tx.playerDiscovery.findUnique({
          where: {
            profileId_elementId: { profileId, elementId: consequence.elementId },
          },
        })
        if (!previous) {
          await tx.playerDiscovery.create({
            data: {
              profileId,
              elementId: consequence.elementId,
              firstDiscoveredAt: now,
              lastCreatedAt: now,
            },
          })
        }
        results.push({
          element: toPublicElement(consequence.element),
          quantity: 1,
          isNewDiscovery: !previous,
        })
        const sequence = consequence.element.sequence
        if (sequence) {
          await tx.playerPathwayUnlock.upsert({
            where: {
              profileId_pathwayId: { profileId, pathwayId: sequence.pathwayId },
            },
            create: { profileId, pathwayId: sequence.pathwayId, unlockedAt: now },
            update: {},
          })
        }
      }
      const spontaneous = await desbloquearEspontaneos(
        tx,
        profileId,
        results.map((result) => ({ id: result.element.id, type: result.element.type })),
        now,
      )
      for (const element of spontaneous) {
        results.push({ element: toPublicElement(element), quantity: 1, isNewDiscovery: true })
      }
      const unlockedAchievements = await concederLogrosPorElementos(
        tx,
        profileId,
        results.map((result) => result.element.id),
        now,
      )
      return {
        kind: 'RESOLVED',
        success: false,
        message: 'El avance fracasa: falta preparar el ritual correspondiente.',
        inputKey,
        results,
        isNewPathwayUnlock: false,
        pathwayReveal: null,
        consumedSlugs: [],
        unlockedAchievements,
      } satisfies CombineResult
    }

    if (owned.quantity === 1) {
      await tx.playerAdvance.delete({
        where: { profileId_advanceId: { profileId, advanceId: advance.id } },
      })
    } else {
      await tx.playerAdvance.update({
        where: { profileId_advanceId: { profileId, advanceId: advance.id } },
        data: { quantity: { decrement: 1 } },
      })
    }

    const target = advance.targetSequence.element
    const previous = await tx.playerDiscovery.findUnique({
      where: { profileId_elementId: { profileId, elementId: target.id } },
    })
    const isNewDiscovery = !previous
    if (previous) {
      await tx.playerDiscovery.update({
        where: { profileId_elementId: { profileId, elementId: target.id } },
        data: { timesCreated: { increment: 1 }, lastCreatedAt: now },
      })
    } else {
      await tx.playerDiscovery.create({
        data: { profileId, elementId: target.id, firstDiscoveredAt: now, lastCreatedAt: now },
      })
    }

    const pathway = advance.targetSequence.pathway
    const existingUnlock = await tx.playerPathwayUnlock.findUnique({
      where: { profileId_pathwayId: { profileId, pathwayId: pathway.id } },
    })
    let isNewPathwayUnlock = false
    if (!existingUnlock) {
      await tx.playerPathwayUnlock.create({
        data: { profileId, pathwayId: pathway.id, unlockedAt: now },
      })
      isNewPathwayUnlock = true
    }

    const pathwayReveal: PathwayReveal | null = isNewDiscovery
      ? {
          categoryPath: await categoryPathOf(tx, pathway.categoryId),
          pathwayName: pathway.name,
          sequenceNumber: advance.targetSequence.number,
          sequenceName: advance.targetSequence.name,
          title: target.revealTitle ?? 'El avance se completa',
          text: target.revealText ?? 'Una nueva secuencia se abre ante ti.',
        }
      : null
    const results: RecipeOutputData[] = [
      {
        element: {
          ...toPublicElement(target),
          sequenceLabel: sequenceLabelOf(advance.targetSequence),
        },
        quantity: 1,
        isNewDiscovery,
      },
    ]
    const desbloqueados = await desbloquearEspontaneos(
      tx,
      profileId,
      [{ id: target.id, type: target.type }],
      now,
    )
    for (const element of desbloqueados) {
      results.push({ element: toPublicElement(element), quantity: 1, isNewDiscovery: true })
    }
    const unlockedAchievements = await concederLogrosPorElementos(
      tx,
      profileId,
      results.filter((result) => result.element.kind === 'ELEMENT').map((result) => result.element.id),
      now,
    )

    return {
      kind: 'RESOLVED',
      success: true,
      message: isNewDiscovery
        ? `Has descubierto la secuencia ${advance.targetSequence.name}.`
        : `${advance.targetSequence.name} vuelve a revelarse.`,
      inputKey,
      results,
      isNewPathwayUnlock,
      pathwayReveal,
      consumedSlugs: [advanceToken],
      unlockedAchievements,
    } satisfies CombineResult
  })
}

/**
 * Servicio central de combinación. Los elementos NO se consumen: representan
 * conceptos reutilizables. Todo lo que debe persistirse junto se ejecuta en
 * una única transacción.
 *
 * @param slugs exactamente dos slugs (puede repetirse el mismo: Ojo + Ojo).
 */
export async function combinarParaPerfil(
  db: PrismaClient,
  profileId: string,
  slugs: [string, string],
  options: { confirmRitualRisk?: boolean } = {},
): Promise<CombineResult> {
  if (slugs.length !== 2) {
    throw new CombinationError('Debes colocar exactamente dos elementos.')
  }
  const phaseState = await faseActualParaPerfil(db, profileId)
  const { availablePhaseIds } = phaseState

  const advanceIndexes = slugs
    .map((slug, index) => (advanceIdFromToken(slug) ? index : -1))
    .filter((index) => index >= 0)
  if (advanceIndexes.length > 0) {
    if (advanceIndexes.length !== 1) {
      throw new CombinationError('Solo puedes combinar un avance con una secuencia.')
    }
    const features = await featuresParaFase(db, phaseState.sortOrder)
    return combinarAvanceConSecuencia(
      db,
      profileId,
      slugs,
      advanceIndexes[0],
      options.confirmRitualRisk ?? false,
      availablePhaseIds,
      features.ADVANCEMENT_RITUALS,
    )
  }

  const uniqueSlugs = [...new Set(slugs)]
  const elements = await db.element.findMany({
    where: { slug: { in: uniqueSlugs } },
    include: {
      discoveries: { where: { profileId }, select: { profileId: true } },
    },
  })

  if (elements.length !== uniqueSlugs.length) {
    throw new CombinationError('Alguno de los elementos no existe en el archivo.')
  }
  if (elements.some((element) => !elementoDisponiblePorPhaseId(element, availablePhaseIds))) {
    throw new CombinationError('Alguno de los elementos no está disponible.')
  }

  // El jugador solo puede usar lo que ya descubrió: se verifica SIEMPRE en el
  // servidor, sin confiar en lo que el navegador afirme.
  if (elements.some((element) => element.discoveries.length === 0)) {
    throw new CombinationError('Aún no has descubierto ese elemento.')
  }

  const inputKey = buildRecipeInputKey(slugs.map((s) => ({ slug: s, quantity: 1 })))

  const [found, foundAdvance] = await Promise.all([
    db.recipe.findFirst({
      where: { inputKey, isActive: true },
      include: {
        outputs: {
          include: {
            element: {
              include: {
                sequence: {
                  include: {
                    pathway: true,
                    advancesTo: {
                      where: { isActive: true },
                      select: {
                        sourceSequence: {
                          select: {
                            element: { select: { isActive: true } },
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
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
      },
    }),
    db.advance.findUnique({
      where: { inputKey },
      include: {
        ingredients: {
          include: { element: { select: { name: true, isActive: true, availableFromPhaseId: true } } },
          orderBy: { id: 'asc' },
        },
        sourceSequence: {
          include: { pathway: true, element: { select: { isActive: true, availableFromPhaseId: true } } },
        },
        targetSequence: {
          include: { pathway: true, element: { select: { isActive: true, availableFromPhaseId: true } } },
        },
      },
    }),
  ])

  const advance =
    foundAdvance &&
    avanceCreableAhora(foundAdvance) &&
    foundAdvance.ingredients.every((ingredient) =>
      elementoDisponiblePorPhaseId(ingredient.element, availablePhaseIds),
    ) &&
    elementoDisponiblePorPhaseId(foundAdvance.sourceSequence.element, availablePhaseIds) &&
    elementoDisponiblePorPhaseId(foundAdvance.targetSequence.element, availablePhaseIds)
      ? foundAdvance
      : null

  // Una receta sin resultados activos y disponibles en la fase actual se
  // comporta como inexistente.
  const recipeOutputs = found
    ? found.outputs.filter(
        (output) =>
          elementoDisponiblePorPhaseId(output.element, availablePhaseIds) &&
          salidaRecetaEjecutable(output),
      )
    : []
  const recipe = recipeOutputs.length > 0 ? found : null
  const now = new Date()

  return db.$transaction(async (tx) => {
    await tx.playerProfile.update({
      where: { id: profileId },
      data: { lastSeenAt: now },
    })

    // Estadística agregada por (perfil, inputKey): una fila por combinación,
    // nunca una fila por clic.
    await tx.playerCombinationStat.upsert({
      where: { profileId_inputKey: { profileId, inputKey } },
      create: {
        profileId,
        inputKey,
        recipeId: recipe?.id ?? null,
        advanceId: advance?.id ?? null,
        attempts: 1,
        successes: recipe || advance ? 1 : 0,
        firstAttemptAt: now,
        lastAttemptAt: now,
      },
      update: {
        attempts: { increment: 1 },
        successes: recipe || advance ? { increment: 1 } : undefined,
        lastAttemptAt: now,
        // Si la receta se creó después de los primeros intentos fallidos,
        // la estadística queda vinculada a partir de ahora.
        recipeId: recipe ? recipe.id : undefined,
        advanceId: advance ? advance.id : undefined,
      },
    })

    let advanceResult: RecipeOutputData | null = null
    if (advance) {
      const previous = await tx.playerAdvance.findUnique({
        where: { profileId_advanceId: { profileId, advanceId: advance.id } },
      })
      await tx.playerAdvance.upsert({
        where: { profileId_advanceId: { profileId, advanceId: advance.id } },
        create: {
          profileId,
          advanceId: advance.id,
          quantity: 1,
          firstObtainedAt: now,
          lastObtainedAt: now,
        },
        update: {
          quantity: { increment: 1 },
          timesCreated: { increment: 1 },
          lastObtainedAt: now,
        },
      })
      advanceResult = {
        element: toPublicAdvance(advance),
        quantity: 1,
        isNewDiscovery: !previous,
      }
    }

    if (!recipe || recipeOutputs.length === 0) {
      if (advanceResult) {
        return {
          kind: 'RESOLVED',
          success: true,
          message: 'Has obtenido un avance desconocido.',
          inputKey,
          results: [advanceResult],
          isNewPathwayUnlock: false,
          pathwayReveal: null,
          consumedSlugs: [],
          unlockedAchievements: [],
          // Formar un avance a partir de dos Elementos normales también
          // cuenta como un resultado genuino para la Memoria del Aprendiz.
          memoryDelta: { inputKey, status: 'RESOLVED' },
        } satisfies CombineResult
      }
      return {
        kind: 'RESOLVED',
        success: false,
        message: MENSAJE_SIN_RECETA,
        inputKey,
        results: [],
        isNewPathwayUnlock: false,
        pathwayReveal: null,
        consumedSlugs: [],
        unlockedAchievements: [],
        // NO_RECIPE genuino entre dos Elementos normales: la única ruta que
        // alimenta la Memoria del Aprendiz con un intento fallido.
        memoryDelta: { inputKey, status: 'FAILED' },
      } satisfies CombineResult
    }

    // Procesar cada resultado de la receta
    const results: RecipeOutputData[] = advanceResult ? [advanceResult] : []
    let isNewPathwayUnlock = false
    let pathwayReveal: PathwayReveal | null = null

    for (const ro of recipeOutputs) {
      const output = ro.element
      const previous = await tx.playerDiscovery.findUnique({
        where: { profileId_elementId: { profileId, elementId: output.id } },
      })
      const isNewDiscovery = !previous
      if (previous) {
        await tx.playerDiscovery.update({
          where: { profileId_elementId: { profileId, elementId: output.id } },
          data: { timesCreated: { increment: 1 }, lastCreatedAt: now },
        })
      } else {
        await tx.playerDiscovery.create({
          data: { profileId, elementId: output.id, firstDiscoveredAt: now, lastCreatedAt: now },
        })
      }

      // ¿El resultado representa una secuencia de un camino aún sellado?
      const seq = output.sequence
      if (seq && seq.pathway.isActive) {
        const existingUnlock = await tx.playerPathwayUnlock.findUnique({
          where: { profileId_pathwayId: { profileId, pathwayId: seq.pathwayId } },
        })
        if (!existingUnlock) {
          await tx.playerPathwayUnlock.create({
            data: { profileId, pathwayId: seq.pathwayId, unlockedAt: now },
          })
          isNewPathwayUnlock = true
          if (!pathwayReveal) {
            pathwayReveal = {
              categoryPath: await categoryPathOf(tx, seq.pathway.categoryId),
              pathwayName: seq.pathway.name,
              sequenceNumber: seq.number,
              sequenceName: seq.name,
              title: output.revealTitle ?? 'Un velo se descorre',
              text: output.revealText ?? 'Has traspasado la frontera de lo mundano.',
            }
          }
        }
      }

      results.push({
        element: { ...toPublicElement(output), sequenceLabel: sequenceLabelOf(seq) },
        quantity: ro.quantity,
        isNewDiscovery,
      })
    }

    // Descubrimientos espontáneos: conceptos que se revelan al producir
    // elementos de cierto tipo o elementos concretos. Se dispara con todos los
    // resultados (no solo los nuevos) para que una regla añadida después
    // también llegue a los jugadores.
    const craftedElements = results.filter((result) => result.element.kind === 'ELEMENT')
    const desbloqueados = await desbloquearEspontaneos(
      tx,
      profileId,
      craftedElements.map((result) => ({ id: result.element.id, type: result.element.type })),
      now,
    )
    for (const el of desbloqueados) {
      results.push({ element: toPublicElement(el), quantity: 1, isNewDiscovery: true })
    }
    const unlockedAchievements = await concederLogrosPorElementos(
      tx,
      profileId,
      results.filter((result) => result.element.kind === 'ELEMENT').map((result) => result.element.id),
      now,
    )

    // Construir mensaje basado en los descubrimientos
    const newDiscoveries = results.filter(
      (result) => result.element.kind === 'ELEMENT' && result.isNewDiscovery,
    )
    let message: string
    if (advanceResult) {
      message =
        newDiscoveries.length > 0
          ? `Has obtenido un avance desconocido y descubierto ${newDiscoveries.map((result) => result.element.name).join(', ')}.`
          : 'Has obtenido un avance desconocido.'
    } else if (newDiscoveries.length === 0) {
      const names = craftedElements.map((result) => result.element.name).join(' y ')
      message = `${names} vuelve a formarse entre tus manos.`
    } else if (newDiscoveries.length === 1) {
      message = `Has descubierto ${newDiscoveries[0].element.name}.`
    } else {
      const names = newDiscoveries.map((d) => d.element.name).join(', ')
      message = `Has descubierto ${names}.`
    }

    return {
      kind: 'RESOLVED',
      success: true,
      message,
      inputKey,
      results,
      isNewPathwayUnlock,
      pathwayReveal,
      consumedSlugs: [],
      unlockedAchievements,
      memoryDelta: { inputKey, status: 'RESOLVED' },
    } satisfies CombineResult
  })
}
