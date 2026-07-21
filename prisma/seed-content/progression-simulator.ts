// Simulador puro y determinista del grafo de progresión. No accede a Prisma:
// recibe catálogos normalizados (los mismos que sirven al seed) y calcula el
// cierre alcanzable por punto fijo. Se usa en las pruebas para verificar los
// cierres de ingredientes, de forma independiente del runtime, y para las
// auditorías aleatorias de orden de acciones.
//
// La regla de desbloqueo espontáneo reutiliza el mismo predicado puro que el
// runtime (`desbloqueoEspontaneoSatisfecho`) para que ambos no puedan
// divergir.

import { desbloqueoEspontaneoSatisfecho } from '../../src/server/domain/desbloqueoEspontaneo'

export type SimElement = {
  slug: string
  type: string
  isStarter: boolean
  isActive?: boolean
  unlockedByType: string | null
  unlockedBySequenceNumber: number | null
  unlockedAtDiscoveryCount: number | null
  /** Null = pool global; número = concesión automática al abrir esa fase. */
  availableFromPhaseOrder?: number | null
  /** Solo aplica a concesiones con orden. False = retenida por una fase inactiva. */
  availableFromPhaseIsActive?: boolean
}

export type SimPhase = {
  sortOrder: number
  unlockAtDiscoveryCount: number
  isActive: boolean
}

export type SimRecipe = {
  ings: [string, number][]
  outputs: string[]
  isActive?: boolean
}

export type SimAdvance = {
  internalName: string
  ingredients: [string, number][]
  source: string
  target: string
  isActive: boolean
}

export type SimSequence = {
  slug: string
  number: number
  pathwaySlug: string
  pathwayIsActive: boolean
}

export type SimRitual = {
  id?: string
  name: string
  advanceName: string
  ingredients: string[]
  requiredSequenceNumber: number
  isActive: boolean
  failureOutputs: string[]
}

export type SimInput = {
  elements: SimElement[]
  recipes: SimRecipe[]
  advances: SimAdvance[]
  sequences: SimSequence[]
  rituals: SimRitual[]
  /** slug del elemento → slugs de sus desencadenantes directos (OR). */
  triggers: Record<string, string[]>
  /** slug del elemento → slugs de sus requisitos AND. */
  andRequirements: Record<string, string[]>
  phases?: SimPhase[]
  featureGates?: { ADVANCEMENT_RITUALS?: number }
}

export type SimOptions = {
  /** Si true, un avance solo puede "prepararse" tras poseer su Secuencia de origen. */
  advancePreparationRequiresSourceSequence?: boolean
  /** Si false, los rituales nunca bloquean la aplicación de un avance. */
  ritualEvaluationEnabled?: boolean
  /**
   * Generador determinista opcional. Si se provee, cada ronda aplica UNA sola
   * acción disponible elegida al azar en vez de todas las disponibles. Sirve
   * para la auditoría de cierre bajo orden de acciones aleatorio.
   */
  rng?: () => number
  /**
   * Límite superior opcional para el recuento usado al evaluar
   * `unlockedAtDiscoveryCount`: el recuento real nunca se reporta por encima
   * de este valor. Con `discoveryCountCap: 0` ningún desbloqueo por cantidad
   * puede dispararse (equivale a simular la fase 1 "sin aplicar desbloqueos
   * por cantidad"). Sirve para fotografiar el cierre en un hito intermedio.
   */
  discoveryCountCap?: number
  /**
   * Incluye las consecuencias que un jugador puede obtener al confirmar un
   * avance ritualizado sin preparar. El cierre orgánico lo deja desactivado.
   */
  includeUnsafeRitualFailures?: boolean
}

export type SimResult = {
  discovered: Set<string>
  reason: Map<string, string>
  depth: Map<string, number>
  discoveredSequenceSlugs: Set<string>
  discoveredPathwaySlugs: Set<string>
  preparedAdvances: Set<string>
  appliedAdvances: Set<string>
  availableRituals: Set<string>
  preparedRituals: Set<string>
  failedAdvances: Set<string>
}

function totalUnits(ings: [string, number][]): number {
  return ings.reduce((sum, [, qty]) => sum + qty, 0)
}

function pickRandom<T>(items: T[], rng: () => number): T {
  const index = Math.floor(rng() * items.length) % items.length
  return items[index]
}

const ritualKey = (ritual: SimRitual) => ritual.id ?? ritual.name

export function simulateProgression(input: SimInput, options: SimOptions = {}): SimResult {
  const advancePreparationRequiresSourceSequence =
    options.advancePreparationRequiresSourceSequence ?? false
  const ritualEvaluationEnabled = options.ritualEvaluationEnabled ?? true

  const elementsBySlug = new Map(input.elements.map((e) => [e.slug, e]))
  const activeRecipes = input.recipes.filter((r) => r.isActive !== false)
  const sequencesBySlug = new Map(input.sequences.map((s) => [s.slug, s]))
  const activeAdvances = input.advances.filter((advance) => advance.isActive)
  const rituálesPorAvance = new Map<string, SimRitual[]>()
  for (const ritual of input.rituals) {
    if (!ritual.isActive) continue
    const lista = rituálesPorAvance.get(ritual.advanceName) ?? []
    lista.push(ritual)
    rituálesPorAvance.set(ritual.advanceName, lista)
  }

  const discovered = new Set<string>()
  const reason = new Map<string, string>()
  const depth = new Map<string, number>()
  const preparedAdvances = new Set<string>()
  const appliedAdvances = new Set<string>()
  const availableRituals = new Set<string>()
  const preparedRituals = new Set<string>()
  const failedAdvances = new Set<string>()

  function contentIsActive(slug: string): boolean {
    if (elementsBySlug.get(slug)?.isActive === false) return false
    const sequence = sequencesBySlug.get(slug)
    return !sequence || sequence.pathwayIsActive
  }

  function phaseOrderAt(discoveryCount: number): number {
    if (!input.phases) return Number.POSITIVE_INFINITY
    let order = 0
    for (const phase of input.phases) {
      if (phase.isActive && phase.unlockAtDiscoveryCount <= discoveryCount) {
        order = Math.max(order, phase.sortOrder)
      }
    }
    return order
  }

  function contentIsAvailable(slug: string, phaseOrder: number): boolean {
    if (!contentIsActive(slug)) return false
    const element = elementsBySlug.get(slug)
    const availableFrom = element?.availableFromPhaseOrder
    if (availableFrom === undefined) return true
    if (availableFrom === null) return true
    return element?.availableFromPhaseIsActive !== false && availableFrom <= phaseOrder
  }

  function advanceIsUsable(advance: SimAdvance, phaseOrder: number): boolean {
    return (
      advance.isActive &&
      totalUnits(advance.ingredients) === 2 &&
      contentIsAvailable(advance.source, phaseOrder) &&
      contentIsAvailable(advance.target, phaseOrder) &&
      advance.ingredients.every(([slug]) => contentIsAvailable(slug, phaseOrder))
    )
  }

  function discover(slug: string, why: string, atDepth: number) {
    if (discovered.has(slug) || !contentIsActive(slug)) return
    discovered.add(slug)
    reason.set(slug, why)
    depth.set(slug, atDepth)
  }

  const initialPhaseOrder = phaseOrderAt(0)
  for (const el of input.elements) {
    if (el.isStarter && contentIsAvailable(el.slug, initialPhaseOrder)) discover(el.slug, 'starter', 0)
  }

  function currentDepth(slugs: string[]): number {
    let max = 0
    for (const s of slugs) max = Math.max(max, depth.get(s) ?? 0)
    return max
  }

  function advancementRitualsEnabled(currentPhaseOrder: number): boolean {
    const minimum = input.featureGates?.ADVANCEMENT_RITUALS
    return minimum === undefined || currentPhaseOrder >= minimum
  }

  function ritualPermiteAplicacion(advanceName: string, currentPhaseOrder: number): boolean {
    if (!ritualEvaluationEnabled) return true
    const rituales = rituálesPorAvance.get(advanceName) ?? []
    if (rituales.length === 0) return true
    if (!advancementRitualsEnabled(currentPhaseOrder)) return false
    return rituales.some((ritual) => preparedRituals.has(ritualKey(ritual)))
  }

  type Action = () => void

  function collectActions(): Action[] {
    const actions: Action[] = []

    // Cantidad de elementos activos descubiertos, tal como la evalúan las
    // reglas de umbral (>=, nunca igualdad exacta), respetando el límite
    // opcional de la simulación.
    const activeDiscoveryCount = [...discovered].filter((slug) => contentIsActive(slug)).length
    const discoveryCount =
      options.discoveryCountCap != null
        ? Math.min(activeDiscoveryCount, options.discoveryCountCap)
        : activeDiscoveryCount
    const currentPhaseOrder = phaseOrderAt(discoveryCount)
    const protectedAdvanceTargetSlugs = new Set(
      activeAdvances
        .filter((advance) => advanceIsUsable(advance, currentPhaseOrder))
        .map((advance) => advance.target),
    )

    // Una asignación de fase es una concesión directa, no una barrera sobre
    // todos los resultados del catálogo. Los elementos null siguen en el pool.
    for (const element of input.elements) {
      const openingOrder = element.availableFromPhaseOrder
      if (
        openingOrder === undefined ||
        openingOrder === null ||
        element.availableFromPhaseIsActive === false ||
        openingOrder > currentPhaseOrder ||
        discovered.has(element.slug) ||
        !contentIsActive(element.slug)
      ) {
        continue
      }
      actions.push(() => discover(element.slug, `fase:${openingOrder}`, 0))
    }

    // Recetas activas: se disparan si todos los ingredientes (por slug único,
    // sin importar la cantidad — los elementos son conceptos reutilizables)
    // están descubiertos y falta algún resultado. Las recetas no tienen
    // restricciones por cantidad de descubrimientos.
    for (const recipe of activeRecipes) {
      if (totalUnits(recipe.ings) !== 2) continue
      const ingredientSlugs = [...new Set(recipe.ings.map(([slug]) => slug))]
      if (!ingredientSlugs.every((slug) => contentIsAvailable(slug, currentPhaseOrder) && discovered.has(slug))) continue
      const executableOutputs = recipe.outputs.filter(
        (slug) =>
          contentIsAvailable(slug, currentPhaseOrder) &&
          !protectedAdvanceTargetSlugs.has(slug) &&
          !discovered.has(slug),
      )
      if (executableOutputs.length === 0) continue
      actions.push(() => {
        const d = currentDepth(ingredientSlugs) + 1
        for (const output of executableOutputs) {
          discover(output, `receta:${ingredientSlugs.join('+')}`, d)
        }
      })
    }

    // Preparar avance: obtener la carta enmascarada a partir de sus dos
    // ingredientes. En el juego real no exige poseer la Secuencia de origen;
    // el modo alternativo (11.D) sí lo exige, para auditar que el cierre no
    // cambia.
    for (const advance of activeAdvances) {
      if (!advanceIsUsable(advance, currentPhaseOrder)) continue
      if (preparedAdvances.has(advance.internalName)) continue
      const ingredientSlugs = advance.ingredients.map(([slug]) => slug)
      if (!ingredientSlugs.every((slug) => discovered.has(slug))) continue
      if (advancePreparationRequiresSourceSequence && !discovered.has(advance.source)) continue
      actions.push(() => {
        preparedAdvances.add(advance.internalName)
      })
    }

    // Aplicar avance: combinar la carta preparada con la Secuencia de origen
    // produce el destino cuando no requiere ritual o ya existe una preparación.
    for (const advance of activeAdvances) {
      if (!advanceIsUsable(advance, currentPhaseOrder)) continue
      if (appliedAdvances.has(advance.internalName)) continue
      if (!preparedAdvances.has(advance.internalName)) continue
      if (!discovered.has(advance.source)) continue
      if (discovered.has(advance.target)) continue
      if (!ritualPermiteAplicacion(advance.internalName, currentPhaseOrder)) continue
      actions.push(() => {
        appliedAdvances.add(advance.internalName)
        const d = currentDepth([...advance.ingredients.map(([slug]) => slug), advance.source]) + 1
        discover(advance.target, `avance:${advance.internalName}`, d)
      })
    }

    // Conocimiento y preparación ritual. Un fracaso es una decisión explícita
    // del jugador, no una acción obligatoria del cierre alcanzable.
    if (advancementRitualsEnabled(currentPhaseOrder) && discovered.has('ritual')) {
      const preparedAdvanceNames = new Set(
        input.rituals
          .filter((ritual) => preparedRituals.has(ritualKey(ritual)))
          .map((ritual) => ritual.advanceName),
      )
      const activeRituals = input.rituals
        .filter((item) => item.isActive)
        .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)
      for (const ritual of activeRituals) {
        const advance = activeAdvances.find((item) => item.internalName === ritual.advanceName)
        if (!advance || !advanceIsUsable(advance, currentPhaseOrder) || !discovered.has(advance.source)) continue
        if (discovered.has(advance.target)) continue
        const key = ritualKey(ritual)
        if (!availableRituals.has(key)) {
          actions.push(() => availableRituals.add(key))
        }
        if (
          !preparedAdvanceNames.has(ritual.advanceName) &&
          ritual.ingredients.every((slug) => contentIsAvailable(slug, currentPhaseOrder) && discovered.has(slug))
        ) {
          actions.push(() => preparedRituals.add(key))
          preparedAdvanceNames.add(ritual.advanceName)
        }
      }
    }

    // Un fallo sin protección es una decisión explícita del jugador. Se
    // calcula aparte del cierre orgánico, pero con las mismas precondiciones
    // del runtime: carta preparada, Secuencia de origen y conocimiento ritual.
    if (
      options.includeUnsafeRitualFailures &&
      advancementRitualsEnabled(currentPhaseOrder) &&
      discovered.has('ritual')
    ) {
      for (const advance of activeAdvances) {
        if (!advanceIsUsable(advance, currentPhaseOrder)) continue
        if (!preparedAdvances.has(advance.internalName)) continue
        if (!discovered.has(advance.source) || failedAdvances.has(advance.internalName)) continue
        const rituales = rituálesPorAvance.get(advance.internalName) ?? []
        if (rituales.length === 0) continue
        actions.push(() => {
          failedAdvances.add(advance.internalName)
          const d = currentDepth([...advance.ingredients.map(([slug]) => slug), advance.source]) + 1
          for (const output of new Set(rituales.flatMap((ritual) => ritual.failureOutputs))) {
            if (contentIsAvailable(output, currentPhaseOrder)) {
              discover(output, `fallo-ritual:${advance.internalName}`, d)
            }
          }
        })
      }
    }

    // Desbloqueos espontáneos: mismo predicado que el runtime.
    const discoveredTypes = new Set<string>()
    const discoveredSequenceNumbers = new Set<number>()
    for (const slug of discovered) {
      const el = elementsBySlug.get(slug)
      if (el) discoveredTypes.add(el.type)
      const sequence = sequencesBySlug.get(slug)
      if (sequence?.pathwayIsActive) discoveredSequenceNumbers.add(sequence.number)
    }
    for (const el of input.elements) {
      // Los elementos asignados los concede su fase; sus condiciones quedan
      // latentes para cuando vuelvan al pool global.
      if (el.availableFromPhaseOrder !== undefined && el.availableFromPhaseOrder !== null) continue
      if (!contentIsAvailable(el.slug, currentPhaseOrder)) continue
      if (discovered.has(el.slug)) continue
      const satisfecho = desbloqueoEspontaneoSatisfecho(
        {
          unlockedByType: el.unlockedByType,
          unlockedBySequenceNumber: el.unlockedBySequenceNumber,
          unlockedAtDiscoveryCount: el.unlockedAtDiscoveryCount,
          requiredElementIds: input.andRequirements[el.slug] ?? [],
          triggerIds: input.triggers[el.slug] ?? [],
        },
        { discoveredIds: discovered, discoveredTypes, discoveredSequenceNumbers, discoveryCount },
      )
      if (!satisfecho) continue
      actions.push(() => {
        const requeridos = [
          ...(input.andRequirements[el.slug] ?? []),
          ...(input.triggers[el.slug] ?? []).filter((slug) => discovered.has(slug)),
        ]
        const d = (requeridos.length > 0 ? currentDepth(requeridos) : 0) + 1
        discover(el.slug, 'espontaneo', d)
      })
    }

    return actions
  }

  const rng = options.rng
  // Punto fijo: en cada ronda se recogen todas las acciones disponibles.
  // Sin rng se aplican todas (más rápido, determinista por construcción).
  // Con rng se aplica una sola acción elegida al azar por ronda, para
  // auditar que el orden de exploración no cambia el cierre final.
  for (;;) {
    const actions = collectActions()
    if (actions.length === 0) break
    if (rng) {
      pickRandom(actions, rng)()
    } else {
      for (const action of actions) action()
    }
  }

  const discoveredSequenceSlugs = new Set(
    [...discovered].filter((slug) => sequencesBySlug.get(slug)?.pathwayIsActive),
  )
  const discoveredPathwaySlugs = new Set(
    [...discoveredSequenceSlugs].map((slug) => sequencesBySlug.get(slug)!.pathwaySlug),
  )

  return {
    discovered,
    reason,
    depth,
    discoveredSequenceSlugs,
    discoveredPathwaySlugs,
    preparedAdvances,
    appliedAdvances,
    availableRituals,
    preparedRituals,
    failedAdvances,
  }
}

/** Valida que una receta declarada respete la regla "exactamente 2 unidades". */
export function recetaTieneDosUnidades(recipe: SimRecipe): boolean {
  return totalUnits(recipe.ings) === 2
}
