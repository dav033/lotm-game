// Simulador puro y determinista del grafo de progresión. No accede a Prisma:
// recibe catálogos normalizados (los mismos que sirven al seed) y calcula el
// cierre alcanzable por punto fijo. Se usa en las pruebas para verificar los
// cierres de fase (17 → 56 → 74) de forma independiente del runtime, y para
// las auditorías aleatorias de orden de acciones.
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
}

export type SimRecipe = {
  ings: [string, number][]
  outputs: string[]
  isActive?: boolean
}

export type SimAdvance = {
  internalName: string
  ingredients: string[]
  source: string
  target: string
}

export type SimSequence = {
  slug: string
  number: number
}

export type SimRitual = {
  advanceName: string
  ingredients: string[]
  requiredSequenceNumber: number
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
}

export type SimResult = {
  discovered: Set<string>
  reason: Map<string, string>
  depth: Map<string, number>
  discoveredSequenceSlugs: Set<string>
  preparedAdvances: Set<string>
  appliedAdvances: Set<string>
}

function totalUnits(ings: [string, number][]): number {
  return ings.reduce((sum, [, qty]) => sum + qty, 0)
}

function pickRandom<T>(items: T[], rng: () => number): T {
  const index = Math.floor(rng() * items.length) % items.length
  return items[index]
}

export function simulateProgression(input: SimInput, options: SimOptions = {}): SimResult {
  const advancePreparationRequiresSourceSequence =
    options.advancePreparationRequiresSourceSequence ?? false
  const ritualEvaluationEnabled = options.ritualEvaluationEnabled ?? true

  const elementsBySlug = new Map(input.elements.map((e) => [e.slug, e]))
  const activeRecipes = input.recipes.filter((r) => r.isActive !== false)
  const sequenceNumberBySlug = new Map(input.sequences.map((s) => [s.slug, s.number]))
  const rituálesPorAvance = new Map<string, SimRitual[]>()
  for (const ritual of input.rituals) {
    const lista = rituálesPorAvance.get(ritual.advanceName) ?? []
    lista.push(ritual)
    rituálesPorAvance.set(ritual.advanceName, lista)
  }

  const discovered = new Set<string>()
  const reason = new Map<string, string>()
  const depth = new Map<string, number>()
  const preparedAdvances = new Set<string>()
  const appliedAdvances = new Set<string>()

  function discover(slug: string, why: string, atDepth: number) {
    if (discovered.has(slug)) return
    discovered.add(slug)
    reason.set(slug, why)
    depth.set(slug, atDepth)
  }

  for (const el of input.elements) {
    if (el.isStarter) discover(el.slug, 'starter', 0)
  }

  function currentDepth(slugs: string[]): number {
    let max = 0
    for (const s of slugs) max = Math.max(max, depth.get(s) ?? 0)
    return max
  }

  function ritualPermiteAplicacion(advanceName: string): boolean {
    if (!ritualEvaluationEnabled) return true
    const rituales = rituálesPorAvance.get(advanceName) ?? []
    if (rituales.length === 0) return true
    if (!discovered.has('ritual')) return false
    const sourceSlug = input.advances.find(
      (advance) => advance.internalName === advanceName,
    )?.source
    if (!sourceSlug || !discovered.has(sourceSlug)) return false
    return rituales.some((ritual) => {
      const ingredientesListos = ritual.ingredients.every((slug) => discovered.has(slug))
      return ingredientesListos
    })
  }

  type Action = () => void

  function collectActions(): Action[] {
    const actions: Action[] = []

    // Recetas activas: se disparan si todos los ingredientes (por slug único,
    // sin importar la cantidad — los elementos son conceptos reutilizables)
    // están descubiertos y falta algún resultado.
    for (const recipe of activeRecipes) {
      const ingredientSlugs = [...new Set(recipe.ings.map(([slug]) => slug))]
      if (!ingredientSlugs.every((slug) => discovered.has(slug))) continue
      if (recipe.outputs.every((slug) => discovered.has(slug))) continue
      actions.push(() => {
        const d = currentDepth(ingredientSlugs) + 1
        for (const output of recipe.outputs) {
          discover(output, `receta:${ingredientSlugs.join('+')}`, d)
        }
      })
    }

    // Preparar avance: obtener la carta enmascarada a partir de sus dos
    // ingredientes. En el juego real no exige poseer la Secuencia de origen;
    // el modo alternativo (11.D) sí lo exige, para auditar que el cierre no
    // cambia.
    for (const advance of input.advances) {
      if (preparedAdvances.has(advance.internalName)) continue
      if (!advance.ingredients.every((slug) => discovered.has(slug))) continue
      if (advancePreparationRequiresSourceSequence && !discovered.has(advance.source)) continue
      actions.push(() => {
        preparedAdvances.add(advance.internalName)
      })
    }

    // Aplicar avance: combinar la carta preparada con la Secuencia de
    // origen ya descubierta produce la Secuencia de destino, salvo que un
    // ritual activo bloquee la aplicación (ninguno de los avances de fases
    // 1-3 tiene ritual asociado, así que esto nunca bloquea aquí).
    for (const advance of input.advances) {
      if (appliedAdvances.has(advance.internalName)) continue
      if (!preparedAdvances.has(advance.internalName)) continue
      if (!discovered.has(advance.source)) continue
      if (discovered.has(advance.target)) continue
      if (!ritualPermiteAplicacion(advance.internalName)) continue
      actions.push(() => {
        appliedAdvances.add(advance.internalName)
        const d = currentDepth([...advance.ingredients, advance.source]) + 1
        discover(advance.target, `avance:${advance.internalName}`, d)
      })
    }

    // Desbloqueos espontáneos: mismo predicado que el runtime.
    const discoveredTypes = new Set<string>()
    const discoveredSequenceNumbers = new Set<number>()
    for (const slug of discovered) {
      const el = elementsBySlug.get(slug)
      if (el) discoveredTypes.add(el.type)
      const number = sequenceNumberBySlug.get(slug)
      if (number != null) discoveredSequenceNumbers.add(number)
    }
    for (const el of input.elements) {
      if (el.isActive === false) continue
      if (discovered.has(el.slug)) continue
      const satisfecho = desbloqueoEspontaneoSatisfecho(
        {
          unlockedByType: el.unlockedByType,
          unlockedBySequenceNumber: el.unlockedBySequenceNumber,
          requiredElementIds: input.andRequirements[el.slug] ?? [],
          triggerIds: input.triggers[el.slug] ?? [],
        },
        { discoveredIds: discovered, discoveredTypes, discoveredSequenceNumbers },
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
    [...discovered].filter((slug) => sequenceNumberBySlug.has(slug)),
  )

  return { discovered, reason, depth, discoveredSequenceSlugs, preparedAdvances, appliedAdvances }
}

/** Valida que una receta declarada respete la regla "exactamente 2 unidades". */
export function recetaTieneDosUnidades(recipe: SimRecipe): boolean {
  return totalUnits(recipe.ings) === 2
}
