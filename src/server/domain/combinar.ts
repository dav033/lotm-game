import type { PrismaClient } from '@/generated/prisma/client'
import type { Db } from '../db'
import { desbloquearEspontaneos } from './descubrimientos'
import { buildRecipeInputKey } from './inputKey'
import { concederLogrosPorElementos } from './logros'
import { advanceIdFromToken, sequenceLabelOf, toPublicAdvance, toPublicElement } from './publicos'
import {
  MENSAJE_SIN_RECETA,
  type CombineResult,
  type PathwayReveal,
  type RecipeOutputData,
} from './tipos'

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
): Promise<CombineResult> {
  const advanceToken = slugs[advanceIndex]
  const advanceId = advanceIdFromToken(advanceToken)
  const sequenceSlug = slugs[advanceIndex === 0 ? 1 : 0]
  if (!advanceId || advanceIdFromToken(sequenceSlug)) {
    throw new CombinationError('Solo puedes combinar un avance con una secuencia.')
  }

  const [advance, sequenceElement, owned] = await Promise.all([
    db.advance.findUnique({
      where: { id: advanceId },
      include: {
        ingredients: {
          include: { element: { select: { name: true } } },
          orderBy: { id: 'asc' },
        },
        sourceSequence: { include: { element: true, pathway: true } },
        targetSequence: { include: { element: true, pathway: true } },
        rituals: {
          include: {
            players: { where: { profileId }, select: { profileId: true } },
            failureOutputs: { include: { element: true } },
          },
          orderBy: { id: 'asc' },
        },
      },
    }),
    db.element.findUnique({ where: { slug: sequenceSlug } }),
    db.playerAdvance.findUnique({
      where: { profileId_advanceId: { profileId, advanceId } },
    }),
  ])

  if (!advance || !advance.isActive || !owned || owned.quantity < 1) {
    throw new CombinationError('No posees ese avance o ya no está disponible.')
  }
  if (!sequenceElement?.isActive) {
    throw new CombinationError('La secuencia seleccionada no está disponible.')
  }

  const discoveredSequence = await db.playerDiscovery.findUnique({
    where: {
      profileId_elementId: { profileId, elementId: sequenceElement.id },
    },
  })
  if (!discoveredSequence) {
    throw new CombinationError('Aún no has descubierto esa secuencia.')
  }

  const inputKey = buildRecipeInputKey([
    { slug: advanceToken, quantity: 1 },
    { slug: sequenceSlug, quantity: 1 },
  ])
  const isValid =
    sequenceElement.id === advance.sourceSequence.elementId &&
    advance.sourceSequence.pathway.isActive &&
    advance.targetSequence.pathway.isActive &&
    advance.targetSequence.element.isActive
  const activeRituals = advance.rituals.filter((ritual) => ritual.isActive)
  const missingRitual =
    isValid && activeRituals.length > 0 && activeRituals.every((ritual) => ritual.players.length === 0)
  const now = new Date()

  return db.$transaction(async (tx) => {
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
): Promise<CombineResult> {
  if (slugs.length !== 2) {
    throw new CombinationError('Debes colocar exactamente dos elementos.')
  }

  const advanceIndexes = slugs
    .map((slug, index) => (advanceIdFromToken(slug) ? index : -1))
    .filter((index) => index >= 0)
  if (advanceIndexes.length > 0) {
    if (advanceIndexes.length !== 1) {
      throw new CombinationError('Solo puedes combinar un avance con una secuencia.')
    }
    return combinarAvanceConSecuencia(db, profileId, slugs, advanceIndexes[0])
  }

  const uniqueSlugs = [...new Set(slugs)]
  const elements = await db.element.findMany({
    where: { slug: { in: uniqueSlugs } },
  })

  if (elements.length !== uniqueSlugs.length) {
    throw new CombinationError('Alguno de los elementos no existe en el archivo.')
  }
  if (elements.some((e) => !e.isActive)) {
    throw new CombinationError('Alguno de los elementos no está disponible.')
  }

  // El jugador solo puede usar lo que ya descubrió: se verifica SIEMPRE en el
  // servidor, sin confiar en lo que el navegador afirme.
  const discovered = await db.playerDiscovery.findMany({
    where: { profileId, elementId: { in: elements.map((e) => e.id) } },
    select: { elementId: true },
  })
  if (discovered.length !== elements.length) {
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
                    advancesTo: { where: { isActive: true }, select: { id: true } },
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
          include: { element: { select: { name: true } } },
          orderBy: { id: 'asc' },
        },
        sourceSequence: { include: { pathway: true } },
        targetSequence: { include: { pathway: true } },
      },
    }),
  ])

  const advance =
    foundAdvance?.isActive &&
    foundAdvance.sourceSequence.pathway.isActive &&
    foundAdvance.targetSequence.pathway.isActive
      ? foundAdvance
      : null

  // Una receta cuyos todos los resultados están desactivados se comporta como inexistente.
  const recipeOutputs =
    found?.outputs.filter(
      (output) =>
        output.element.isActive && (output.element.sequence?.advancesTo.length ?? 0) === 0,
    ) ?? []
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
          success: true,
          message: 'Has obtenido un avance desconocido.',
          inputKey,
          results: [advanceResult],
          isNewPathwayUnlock: false,
          pathwayReveal: null,
          consumedSlugs: [],
          unlockedAchievements: [],
        } satisfies CombineResult
      }
      return {
        success: false,
        message: MENSAJE_SIN_RECETA,
        inputKey,
        results: [],
        isNewPathwayUnlock: false,
        pathwayReveal: null,
        consumedSlugs: [],
        unlockedAchievements: [],
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
      if (seq && seq.pathway.isActive && !isNewPathwayUnlock) {
        const existingUnlock = await tx.playerPathwayUnlock.findUnique({
          where: { profileId_pathwayId: { profileId, pathwayId: seq.pathwayId } },
        })
        if (!existingUnlock) {
          await tx.playerPathwayUnlock.create({
            data: { profileId, pathwayId: seq.pathwayId, unlockedAt: now },
          })
          isNewPathwayUnlock = true
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
      success: true,
      message,
      inputKey,
      results,
      isNewPathwayUnlock,
      pathwayReveal,
      consumedSlugs: [],
      unlockedAchievements,
    } satisfies CombineResult
  })
}
