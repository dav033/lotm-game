import type { Db } from '../db'
import { evaluatePhaseRule, parsePhaseRule } from '@/shared/phaseRules'

export type PhaseAvailability = {
  sortOrder: number
  isActive: boolean
}

export type ElementWithPhase = {
  isActive: boolean
  availableFromPhase: PhaseAvailability | null
}

export function phaseOrderAtDiscoveryCount(
  phases: { sortOrder: number; unlockAtDiscoveryCount: number; isActive: boolean }[],
  discoveryCount: number,
): number {
  let order = 0
  for (const phase of phases) {
    if (phase.isActive && phase.unlockAtDiscoveryCount <= discoveryCount) {
      order = Math.max(order, phase.sortOrder)
    }
  }
  return order
}

export function elementoDisponibleEnFase(
  element: ElementWithPhase,
  currentPhaseOrder: number,
): boolean {
  const phase = element.availableFromPhase
  return element.isActive && (phase === null || (phase.isActive && phase.sortOrder <= currentPhaseOrder))
}

export function elementoDisponiblePorPhaseId(
  element: { isActive: boolean; availableFromPhaseId: string | null },
  availablePhaseIds: ReadonlySet<string>,
): boolean {
  return (
    element.isActive &&
    (element.availableFromPhaseId === null || availablePhaseIds.has(element.availableFromPhaseId))
  )
}

export function filtroElementoDisponiblePorPhaseIds(availablePhaseIds: Iterable<string>) {
  return {
    isActive: true,
    OR: [
      { availableFromPhaseId: null },
      { availableFromPhaseId: { in: [...availablePhaseIds] } },
    ],
  }
}

export function resolverFasePorDescubrimientos(
  phases: {
    id: string
    sortOrder: number
    unlockAtDiscoveryCount: number
    advancementRuleJson?: string
    isActive: boolean
  }[],
  discoveries: Array<
    | string
    | null
    | { availableFromPhaseId: string | null; elementSlug: string }
  >,
) {
  const normalized = discoveries.map((discovery) =>
    typeof discovery === 'object' && discovery !== null
      ? discovery
      : { availableFromPhaseId: discovery, elementSlug: '' },
  )
  const activePhases = phases
    .filter((phase) => phase.isActive)
    .sort((left, right) => left.sortOrder - right.sortOrder)
  let sortOrder = 0
  let discoveryCount = 0
  const availablePhaseIds = new Set<string>()

  for (const phase of activePhases) {
    const availableDiscoveries = normalized.filter(
      ({ availableFromPhaseId }) =>
        availableFromPhaseId === null || availablePhaseIds.has(availableFromPhaseId),
    )
    discoveryCount = availableDiscoveries.length
    const rule = parsePhaseRule(phase.advancementRuleJson, phase.unlockAtDiscoveryCount)
    const satisfied = evaluatePhaseRule(rule, {
      discoveryCount,
      reachableElementCount: phase.unlockAtDiscoveryCount,
      discoveredElementSlugs: new Set(
        availableDiscoveries.map(({ elementSlug }) => elementSlug).filter(Boolean),
      ),
    })
    if (!satisfied) break
    sortOrder = phase.sortOrder
    availablePhaseIds.add(phase.id)
  }

  discoveryCount = normalized.filter(
    ({ availableFromPhaseId }) =>
      availableFromPhaseId === null || availablePhaseIds.has(availableFromPhaseId),
  ).length
  return { discoveryCount, sortOrder, availablePhaseIds }
}

export async function faseActualParaPerfil(db: Db, profileId: string) {
  const [discoveries, phases] = await Promise.all([
    db.playerDiscovery.findMany({
      where: { profileId, element: { isActive: true } },
      select: { element: { select: { slug: true, availableFromPhaseId: true } } },
    }),
    db.progressionPhase.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        sortOrder: true,
        unlockAtDiscoveryCount: true,
        advancementRuleJson: true,
        celebrationMessage: true,
        isActive: true,
      },
    }),
  ])
  const { discoveryCount, sortOrder, availablePhaseIds } = resolverFasePorDescubrimientos(
    phases,
    discoveries.map((discovery) => ({
      availableFromPhaseId: discovery.element.availableFromPhaseId,
      elementSlug: discovery.element.slug,
    })),
  )
  return {
    discoveryCount,
    sortOrder,
    phase: phases.find((phase) => phase.sortOrder === sortOrder) ?? null,
    phases,
    availablePhaseIds,
  }
}
