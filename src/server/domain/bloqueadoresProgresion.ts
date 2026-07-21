import type { SimInput, SimResult } from '../../../prisma/seed-content/progression-simulator'
import { RITUAL_KNOWLEDGE_ELEMENT_SLUG } from './ritualKnowledge'

export type BloqueadoresElemento = {
  elementSlugs: string[]
  conditions: string[]
  steps: number | null
}

type Solucion = {
  elements: Set<string>
  conditions: Set<string>
  steps: number
}

const totalUnits = (items: [string, number][]) =>
  items.reduce((sum, [, quantity]) => sum + quantity, 0)

const signature = (solution: Solucion) =>
  `${[...solution.elements].sort().join(',')}|${[...solution.conditions].sort().join(',')}`

function isBetter(candidate: Solucion, current: Solucion | null): boolean {
  if (!current) return true
  const candidateMissing = candidate.elements.size + candidate.conditions.size
  const currentMissing = current.elements.size + current.conditions.size
  if (candidateMissing !== currentMissing) return candidateMissing < currentMissing
  if (candidate.steps !== current.steps) return candidate.steps < current.steps
  return signature(candidate) < signature(current)
}

export function calcularBloqueadoresMinimos(
  input: SimInput,
  reachableSlugs: ReadonlySet<string>,
  phaseOrder: number,
): Record<string, BloqueadoresElemento> {
  const elementBySlug = new Map(input.elements.map((element) => [element.slug, element]))
  const sequenceBySlug = new Map(input.sequences.map((sequence) => [sequence.slug, sequence]))
  const contentIsActive = (slug: string) => {
    if (elementBySlug.get(slug)?.isActive === false) return false
    const sequence = sequenceBySlug.get(slug)
    return !sequence || sequence.pathwayIsActive
  }
  const contentIsAvailable = (slug: string) => {
    if (!contentIsActive(slug)) return false
    const element = elementBySlug.get(slug)
    const from = element?.availableFromPhaseOrder
    return (
      from === undefined ||
      from === null ||
      (element?.availableFromPhaseIsActive !== false && from <= phaseOrder)
    )
  }

  const protectedTargets = new Set(
    input.advances
      .filter(
        (advance) =>
          advance.isActive &&
          totalUnits(advance.ingredients) === 2 &&
          contentIsAvailable(advance.source) &&
          contentIsAvailable(advance.target) &&
          advance.ingredients.every(([slug]) => contentIsAvailable(slug)),
      )
      .map((advance) => advance.target),
  )

  const routesByOutput = new Map<string, string[][]>()
  const addRoute = (output: string, dependencies: readonly string[]) => {
    const routes = routesByOutput.get(output) ?? []
    routes.push([...new Set(dependencies)])
    routesByOutput.set(output, routes)
  }

  for (const recipe of input.recipes) {
    if (recipe.isActive === false || totalUnits(recipe.ings) !== 2) continue
    const dependencies = recipe.ings.map(([slug]) => slug)
    for (const output of recipe.outputs) {
      if (!protectedTargets.has(output)) addRoute(output, dependencies)
    }
  }

  for (const advance of input.advances) {
    if (!advance.isActive || totalUnits(advance.ingredients) !== 2) continue
    const sourceSequence = sequenceBySlug.get(advance.source)
    const targetSequence = sequenceBySlug.get(advance.target)
    if (!sourceSequence?.pathwayIsActive || !targetSequence?.pathwayIsActive) continue
    const baseDependencies = [
      advance.source,
      ...advance.ingredients.map(([slug]) => slug),
    ]
    const rituals = input.rituals.filter(
      (ritual) => ritual.isActive && ritual.advanceName === advance.internalName,
    )
    if (rituals.length === 0) {
      addRoute(advance.target, baseDependencies)
    } else {
      for (const ritual of rituals) {
        addRoute(advance.target, [
          ...baseDependencies,
          RITUAL_KNOWLEDGE_ELEMENT_SLUG,
          ...ritual.ingredients,
        ])
      }
    }
  }

  for (const [output, triggers] of Object.entries(input.triggers)) {
    for (const trigger of triggers) addRoute(output, [trigger])
  }

  const reachableCount = [...reachableSlugs].filter(contentIsActive).length
  const memo = new Map<string, Solucion>()

  const combine = (parts: readonly Solucion[], conditions: readonly string[] = []): Solucion => {
    const elements = new Set<string>()
    const allConditions = new Set(conditions)
    let steps = 0
    for (const part of parts) {
      for (const slug of part.elements) elements.add(slug)
      for (const condition of part.conditions) allConditions.add(condition)
      steps = Math.max(steps, part.steps)
    }
    return { elements, conditions: allConditions, steps: steps + 1 }
  }

  const solve = (slug: string, visiting: ReadonlySet<string>): Solucion | null => {
    if (reachableSlugs.has(slug)) {
      return { elements: new Set(), conditions: new Set(), steps: 0 }
    }
    const cached = memo.get(slug)
    if (cached) return cached
    if (visiting.has(slug)) return null

    const element = elementBySlug.get(slug)
    if (!element) {
      return {
        elements: new Set(),
        conditions: new Set([`Referencia inexistente: ${slug}`]),
        steps: 0,
      }
    }
    if (!contentIsAvailable(slug)) {
      const terminal = { elements: new Set([slug]), conditions: new Set<string>(), steps: 0 }
      memo.set(slug, terminal)
      return terminal
    }

    const nextVisiting = new Set(visiting)
    nextVisiting.add(slug)
    let best: Solucion | null = null

    for (const route of routesByOutput.get(slug) ?? []) {
      const parts = route.map((dependency) => solve(dependency, nextVisiting))
      if (parts.some((part) => part === null)) continue
      const candidate = combine(parts as Solucion[])
      if (isBetter(candidate, best)) best = candidate
    }

    const declarativeConfigured =
      element.unlockedByType != null ||
      element.unlockedBySequenceNumber != null ||
      element.unlockedAtDiscoveryCount != null ||
      (input.andRequirements[slug]?.length ?? 0) > 0

    if (declarativeConfigured) {
      const parts: Solucion[] = []
      const conditions: string[] = []
      let valid = true

      for (const dependency of input.andRequirements[slug] ?? []) {
        const part = solve(dependency, nextVisiting)
        if (!part) valid = false
        else parts.push(part)
      }

      if (element.unlockedByType != null) {
        let witness: Solucion | null = null
        for (const candidate of input.elements) {
          if (
            candidate.slug === slug ||
            candidate.type !== element.unlockedByType ||
            !contentIsActive(candidate.slug)
          ) {
            continue
          }
          const solution = solve(candidate.slug, nextVisiting)
          if (solution && isBetter(solution, witness)) witness = solution
        }
        if (witness) parts.push(witness)
        else conditions.push(`No hay un elemento activo de tipo ${element.unlockedByType}`)
      }

      if (element.unlockedBySequenceNumber != null) {
        let witness: Solucion | null = null
        for (const sequence of input.sequences) {
          if (
            sequence.slug === slug ||
            sequence.number !== element.unlockedBySequenceNumber ||
            !sequence.pathwayIsActive ||
            !contentIsActive(sequence.slug)
          ) {
            continue
          }
          const solution = solve(sequence.slug, nextVisiting)
          if (solution && isBetter(solution, witness)) witness = solution
        }
        if (witness) parts.push(witness)
        else conditions.push(`No hay una secuencia activa ${element.unlockedBySequenceNumber}`)
      }

      if (
        element.unlockedAtDiscoveryCount != null &&
        reachableCount < element.unlockedAtDiscoveryCount
      ) {
        conditions.push(
          `Faltan ${element.unlockedAtDiscoveryCount - reachableCount} descubrimientos para llegar a ${element.unlockedAtDiscoveryCount}`,
        )
      }

      if (valid) {
        const candidate = combine(parts, conditions)
        if (isBetter(candidate, best)) best = candidate
      }
    }

    const result = best ?? {
      elements: new Set([slug]),
      conditions: new Set<string>(),
      steps: 0,
    }
    memo.set(slug, result)
    return result
  }

  const result: Record<string, BloqueadoresElemento> = {}
  for (const element of input.elements) {
    if (reachableSlugs.has(element.slug)) continue
    const solution = solve(element.slug, new Set())
    if (!solution) continue
    result[element.slug] = {
      elementSlugs: [...solution.elements].sort(),
      conditions: [...solution.conditions].sort(),
      steps:
        solution.steps === 0 &&
        solution.elements.size === 1 &&
        solution.elements.has(element.slug) &&
        solution.conditions.size === 0
          ? null
          : solution.steps,
    }
  }
  return result
}

export function calcularBloqueadoresRituales(
  input: SimInput,
  simulation: Pick<SimResult, 'discovered' | 'availableRituals' | 'preparedRituals'>,
  phaseOrder: number,
): Record<string, BloqueadoresElemento> {
  const elementBlockers = calcularBloqueadoresMinimos(
    input,
    simulation.discovered,
    phaseOrder,
  )
  const elementBySlug = new Map(input.elements.map((element) => [element.slug, element]))
  const sequenceBySlug = new Map(input.sequences.map((sequence) => [sequence.slug, sequence]))
  const advanceByName = new Map(input.advances.map((advance) => [advance.internalName, advance]))

  const contentIsAvailable = (slug: string) => {
    const element = elementBySlug.get(slug)
    if (!element || element.isActive === false) return false
    const sequence = sequenceBySlug.get(slug)
    if (sequence && !sequence.pathwayIsActive) return false
    const from = element.availableFromPhaseOrder
    return (
      from === undefined ||
      from === null ||
      (element.availableFromPhaseIsActive !== false && from <= phaseOrder)
    )
  }

  const result: Record<string, BloqueadoresElemento> = {}
  for (const ritual of input.rituals) {
    const key = ritual.id ?? ritual.name
    const elements = new Set<string>()
    const conditions = new Set<string>()
    let dependencySteps = 0
    let hasDependencyBlocker = false
    const finish = (steps: number | null = null) => {
      result[key] = {
        elementSlugs: [...elements].sort(),
        conditions: [...conditions].sort(),
        steps,
      }
    }

    if (!ritual.isActive) {
      conditions.add('El ritual está inactivo.')
      finish()
      continue
    }

    const advance = advanceByName.get(ritual.advanceName)
    if (!advance) {
      conditions.add(`No existe el avance «${ritual.advanceName}».`)
      finish()
      continue
    }
    if (!advance.isActive) {
      conditions.add(`El avance «${advance.internalName}» está inactivo.`)
      finish()
      continue
    }
    if (totalUnits(advance.ingredients) !== 2) {
      conditions.add(`El avance «${advance.internalName}» no tiene exactamente 2 unidades.`)
      finish()
      continue
    }
    if (simulation.preparedRituals.has(key)) {
      finish(0)
      continue
    }

    const alternativePrepared = input.rituals.some(
      (candidate) =>
        candidate !== ritual &&
        candidate.advanceName === ritual.advanceName &&
        simulation.preparedRituals.has(candidate.id ?? candidate.name),
    )
    if (alternativePrepared) {
      conditions.add('Otro ritual ya prepara este avance.')
      finish()
      continue
    }

    if (
      simulation.discovered.has(advance.target) &&
      !simulation.availableRituals.has(key)
    ) {
      conditions.add('La secuencia destino ya es alcanzable; el ritual ya no es necesario.')
      finish()
      continue
    }

    const sourceSequence = sequenceBySlug.get(advance.source)
    const targetSequence = sequenceBySlug.get(advance.target)
    if (!sourceSequence) conditions.add(`No existe la secuencia origen «${advance.source}».`)
    if (!targetSequence) conditions.add(`No existe la secuencia destino «${advance.target}».`)
    if (sourceSequence && sourceSequence.number !== ritual.requiredSequenceNumber) {
      conditions.add(
        `El ritual exige Secuencia ${ritual.requiredSequenceNumber}, pero su origen es Secuencia ${sourceSequence.number}.`,
      )
    }
    for (const sequence of [sourceSequence, targetSequence]) {
      if (sequence && !sequence.pathwayIsActive) {
        conditions.add(`El camino «${sequence.pathwaySlug}» está inactivo.`)
      }
    }

    const addReachabilityBlockers = (slug: string) => {
      if (simulation.discovered.has(slug)) return
      hasDependencyBlocker = true
      const blockers = elementBlockers[slug]
      if (!blockers) {
        if (elementBySlug.has(slug)) elements.add(slug)
        else conditions.add(`Referencia inexistente: ${slug}`)
        return
      }
      dependencySteps = Math.max(dependencySteps, blockers.steps ?? 0)
      for (const blocker of blockers.elementSlugs) elements.add(blocker)
      for (const condition of blockers.conditions) conditions.add(condition)
    }

    for (const slug of new Set([
      RITUAL_KNOWLEDGE_ELEMENT_SLUG,
      advance.source,
      ...ritual.ingredients,
    ])) {
      addReachabilityBlockers(slug)
    }

    for (const slug of new Set([
      advance.target,
      ...advance.ingredients.map(([ingredient]) => ingredient),
    ])) {
      if (contentIsAvailable(slug)) continue
      hasDependencyBlocker = true
      if (elementBySlug.has(slug)) elements.add(slug)
      else conditions.add(`Referencia inexistente: ${slug}`)
    }

    finish(
      hasDependencyBlocker
        ? dependencySteps + 1
        : conditions.size > 0
          ? null
          : 0,
    )
  }

  return result
}
