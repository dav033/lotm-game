import type { PrismaClient } from '@/generated/prisma/client'
import { simulateProgression, type SimInput } from '../../../prisma/seed-content/progression-simulator'
import type { Db } from '../db'
import { parsePhaseRule, summarizePhaseRule } from '@/shared/phaseRules'
import {
  calcularBloqueadoresMinimos,
  calcularBloqueadoresRituales,
} from '../domain/bloqueadoresProgresion'
import { cargarAnalisisProgresion } from './progresion'

// availableFromPhaseId es la fuente editable. isStarter solo refleja las
// aperturas de la primera fase activa para el arranque y el simulador.
export async function sincronizarStartersConPrimeraFase(db: Db): Promise<number> {
  const primera = await db.progressionPhase.findFirst({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true },
  })

  if (!primera) {
    const result = await db.element.updateMany({
      where: { isStarter: true },
      data: { isStarter: false },
    })
    return result.count
  }

  const retirados = await db.element.updateMany({
    where: {
      isStarter: true,
      OR: [
        { availableFromPhaseId: null },
        { availableFromPhaseId: { not: primera.id } },
      ],
    },
    data: { isStarter: false },
  })
  const agregados = await db.element.updateMany({
    where: {
      isStarter: false,
      availableFromPhaseId: primera.id,
    },
    data: { isStarter: true },
  })
  return retirados.count + agregados.count
}

type EntradaPertenenciaFase = {
  id: string
  sortOrder: number
  isActive: boolean
  initialElementIds: readonly string[]
  reachableElementIds: readonly string[]
  reachableRitualIds?: readonly string[]
}

export type PertenenciaFasePorAlcance = {
  initialElementIds: string[]
  newReachableElementIds: string[]
  ownElementIds: string[]
  newReachableRitualIds: string[]
  ownRitualIds: string[]
}

// Cada elemento pertenece a la primera fase activa donde el simulador completo
// lo alcanza. Las aperturas son la única pertenencia guardada en la base de
// datos; el resto se deriva de recetas, avances, rituales y desbloqueos.
export function calcularPertenenciaFasesPorAlcance(
  phases: readonly EntradaPertenenciaFase[],
): Map<string, PertenenciaFasePorAlcance> {
  const claimed = new Set<string>()
  const claimedRituals = new Set<string>()
  const result = new Map<string, PertenenciaFasePorAlcance>()

  for (const phase of [...phases].sort((left, right) => left.sortOrder - right.sortOrder)) {
    const initialElementIds = [...new Set(phase.initialElementIds)]
    const initialIds = new Set(initialElementIds)
    const newReachableElementIds = phase.isActive
      ? phase.reachableElementIds.filter((id) => !claimed.has(id) && !initialIds.has(id))
      : []
    const ownElementIds = [...initialElementIds, ...newReachableElementIds]
    const newReachableRitualIds = phase.isActive
      ? (phase.reachableRitualIds ?? []).filter((id) => !claimedRituals.has(id))
      : []

    result.set(phase.id, {
      initialElementIds,
      newReachableElementIds,
      ownElementIds,
      newReachableRitualIds,
      ownRitualIds: newReachableRitualIds,
    })
    for (const id of ownElementIds) claimed.add(id)
    for (const id of newReachableRitualIds) claimedRituals.add(id)
  }

  return result
}

// Tamaño del cierre anterior, derivado del grafo. Ya no decide por sí solo la
// apertura: sirve como denominador autoritativo para reglas porcentuales y
// como diagnóstico. Se calcula sellando las fases posteriores.
export function calcularUmbralesDesdeSim(simInput: SimInput): Map<number, number> {
  const activas = (simInput.phases ?? [])
    .filter((phase) => phase.isActive)
    .sort((left, right) => left.sortOrder - right.sortOrder)

  const umbrales = new Map<number, number>()
  let cierreAnterior = 0
  for (let i = 0; i < activas.length; i++) {
    umbrales.set(activas[i].sortOrder, i === 0 ? 0 : cierreAnterior)
    const phases = activas.map((phase) => ({
      sortOrder: phase.sortOrder,
      isActive: true,
      unlockAtDiscoveryCount: umbrales.get(phase.sortOrder) ?? Number.MAX_SAFE_INTEGER,
    }))
    cierreAnterior = simulateProgression({ ...simInput, phases }).discovered.size
  }
  return umbrales
}

export function simularCierreHastaFase(simInput: SimInput, selectedSortOrder: number) {
  return simulateProgression({
    ...simInput,
    phases: (simInput.phases ?? []).map((phase) => ({
      ...phase,
      unlockAtDiscoveryCount:
        phase.isActive && phase.sortOrder <= selectedSortOrder
          ? 0
          : Number.MAX_SAFE_INTEGER,
    })),
  })
}

export function analizarFaseDesdeSim(simInput: SimInput, selectedSortOrder: number) {
  const phases = (simInput.phases ?? []).map((phase) =>
    phase.sortOrder <= selectedSortOrder
      ? phase
      : { ...phase, unlockAtDiscoveryCount: Number.MAX_SAFE_INTEGER },
  )
  const phaseOrder = phases.reduce(
    (current, phase) =>
      phase.isActive && phase.sortOrder <= selectedSortOrder
        ? Math.max(current, phase.sortOrder)
        : current,
    0,
  )
  const input = { ...simInput, phases }
  const base = simulateProgression(input)
  const availableSlugs = simInput.elements
    .filter((element) => {
      if (element.isActive === false) return false
      const from = element.availableFromPhaseOrder
      return (
        from === undefined ||
        from === null ||
        (element.availableFromPhaseIsActive !== false && from <= phaseOrder)
      )
    })
    .map((element) => element.slug)
    .sort()
  const available = new Set(availableSlugs)
  const reachableSlugs = [...base.discovered].sort()
  const blockersBySlug = calcularBloqueadoresMinimos(
    simInput,
    base.discovered,
    phaseOrder,
  )
  const ritualBlockersById = calcularBloqueadoresRituales(simInput, base, phaseOrder)
  const unreachableAvailableSlugs = availableSlugs.filter((slug) => !base.discovered.has(slug))

  const frontierSlugs: string[] = []
  if (phaseOrder > 0) {
    for (const candidate of simInput.elements) {
      if (
        candidate.isActive === false ||
        available.has(candidate.slug) ||
        base.discovered.has(candidate.slug)
      ) {
        continue
      }
      const result = simulateProgression({
        ...input,
        elements: input.elements.map((element) =>
          element.slug === candidate.slug
            ? {
                ...element,
                availableFromPhaseOrder: phaseOrder,
                availableFromPhaseIsActive: true,
              }
            : element,
        ),
      })
      if (result.discovered.has(candidate.slug)) frontierSlugs.push(candidate.slug)
    }
  }
  frontierSlugs.sort()

  const impactSlugsBySourceSlug: Record<string, string[]> = {}
  for (const sourceSlug of reachableSlugs) {
    const result = simulateProgression({
      ...input,
      elements: input.elements.map((element) =>
        element.slug === sourceSlug ? { ...element, isActive: false } : element,
      ),
    })
    const impacted = reachableSlugs.filter(
      (slug) => slug !== sourceSlug && !result.discovered.has(slug),
    )
    if (impacted.length > 0) impactSlugsBySourceSlug[sourceSlug] = impacted
  }

  return {
    reachableSlugs,
    blockersBySlug,
    ritualBlockersById,
    reachableRitualIds: [...base.availableRituals].sort(),
    preparedRitualIds: [...base.preparedRituals].sort(),
    availableSlugs,
    unreachableAvailableSlugs,
    frontierSlugs,
    impactSlugsBySourceSlug,
  }
}

// Recalcula y persiste el tamaño del cierre alcanzable anterior. Debe llamarse
// tras mutaciones del grafo para mantener exacto el denominador porcentual.
export async function sincronizarUmbralesFases(db: Db): Promise<void> {
  const { simInput } = await cargarAnalisisProgresion(db)
  const umbrales = calcularUmbralesDesdeSim(simInput)
  const fases = await db.progressionPhase.findMany({
    where: { isActive: true },
    select: { id: true, sortOrder: true, unlockAtDiscoveryCount: true },
  })
  for (const fase of fases) {
    const objetivo = umbrales.get(fase.sortOrder)
    if (objetivo != null && objetivo !== fase.unlockAtDiscoveryCount) {
      await db.progressionPhase.update({
        where: { id: fase.id },
        data: { unlockAtDiscoveryCount: objetivo },
      })
    }
  }
}

export type VistaFases = Awaited<ReturnType<typeof cargarVistaFases>>

export async function cargarVistaFases(db: PrismaClient) {
  const [
    { elementos, recetas, secuencias, avances, rituales, simInput },
    phases,
    caminos,
    categorias,
    featureGates,
  ] = await Promise.all([
    cargarAnalisisProgresion(db),
    db.progressionPhase.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        sortOrder: true,
        unlockAtDiscoveryCount: true,
        advancementRuleJson: true,
        celebrationMessage: true,
        isActive: true,
      },
    }),
    db.pathway.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    db.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    }),
    db.featureGate.findMany({ orderBy: { key: 'asc' } }),
  ])

  const idBySlug = new Map(elementos.map((element) => [element.slug, element.id]))
  const elementNameBySlug = new Map(elementos.map((element) => [element.slug, element.name]))
  const sequenceElementIds = new Set(secuencias.map((sequence) => sequence.elementId))
  const idsFor = (slugs: readonly string[]) =>
    slugs.flatMap((slug) => {
      const id = idBySlug.get(slug)
      return id ? [id] : []
    })
  const analyzedPhases = phases.map((phase) => {
    const analysis = analizarFaseDesdeSim(simInput, phase.sortOrder)
    const advancementRule = parsePhaseRule(
      phase.advancementRuleJson,
      phase.unlockAtDiscoveryCount,
    )
    const phaseData = {
      id: phase.id,
      slug: phase.slug,
      name: phase.name,
      description: phase.description,
      sortOrder: phase.sortOrder,
      unlockAtDiscoveryCount: phase.unlockAtDiscoveryCount,
      celebrationMessage: phase.celebrationMessage,
      isActive: phase.isActive,
    }
    return {
      phase: {
        ...phaseData,
        advancementRule,
        advancementRuleSummary: summarizePhaseRule(advancementRule, elementNameBySlug),
      },
      analysis,
      reachableElementIds: idsFor(analysis.reachableSlugs),
      reachableRitualIds: analysis.reachableRitualIds,
      initialElementIds: elementos
        .filter((element) => element.availableFromPhaseId === phaseData.id)
        .map((element) => element.id),
    }
  })
  const pertenenciaPorFase = calcularPertenenciaFasesPorAlcance(
    analyzedPhases.map(({ phase, reachableElementIds, reachableRitualIds, initialElementIds }) => ({
      id: phase.id,
      sortOrder: phase.sortOrder,
      isActive: phase.isActive,
      initialElementIds,
      reachableElementIds,
      reachableRitualIds,
    })),
  )
  const phaseViews = analyzedPhases.map(({ phase, analysis, reachableElementIds, reachableRitualIds }) => {
    const pertenencia = pertenenciaPorFase.get(phase.id)!
    const impactElementIdsBySourceId: Record<string, string[]> = {}
    const blockersByElementId: Record<string, {
      elementIds: string[]
      conditions: string[]
      steps: number | null
    }> = {}
    const ritualBlockersById: Record<string, {
      elementIds: string[]
      conditions: string[]
      steps: number | null
    }> = {}
    for (const [sourceSlug, impactedSlugs] of Object.entries(analysis.impactSlugsBySourceSlug)) {
      const sourceId = idBySlug.get(sourceSlug)
      if (sourceId) impactElementIdsBySourceId[sourceId] = idsFor(impactedSlugs)
    }
    for (const [targetSlug, blockers] of Object.entries(analysis.blockersBySlug)) {
      const targetId = idBySlug.get(targetSlug)
      if (!targetId) continue
      blockersByElementId[targetId] = {
        elementIds: idsFor(blockers.elementSlugs),
        conditions: blockers.conditions,
        steps: blockers.steps,
      }
    }
    for (const [ritualId, blockers] of Object.entries(analysis.ritualBlockersById)) {
      ritualBlockersById[ritualId] = {
        elementIds: idsFor(blockers.elementSlugs),
        conditions: blockers.conditions,
        steps: blockers.steps,
      }
    }
    return {
      ...phase,
      reachableElementIds,
      reachableRitualIds,
      preparedRitualIds: analysis.preparedRitualIds,
      availableElementIds: idsFor(analysis.availableSlugs),
      unreachableAvailableElementIds: idsFor(analysis.unreachableAvailableSlugs),
      frontierElementIds: idsFor(analysis.frontierSlugs),
      impactElementIdsBySourceId,
      blockersByElementId,
      ritualBlockersById,
      ...pertenencia,
    }
  })

  return {
    phases: phaseViews,
    featureGates,
    caminos,
    categorias,
    recipeOutputElementIds: [...new Set(
      recetas.flatMap((recipe) => recipe.outputs.map((output) => output.elementId)),
    )],
    elements: elementos
      .map((element) => ({
        id: element.id,
        slug: element.slug,
        name: element.name,
        description: element.description,
        iconKey: element.iconKey,
        type: element.type,
        isBeyonderSequence:
          element.type === 'BEYONDER' && sequenceElementIds.has(element.id),
         tier: element.tier,
         isStarter: element.isStarter,
         isActive: element.isActive,
        unlockedAtDiscoveryCount: element.unlockedAtDiscoveryCount,
        requiredElementIds: element.unlockRequirements.map(
          (requirement) => requirement.requiredElementId,
        ),
        availableFromPhaseId: element.availableFromPhaseId,
         availableFromPhaseOrder: element.availableFromPhase?.sortOrder ?? null,
         availableFromPhaseIsActive: element.availableFromPhase?.isActive,
      }))
      .sort((left, right) => left.name.localeCompare(right.name, 'es')),
    // Se incluyen también las recetas inactivas: la vista de fases permite
    // bloquearlas/desbloquearlas y necesita verlas en ambos estados.
    recipes: recetas.map((recipe) => ({
      id: recipe.id,
      name: recipe.name ?? '',
      inputKey: recipe.inputKey,
      isActive: recipe.isActive,
      successText: recipe.successText ?? '',
      hintText: recipe.hintText ?? '',
      ingredientes: recipe.ingredients.map((ingredient) => ({
        elementId: ingredient.elementId,
        quantity: ingredient.quantity,
      })),
      outputs: [...recipe.outputs]
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((output) => ({
          elementId: output.elementId,
          quantity: output.quantity,
          chance: output.chance,
          sortOrder: output.sortOrder,
        })),
      // Expandido por cantidad: una autocombinación (Tiempo ×2) aparece como
      // dos entradas, para que la fórmula se muestre completa.
      ingredientElementIds: recipe.ingredients.flatMap((ingredient) =>
        Array<string>(ingredient.quantity).fill(ingredient.elementId),
      ),
      outputElementIds: recipe.outputs
        .filter((output) => output.element.isActive)
        .map((output) => output.elementId),
    })),
    advances: avances
      .map((advance) => ({
        id: advance.id,
        internalName: advance.internalName,
        isActive: advance.isActive,
        sourceElementId: advance.sourceSequence.elementId,
        targetElementId: advance.targetSequence.elementId,
        sourceSequenceNumber: advance.sourceSequence.number,
        targetSequenceNumber: advance.targetSequence.number,
        ingredientElementIds: advance.ingredients.flatMap((ingredient) =>
          Array<string>(ingredient.quantity).fill(ingredient.elementId),
        ),
      }))
      .sort((left, right) =>
        left.targetSequenceNumber - right.targetSequenceNumber ||
        left.internalName.localeCompare(right.internalName, 'es'),
      ),
    rituals: rituales
      .map((ritual) => {
        const advance = avances.find((item) => item.id === ritual.advanceId)!
        return {
          id: ritual.id,
          name: ritual.name,
          inputKey: ritual.inputKey,
          isActive: ritual.isActive,
          requiredSequenceNumber: ritual.requiredSequenceNumber,
          advanceId: ritual.advanceId,
          advanceName: ritual.advance.internalName,
          advanceIsActive: advance.isActive,
          sourceElementId: advance.sourceSequence.elementId,
          targetElementId: advance.targetSequence.elementId,
          ingredientElementIds: ritual.ingredients.flatMap((ingredient) =>
            Array<string>(ingredient.quantity).fill(ingredient.elementId),
          ),
          failureOutputElementIds: ritual.failureOutputs.map((output) => output.elementId),
        }
      })
      .sort((left, right) => left.name.localeCompare(right.name, 'es')),
  }
}
