import { getAdvanceDefinitions } from './advances'
import { getElementDefinitions } from './elements'
import { PROGRESSION_PHASES } from './phases'
import { buildDefaultAndRequirements, buildDefaultTriggers } from './progression'
import type { SimInput } from './progression-simulator'
import { getRecipeDefinitions } from './recipes'
import { DEFAULT_RITUAL_FAILURE_OUTPUTS, getRitualDefinitions } from './rituals'
import { getSequenceDefinitions, type SequencePathways } from './sequences'

export function buildStaticSimInput(): SimInput {
  const elements = getElementDefinitions({
    mundano: 'mundano',
    conceptos: 'conceptos',
    misticismo: 'misticismo',
    beyonder: 'beyonder',
  })
  const pathways: SequencePathways = {
    vidente: { id: 'camino-del-vidente' },
    sol: { id: 'camino-del-sol' },
    puerta: { id: 'camino-de-la-puerta' },
    arbitro: { id: 'camino-del-arbitro' },
    abogado: { id: 'camino-del-abogado' },
    sleepless: { id: 'camino-del-sleepless' },
    muerte: { id: 'camino-de-la-muerte' },
    savant: { id: 'camino-del-savant' },
    mysteryPryer: { id: 'camino-del-mystery-pryer' },
    error: { id: 'camino-del-error' },
    suplicante: { id: 'camino-del-suplicante-de-secretos' },
    monstruo: { id: 'camino-del-monstruo' },
    visionario: { id: 'camino-del-visionario' },
    tirano: { id: 'camino-del-tirano' },
  }
  const sequences = getSequenceDefinitions(pathways)
  const phaseByElement = new Map<string, { sortOrder: number; isActive: boolean }>()
  for (const phase of PROGRESSION_PHASES) {
    for (const slug of phase.openingElementSlugs) {
      if (!phaseByElement.has(slug)) {
        phaseByElement.set(slug, { sortOrder: phase.sortOrder, isActive: phase.isActive })
      }
    }
  }

  return {
    elements: elements.map((element) => ({
      slug: element.slug,
      type: element.type,
      isStarter: element.isStarter ?? false,
      isActive: element.isActive ?? true,
      unlockedByType: element.unlockedByType ?? null,
      unlockedBySequenceNumber: element.unlockedBySequenceNumber ?? null,
      unlockedAtDiscoveryCount: element.unlockedAtDiscoveryCount ?? null,
      availableFromPhaseOrder: phaseByElement.get(element.slug)?.sortOrder ?? null,
      availableFromPhaseIsActive: phaseByElement.get(element.slug)?.isActive,
    })),
    recipes: getRecipeDefinitions().map((recipe) => ({
      ings: recipe.ings,
      outputs: recipe.outputs,
      isActive: recipe.isActive,
    })),
    advances: getAdvanceDefinitions().map((advance) => ({
      internalName: advance.internalName,
      ingredients: advance.ingredients.map((slug) => [slug, 1] as [string, number]),
      source: advance.source,
      target: advance.target,
      isActive: advance.isActive ?? true,
    })),
    sequences: sequences.map((sequence) => ({
      slug: sequence.slug,
      number: sequence.number,
      pathwaySlug: sequence.camino.id,
      pathwayIsActive: true,
    })),
    rituals: getRitualDefinitions().map((ritual) => ({
      name: ritual.name,
      advanceName: ritual.advanceName,
      ingredients: ritual.ingredients,
      requiredSequenceNumber: ritual.requiredSequenceNumber,
      isActive: ritual.isActive ?? true,
      failureOutputs: [...(ritual.failureOutputs ?? DEFAULT_RITUAL_FAILURE_OUTPUTS)],
    })),
    triggers: buildDefaultTriggers(),
    andRequirements: buildDefaultAndRequirements(),
    phases: PROGRESSION_PHASES.map((phase) => ({
      sortOrder: phase.sortOrder,
      unlockAtDiscoveryCount: phase.unlockAtDiscoveryCount,
      isActive: phase.isActive,
    })),
    featureGates: { ADVANCEMENT_RITUALS: 6 },
  }
}
