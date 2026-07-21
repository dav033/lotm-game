// Predicados puros compartidos por el resolvedor real y el analizador de
// potencial. Mantener estas reglas aquí evita que el Vidente anuncie una
// acción que combinar.ts rechazaría después.

export function salidaRecetaEjecutable(output: {
  element: {
    isActive: boolean
    sequence?: {
      pathway: { isActive: boolean }
      advancesTo: {
        sourceSequence: { element: { isActive: boolean }; pathway: { isActive: boolean } }
      }[]
    } | null
  }
}): boolean {
  if (!output.element.isActive) return false
  const sequence = output.element.sequence
  if (!sequence) return true
  if (!sequence.pathway.isActive) return false
  return !sequence.advancesTo.some(
    (advance) =>
      advance.sourceSequence.element.isActive && advance.sourceSequence.pathway.isActive,
  )
}

export function avanceCreableAhora(advance: {
  isActive: boolean
  sourceSequence: { element: { isActive: boolean }; pathway: { isActive: boolean } }
  targetSequence: { element: { isActive: boolean }; pathway: { isActive: boolean } }
} | null | undefined): boolean {
  return Boolean(
    advance?.isActive &&
      advance.sourceSequence.pathway.isActive &&
      advance.targetSequence.pathway.isActive &&
      advance.sourceSequence.element.isActive &&
      advance.targetSequence.element.isActive,
  )
}

export function aplicacionAvanceTieneContenidoActivo(
  advance: {
    isActive: boolean
    sourceSequence: {
      elementId: string
      element: { isActive: boolean }
      pathway: { isActive: boolean }
    }
    targetSequence: {
      element: { isActive: boolean }
      pathway: { isActive: boolean }
    }
  },
  sourceElementId: string,
): boolean {
  return (
    advance.isActive &&
    advance.sourceSequence.elementId === sourceElementId &&
    advance.sourceSequence.element.isActive &&
    advance.sourceSequence.pathway.isActive &&
    advance.targetSequence.pathway.isActive &&
    advance.targetSequence.element.isActive
  )
}

// El resolvedor admite cualquiera de los rituales activos alternativos: si
// no hay ninguno, no exige preparación; si los hay, basta uno preparado.
export function ritualesPermitenAplicacion(
  rituals: { isActive: boolean; preparado: boolean }[],
): boolean {
  const activos = rituals.filter((ritual) => ritual.isActive)
  return activos.length === 0 || activos.some((ritual) => ritual.preparado)
}

export type RitualApplicationDecision =
  | 'ALLOW'
  | 'KNOWLEDGE_REQUIRED'
  | 'PREPARATION_REQUIRED'
  | 'CONFIRMED_UNPROTECTED_FAILURE'

export function decidirAplicacionRitual(
  rituals: { isActive: boolean; preparado: boolean }[],
  hasRitualKnowledge: boolean,
  confirmRitualRisk: boolean,
): RitualApplicationDecision {
  const activos = rituals.filter((ritual) => ritual.isActive)
  if (activos.length === 0 || activos.some((ritual) => ritual.preparado)) return 'ALLOW'
  if (!hasRitualKnowledge) return 'KNOWLEDGE_REQUIRED'
  return confirmRitualRisk ? 'CONFIRMED_UNPROTECTED_FAILURE' : 'PREPARATION_REQUIRED'
}
