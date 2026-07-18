export const RITUAL_KNOWLEDGE_ELEMENT_SLUG = 'ritual' as const

export type RitualKnowledgeStatus = 'HIDDEN' | 'SEALED' | 'UNLOCKED'

export type PublicRitualIngredient = {
  name: string
  iconKey: string
  quantity: number
  discovered: boolean
}

export type PublicRitualOption = {
  ritualId: string
  optionLabel: string
  completed: boolean
  canPerform: boolean
  ingredients: PublicRitualIngredient[]
}

export type PublicRitualGroup = {
  groupKey: string
  sourceSequence: {
    elementId: string
    name: string
    number: number
    pathwayName: string
    iconKey: string
  }
  protected: boolean
  options: PublicRitualOption[]
}

export type PublicRitualState =
  | { status: 'HIDDEN'; groups: [] }
  | { status: 'SEALED'; groups: [] }
  | { status: 'UNLOCKED'; groups: PublicRitualGroup[] }

export type RitualKnowledgeCandidate = {
  id: string
  advanceId: string
  isActive: boolean
  advance: {
    isActive: boolean
    sourceSequence: {
      number: number
      elementId: string
      element: { id: string; name: string; iconKey: string; isActive: boolean }
      pathway: { name: string; isActive: boolean }
    }
    targetSequence: {
      elementId: string
      element: { isActive: boolean }
      pathway: { isActive: boolean }
    }
  }
  ingredients: Array<{
    elementId: string
    quantity: number
    element: { name: string; iconKey: string; isActive: boolean }
  }>
  players: Array<{ profileId: string }>
}

export type RitualKnowledgeSnapshot = {
  discoveredElementIds: ReadonlySet<string>
  discoveredSlugs: ReadonlySet<string>
  rituals: RitualKnowledgeCandidate[]
}

export function esRitualRelevante(
  ritual: RitualKnowledgeCandidate,
  discoveredElementIds: ReadonlySet<string>,
): boolean {
  const { advance } = ritual
  return (
    ritual.isActive &&
    advance.isActive &&
    advance.sourceSequence.element.isActive &&
    advance.targetSequence.element.isActive &&
    advance.sourceSequence.pathway.isActive &&
    advance.targetSequence.pathway.isActive &&
    discoveredElementIds.has(advance.sourceSequence.elementId) &&
    !discoveredElementIds.has(advance.targetSequence.elementId)
  )
}

function romanOption(index: number): string {
  const values: Array<[number, string]> = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ]
  let remaining = index
  let result = ''
  for (const [value, symbol] of values) {
    while (remaining >= value) {
      result += symbol
      remaining -= value
    }
  }
  return result
}

export function calcularEstadoRitual(snapshot: RitualKnowledgeSnapshot): PublicRitualState {
  const relevant = snapshot.rituals.filter((ritual) =>
    esRitualRelevante(ritual, snapshot.discoveredElementIds),
  )
  if (relevant.length === 0) return { status: 'HIDDEN', groups: [] }
  if (!snapshot.discoveredSlugs.has(RITUAL_KNOWLEDGE_ELEMENT_SLUG)) {
    return { status: 'SEALED', groups: [] }
  }

  const byAdvance = new Map<string, RitualKnowledgeCandidate[]>()
  for (const ritual of relevant) {
    const options = byAdvance.get(ritual.advanceId) ?? []
    options.push(ritual)
    byAdvance.set(ritual.advanceId, options)
  }

  const groups = [...byAdvance.values()].map((rituals, groupIndex) => {
    const first = rituals[0]
    const protectedGroup = rituals.some((ritual) => ritual.players.length > 0)
    const options = rituals.map((ritual, optionIndex): PublicRitualOption => {
      const completed = ritual.players.length > 0
      const ingredients = ritual.ingredients.map((ingredient) => ({
        name: ingredient.element.name,
        iconKey: ingredient.element.iconKey,
        quantity: ingredient.quantity,
        discovered:
          ingredient.element.isActive &&
          snapshot.discoveredElementIds.has(ingredient.elementId),
      }))
      return {
        ritualId: ritual.id,
        optionLabel:
          rituals.length === 1 ? 'Preparación ritual' : `Método ${romanOption(optionIndex + 1)}`,
        completed,
        canPerform:
          !protectedGroup &&
          !completed &&
          ingredients.every((ingredient) => ingredient.discovered),
        ingredients,
      }
    })

    return {
      groupKey: `ascension-${first.advance.sourceSequence.elementId}-${groupIndex + 1}`,
      sourceSequence: {
        elementId: first.advance.sourceSequence.element.id,
        name: first.advance.sourceSequence.element.name,
        number: first.advance.sourceSequence.number,
        pathwayName: first.advance.sourceSequence.pathway.name,
        iconKey: first.advance.sourceSequence.element.iconKey,
      },
      protected: protectedGroup,
      options,
    }
  })

  return { status: 'UNLOCKED', groups }
}
