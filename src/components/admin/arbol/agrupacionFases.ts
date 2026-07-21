export type FaseAgrupable = {
  id: string
  ownElementIds: readonly string[]
}

export type ElementoAgrupable = {
  id: string
}

export type ContenidoBloqueable = {
  id: string
  kind: 'elemento' | 'ritual'
  blockerIds: readonly string[]
  targetElementId?: string
  fallbackGroup: string
}

export type GrupoContenidoBloqueado<T extends ContenidoBloqueable> = {
  key: string
  blockerIds: string[]
  fallbackGroup: string | null
  items: T[]
}

export type OrdenBloqueos = 'cercanos' | 'lejanos'

export type PrioridadBloqueo = {
  missingCount: number
  distance: number | null
}

export function compararCercaniaBloqueo(
  left: PrioridadBloqueo,
  right: PrioridadBloqueo,
  order: OrdenBloqueos,
): number {
  const leftUnknown = left.distance === null ? 1 : 0
  const rightUnknown = right.distance === null ? 1 : 0
  const comparison =
    leftUnknown - rightUnknown ||
    left.missingCount - right.missingCount ||
    (left.distance ?? 0) - (right.distance ?? 0)
  return order === 'cercanos' ? comparison : -comparison
}

type CandidatoInicial = ElementoAgrupable & {
  isBeyonderSequence?: boolean
}

export function filtrarCandidatosIniciales<T extends CandidatoInicial>(
  elements: readonly T[],
  initialElementIds: readonly string[],
  recipeOutputElementIds: readonly string[],
): T[] {
  const initialIds = new Set(initialElementIds)
  const recipeOutputIds = new Set(recipeOutputElementIds)
  return elements.filter(
    (element) =>
      !element.isBeyonderSequence &&
      !initialIds.has(element.id) &&
      !recipeOutputIds.has(element.id),
  )
}

export function agruparElementosDeFase<T extends ElementoAgrupable>(
  elements: readonly T[],
  phase: FaseAgrupable,
  phases: readonly FaseAgrupable[],
) {
  const phaseElementIds = new Set(phase.ownElementIds)
  const ownedElementIds = new Set(phases.flatMap((item) => item.ownElementIds))

  return {
    phaseElements: elements.filter((element) => phaseElementIds.has(element.id)),
    poolElements: elements.filter((element) => !ownedElementIds.has(element.id)),
  }
}

export function agruparContenidoPorBloqueadores<T extends ContenidoBloqueable>(
  items: readonly T[],
): GrupoContenidoBloqueado<T>[] {
  const groups = new Map<string, GrupoContenidoBloqueado<T>>()

  for (const item of items) {
    const blockerIds = [...new Set(
      item.blockerIds.filter((id) => id !== item.targetElementId),
    )].sort()
    const key = blockerIds.length > 0
      ? `bloqueadores:${blockerIds.join('|')}`
      : `motivo:${item.fallbackGroup}`
    const group = groups.get(key)
    if (group) {
      group.items.push(item)
    } else {
      groups.set(key, {
        key,
        blockerIds,
        fallbackGroup: blockerIds.length > 0 ? null : item.fallbackGroup,
        items: [item],
      })
    }
  }

  return [...groups.values()]
}
