import type { PrismaClient } from '../../src/generated/prisma/client'
import { combinarParaPerfil } from '../../src/server/domain/combinar'
import { descubrirIniciales } from '../../src/server/domain/descubrimientos'
import { advanceToken } from '../../src/server/domain/publicos'
import { realizarRitual } from '../../src/server/domain/rituales'

export type RuntimeReplayStep = {
  action: string
  addedElements: string[]
  addedPathways: string[]
  addedSequences: string[]
  preparedAdvances: string[]
}

export type RuntimeReplayResult = {
  elements: Set<string>
  pathways: Set<string>
  sequences: Set<string>
  preparedAdvances: Set<string>
  ownedAdvances: Set<string>
  rituals: Set<string>
  trace: RuntimeReplayStep[]
}

async function snapshot(db: PrismaClient, profileId: string): Promise<RuntimeReplayResult> {
  const [discoveries, pathways, ownedAdvances, preparedAdvanceStats, rituals] = await Promise.all([
    db.playerDiscovery.findMany({
      where: { profileId, element: { isActive: true } },
      select: {
        element: {
          select: {
            slug: true,
            sequence: { select: { element: { select: { slug: true } } } },
          },
        },
      },
    }),
    db.playerPathwayUnlock.findMany({
      where: { profileId, pathway: { isActive: true } },
      select: { pathway: { select: { slug: true } } },
    }),
    db.playerAdvance.findMany({
      where: { profileId, quantity: { gt: 0 }, advance: { isActive: true } },
      select: { advance: { select: { internalName: true } } },
    }),
    db.playerCombinationStat.findMany({
      where: { profileId, successes: { gt: 0 }, advanceId: { not: null } },
      select: { inputKey: true, advance: { select: { inputKey: true, internalName: true } } },
    }),
    db.playerRitual.findMany({
      where: { profileId, ritual: { isActive: true } },
      select: { ritual: { select: { name: true } } },
    }),
  ])
  return {
    elements: new Set(discoveries.map((discovery) => discovery.element.slug)),
    pathways: new Set(pathways.map((unlock) => unlock.pathway.slug)),
    sequences: new Set(
      discoveries.flatMap((discovery) =>
        discovery.element.sequence ? [discovery.element.sequence.element.slug] : [],
      ),
    ),
    preparedAdvances: new Set(
      preparedAdvanceStats.flatMap((stat) =>
        stat.advance && stat.inputKey === stat.advance.inputKey
          ? [stat.advance.internalName]
          : [],
      ),
    ),
    ownedAdvances: new Set(ownedAdvances.map((owned) => owned.advance.internalName)),
    rituals: new Set(rituals.map((owned) => owned.ritual.name)),
    trace: [],
  }
}

function difference(after: Set<string>, before: Set<string>): string[] {
  return [...after].filter((value) => !before.has(value)).sort()
}

function sameSet(left: Set<string>, right: Set<string>): boolean {
  return left.size === right.size && [...left].every((value) => right.has(value))
}

export async function createRuntimeReplayProfile(db: PrismaClient): Promise<string> {
  const profile = await db.playerProfile.create({ data: {} })
  await descubrirIniciales(db, profile.id)
  return profile.id
}

export async function replayRuntimeProgression(
  db: PrismaClient,
  profileId: string,
): Promise<RuntimeReplayResult> {
  const trace: RuntimeReplayStep[] = []

  for (let iteration = 0; iteration < 1_000; iteration++) {
    const beforeRound = await snapshot(db, profileId)
    const discovered = beforeRound.elements
    let acted = false

    const recipes = await db.recipe.findMany({
      where: { isActive: true },
      select: {
        inputKey: true,
        ingredients: {
          select: { quantity: true, element: { select: { slug: true, isActive: true } } },
        },
        outputs: { select: { element: { select: { slug: true, isActive: true } } } },
      },
      orderBy: { inputKey: 'asc' },
    })
    const advances = await db.advance.findMany({
      where: { isActive: true },
      select: {
        id: true,
        internalName: true,
        inputKey: true,
        ingredients: {
          select: { quantity: true, element: { select: { slug: true, isActive: true } } },
        },
        sourceSequence: {
          select: {
            element: { select: { slug: true, isActive: true } },
            pathway: { select: { isActive: true } },
          },
        },
        targetSequence: {
          select: {
            element: { select: { slug: true, isActive: true } },
            pathway: { select: { isActive: true } },
          },
        },
        rituals: { where: { isActive: true }, select: { id: true } },
      },
      orderBy: { inputKey: 'asc' },
    })
    const advanceByKey = new Map(advances.map((advance) => [advance.inputKey, advance]))
    const recipeByKey = new Map(recipes.map((recipe) => [recipe.inputKey, recipe]))
    const formulaKeys = [...new Set([...recipeByKey.keys(), ...advanceByKey.keys()])].sort()

    for (const inputKey of formulaKeys) {
      const recipe = recipeByKey.get(inputKey)
      const advance = advanceByKey.get(inputKey)
      const ingredients = recipe?.ingredients ?? advance?.ingredients ?? []
      if (
        ingredients.reduce((sum, ingredient) => sum + ingredient.quantity, 0) !== 2 ||
        !ingredients.every(
          (ingredient) => ingredient.element.isActive && discovered.has(ingredient.element.slug),
        )
      ) continue

      const recipeNeeded = Boolean(
        recipe?.outputs.some(
          (output) => output.element.isActive && !discovered.has(output.element.slug),
        ),
      )
      const advanceNeeded = Boolean(
        advance &&
          advance.sourceSequence.element.isActive &&
          advance.sourceSequence.pathway.isActive &&
          advance.targetSequence.element.isActive &&
          advance.targetSequence.pathway.isActive &&
          !discovered.has(advance.targetSequence.element.slug) &&
          !beforeRound.ownedAdvances.has(advance.internalName),
      )
      if (!recipeNeeded && !advanceNeeded) continue

      const slugs = ingredients.flatMap((ingredient) =>
        Array<string>(ingredient.quantity).fill(ingredient.element.slug),
      ) as [string, string]
      const before = await snapshot(db, profileId)
      await combinarParaPerfil(db, profileId, slugs)
      const after = await snapshot(db, profileId)
      trace.push({
        action: inputKey,
        addedElements: difference(after.elements, before.elements),
        addedPathways: difference(after.pathways, before.pathways),
        addedSequences: difference(after.sequences, before.sequences),
        preparedAdvances: difference(after.preparedAdvances, before.preparedAdvances),
      })
      acted = true
    }

    const afterFormulas = await snapshot(db, profileId)
    if (afterFormulas.elements.has('ritual')) {
      const rituals = await db.ritual.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          ingredients: {
            select: { element: { select: { slug: true, isActive: true } } },
          },
          advance: {
            select: {
              isActive: true,
              sourceSequence: {
                select: {
                  element: { select: { slug: true, isActive: true } },
                  pathway: { select: { isActive: true } },
                },
              },
              targetSequence: {
                select: {
                  element: { select: { slug: true, isActive: true } },
                  pathway: { select: { isActive: true } },
                },
              },
            },
          },
          players: { where: { profileId }, select: { profileId: true } },
        },
        orderBy: { name: 'asc' },
      })
      for (const ritual of rituals) {
        if (ritual.players.length > 0) continue
        const { sourceSequence, targetSequence } = ritual.advance
        if (
          !ritual.advance.isActive ||
          !sourceSequence.element.isActive ||
          !sourceSequence.pathway.isActive ||
          !targetSequence.element.isActive ||
          !targetSequence.pathway.isActive ||
          !afterFormulas.elements.has(sourceSequence.element.slug) ||
          afterFormulas.elements.has(targetSequence.element.slug) ||
          !ritual.ingredients.every(
            (ingredient) =>
              ingredient.element.isActive && afterFormulas.elements.has(ingredient.element.slug),
          )
        ) continue
        const before = await snapshot(db, profileId)
        await realizarRitual(db, profileId, ritual.id)
        const after = await snapshot(db, profileId)
        trace.push({
          action: `ritual:${ritual.name}`,
          addedElements: difference(after.elements, before.elements),
          addedPathways: difference(after.pathways, before.pathways),
          addedSequences: difference(after.sequences, before.sequences),
          preparedAdvances: difference(after.preparedAdvances, before.preparedAdvances),
        })
        acted = true
      }
    }

    const ownedAdvances = await db.playerAdvance.findMany({
      where: { profileId, quantity: { gt: 0 }, advance: { isActive: true } },
      select: {
        advance: {
          select: {
            id: true,
            internalName: true,
            sourceSequence: { select: { element: { select: { slug: true } } } },
            targetSequence: { select: { element: { select: { slug: true } } } },
            rituals: {
              where: { isActive: true },
              select: {
                id: true,
                players: { where: { profileId }, select: { profileId: true } },
              },
            },
          },
        },
      },
      orderBy: { advance: { inputKey: 'asc' } },
    })
    for (const owned of ownedAdvances) {
      const advance = owned.advance
      if (
        advance.rituals.length > 0 &&
        !advance.rituals.some((ritual) => ritual.players.length > 0)
      ) continue
      if (
        !discovered.has(advance.sourceSequence.element.slug) ||
        discovered.has(advance.targetSequence.element.slug)
      ) continue
      const before = await snapshot(db, profileId)
      await combinarParaPerfil(db, profileId, [
        advanceToken(advance.id),
        advance.sourceSequence.element.slug,
      ])
      const after = await snapshot(db, profileId)
      trace.push({
        action: `apply:${advance.internalName}`,
        addedElements: difference(after.elements, before.elements),
        addedPathways: difference(after.pathways, before.pathways),
        addedSequences: difference(after.sequences, before.sequences),
        preparedAdvances: difference(after.preparedAdvances, before.preparedAdvances),
      })
      acted = true
    }

    const afterRound = await snapshot(db, profileId)
    const stateChanged =
      !sameSet(afterRound.elements, beforeRound.elements) ||
      !sameSet(afterRound.pathways, beforeRound.pathways) ||
      !sameSet(afterRound.preparedAdvances, beforeRound.preparedAdvances) ||
      !sameSet(afterRound.ownedAdvances, beforeRound.ownedAdvances) ||
      !sameSet(afterRound.rituals, beforeRound.rituals)
    if (!acted || !stateChanged) {
      afterRound.trace = trace
      return afterRound
    }
  }

  throw new Error('El replay del runtime no alcanzó un punto fijo en 1.000 rondas.')
}
