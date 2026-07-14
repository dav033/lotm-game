// Herramientas de diagnóstico del árbol de combinaciones. Funciones puras
// sobre datos ya cargados: fáciles de probar y sin atadura a la base de datos.

export type DiagElement = {
  id: string
  slug: string
  name: string
  type: string
  isStarter: boolean
  isActive: boolean
  unlockedByType: string | null
}

// Desencadenante espontáneo: `elementId` se desbloquea al descubrir `triggerId`.
export type DiagTrigger = { elementId: string; triggerId: string }

export type DiagRecipe = {
  id: string
  inputKey: string
  isActive: boolean
  outputElementIds: string[]
  ingredients: { elementId: string; quantity: number }[]
}

/**
 * Alcanzabilidad: parte de los elementos iniciales y aplica repetidamente las
 * recetas activas (una receta "produce" cuando TODOS sus ingredientes ya son
 * alcanzables) y los descubrimientos espontáneos (por tipo o por elemento
 * desencadenante). Devuelve el conjunto de ids alcanzables.
 */
export function calcularAlcanzables(
  elements: DiagElement[],
  recipes: DiagRecipe[],
  triggers: DiagTrigger[] = [],
): Set<string> {
  const reachable = new Set(
    elements.filter((e) => e.isStarter && e.isActive).map((e) => e.id),
  )
  const activeRecipes = recipes.filter((r) => r.isActive)
  const byId = new Map(elements.map((e) => [e.id, e]))
  const triggersDe = new Map<string, string[]>()
  for (const t of triggers) {
    const lista = triggersDe.get(t.elementId) ?? []
    lista.push(t.triggerId)
    triggersDe.set(t.elementId, lista)
  }

  let changed = true
  while (changed) {
    changed = false
    for (const r of activeRecipes) {
      const producesSomethingNew = r.outputElementIds.some((oid) => !reachable.has(oid))
      if (producesSomethingNew && r.ingredients.every((i) => reachable.has(i.elementId))) {
        for (const oid of r.outputElementIds) {
          reachable.add(oid)
        }
        changed = true
      }
    }
    for (const e of elements) {
      if (!e.isActive || reachable.has(e.id)) continue
      const porTipo =
        e.unlockedByType !== null &&
        elements.some((x) => x.type === e.unlockedByType && reachable.has(x.id))
      const porElemento = (triggersDe.get(e.id) ?? []).some(
        (tid) => reachable.has(tid) && byId.get(tid)?.isActive,
      )
      if (porTipo || porElemento) {
        reachable.add(e.id)
        changed = true
      }
    }
  }
  return reachable
}

export function elementosInalcanzables(
  elements: DiagElement[],
  recipes: DiagRecipe[],
  triggers: DiagTrigger[] = [],
): DiagElement[] {
  const reachable = calcularAlcanzables(elements, recipes, triggers)
  return elements.filter((e) => e.isActive && !reachable.has(e.id))
}

/** Recetas que comparten inputKey (datos antiguos o importaciones inválidas). */
export function recetasDuplicadas(recipes: DiagRecipe[]): Map<string, DiagRecipe[]> {
  const byKey = new Map<string, DiagRecipe[]>()
  for (const r of recipes) {
    const list = byKey.get(r.inputKey) ?? []
    list.push(r)
    byKey.set(r.inputKey, list)
  }
  return new Map([...byKey.entries()].filter(([, list]) => list.length > 1))
}

/**
 * Ciclos en el grafo ingrediente → resultado (A produce B y B produce A).
 * Solo advertencia: pueden ser intencionales. Devuelve los ciclos hallados
 * como listas de ids de elementos.
 */
export function detectarCiclos(recipes: DiagRecipe[]): string[][] {
  const edges = new Map<string, Set<string>>()
  for (const r of recipes.filter((x) => x.isActive)) {
    for (const ing of r.ingredients) {
      if (!edges.has(ing.elementId)) edges.set(ing.elementId, new Set())
      for (const oid of r.outputElementIds) {
        edges.get(ing.elementId)?.add(oid)
      }
    }
  }

  const cycles: string[][] = []
  const seenCycleKeys = new Set<string>()
  const state = new Map<string, 'visiting' | 'done'>()
  const stack: string[] = []

  const visit = (node: string) => {
    state.set(node, 'visiting')
    stack.push(node)
    for (const next of edges.get(node) ?? []) {
      const s = state.get(next)
      if (s === 'visiting') {
        const start = stack.indexOf(next)
        const cycle = stack.slice(start)
        const key = [...cycle].sort().join('>')
        if (!seenCycleKeys.has(key)) {
          seenCycleKeys.add(key)
          cycles.push([...cycle, next])
        }
      } else if (!s) {
        visit(next)
      }
    }
    stack.pop()
    state.set(node, 'done')
  }

  for (const node of edges.keys()) {
    if (!state.has(node)) visit(node)
  }
  return cycles
}

/**
 * Elementos "sin uso": no iniciales, ninguna receta los produce, no participan
 * como ingrediente, no representan una secuencia y no tienen desbloqueo
 * espontáneo (ni desbloquean a otros).
 */
export function elementosSinUso(
  elements: DiagElement[],
  recipes: DiagRecipe[],
  sequenceElementIds: Set<string>,
  triggers: DiagTrigger[] = [],
): DiagElement[] {
  const produced = new Set(recipes.flatMap((r) => r.outputElementIds))
  const used = new Set(recipes.flatMap((r) => r.ingredients.map((i) => i.elementId)))
  const espontaneos = new Set(triggers.flatMap((t) => [t.elementId, t.triggerId]))
  return elements.filter(
    (e) =>
      e.isActive &&
      !e.isStarter &&
      !produced.has(e.id) &&
      !used.has(e.id) &&
      !sequenceElementIds.has(e.id) &&
      e.unlockedByType === null &&
      !espontaneos.has(e.id),
  )
}
