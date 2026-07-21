import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  calcularEstadoRitual,
  type RitualKnowledgeCandidate,
  type RitualKnowledgeSnapshot,
} from './ritualKnowledge'

function candidate({
  id = 'ritual-escriba',
  advanceId = 'advance-escriba',
  sourceId = 'escriba-id',
  sourceName = 'Escriba',
  targetId = 'traveler-id',
  ritualActive = true,
  advanceActive = true,
  sourcePathwayActive = true,
  targetPathwayActive = true,
  completed = false,
}: {
  id?: string
  advanceId?: string
  sourceId?: string
  sourceName?: string
  targetId?: string
  ritualActive?: boolean
  advanceActive?: boolean
  sourcePathwayActive?: boolean
  targetPathwayActive?: boolean
  completed?: boolean
} = {}): RitualKnowledgeCandidate {
  return {
    id,
    advanceId,
    isActive: ritualActive,
    advance: {
      isActive: advanceActive,
      sourceSequence: {
        number: 6,
        elementId: sourceId,
        element: {
          id: sourceId,
          name: sourceName,
          iconKey: 'book-open',
          isActive: true,
        },
        pathway: { name: `Camino de ${sourceName}`, isActive: sourcePathwayActive },
      },
      targetSequence: {
        elementId: targetId,
        element: { isActive: true },
        pathway: { isActive: targetPathwayActive },
      },
    },
    ingredients: [
      {
        elementId: 'ingredient-a',
        quantity: 1,
        element: { name: 'Ingrediente A', iconKey: 'sparkles', isActive: true },
      },
      {
        elementId: 'ingredient-b',
        quantity: 1,
        element: { name: 'Ingrediente B', iconKey: 'moon', isActive: true },
      },
    ],
    players: completed ? [{ profileId: 'profile' }] : [],
  }
}

function state(
  rituals: RitualKnowledgeCandidate[],
  discoveredIds: string[],
  knowsRitual = false,
) {
  const snapshot: RitualKnowledgeSnapshot = {
    rituals,
    discoveredElementIds: new Set(discoveredIds),
    discoveredSlugs: new Set(knowsRitual ? ['ritual'] : []),
  }
  return calcularEstadoRitual(snapshot)
}

describe('calcularEstadoRitual', () => {
  it('oculta el panel sin una secuencia origen exacta relevante', () => {
    assert.deepEqual(state([candidate()], []), { status: 'HIDDEN', groups: [] })
    assert.deepEqual(state([candidate()], [], true), { status: 'HIDDEN', groups: [] })
  })

  it('sella el estado al alcanzar el origen exacto sin conocimiento ritual', () => {
    const result = state([candidate()], ['escriba-id'])
    assert.deepEqual(result, { status: 'SEALED', groups: [] })
    assert.equal(JSON.stringify(result), '{"status":"SEALED","groups":[]}')
  })

  it('no usa una secuencia ajena con el mismo número', () => {
    assert.deepEqual(state([candidate()], ['otra-secuencia-6'], true), {
      status: 'HIDDEN',
      groups: [],
    })
  })

  it('desbloquea únicamente los grupos de orígenes exactos descubiertos', () => {
    const rituals = [
      candidate(),
      candidate({
        id: 'ritual-prometheus',
        advanceId: 'advance-prometheus',
        sourceId: 'prometheus-id',
        sourceName: 'Prometheus',
        targetId: 'dream-stealer-id',
      }),
    ]
    const result = state(rituals, ['escriba-id', 'ingredient-a'], true)
    assert.equal(result.status, 'UNLOCKED')
    assert.equal(result.groups.length, 1)
    assert.equal(result.groups[0].sourceSequence.name, 'Escriba')
    assert.equal(result.groups[0].options[0].ingredients[0].discovered, true)
    assert.equal(result.groups[0].options[0].ingredients[1].discovered, false)
  })

  it('retira el grupo al descubrir la secuencia destino', () => {
    assert.deepEqual(state([candidate()], ['escriba-id', 'traveler-id'], true), {
      status: 'HIDDEN',
      groups: [],
    })
  })

  it('excluye rituales, avances y caminos inactivos', () => {
    for (const ritual of [
      candidate({ ritualActive: false }),
      candidate({ advanceActive: false }),
      candidate({ sourcePathwayActive: false }),
      candidate({ targetPathwayActive: false }),
    ]) {
      assert.equal(state([ritual], ['escriba-id'], true).status, 'HIDDEN')
    }
  })

  it('agrupa alternativas y una sola preparación protege toda la ascensión', () => {
    const result = state(
      [
        candidate({ id: 'ritual-a', completed: true }),
        candidate({ id: 'ritual-b' }),
        candidate({
          id: 'ritual-ajeno',
          advanceId: 'advance-ajeno',
          sourceId: 'prometheus-id',
          sourceName: 'Prometheus',
          targetId: 'dream-stealer-id',
          completed: true,
        }),
      ],
      ['escriba-id', 'ingredient-a', 'ingredient-b'],
      true,
    )
    assert.equal(result.status, 'UNLOCKED')
    assert.equal(result.groups.length, 1)
    assert.equal(result.groups[0].protected, true)
    assert.equal(result.groups[0].options.length, 2)
    assert.deepEqual(
      result.groups[0].options.map((option) => option.optionLabel),
      ['Método I', 'Método II'],
    )
    assert.equal(result.groups[0].options[1].canPerform, false)
  })

  it('no publica metadatos del destino ni nombres internos del avance', () => {
    const result = state([candidate()], ['escriba-id', 'ingredient-a', 'ingredient-b'], true)
    const json = JSON.stringify(result)
    for (const forbidden of [
      'advanceId',
      'targetSequence',
      'targetSequenceId',
      'internalName',
      'Traveler',
      'failureOutput',
    ]) {
      assert.equal(json.includes(forbidden), false, `La respuesta expone ${forbidden}`)
    }
  })

})
