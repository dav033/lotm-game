import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Db } from '../db'
import { realizarRitual, RitualError } from './rituales'
import type { RitualKnowledgeCandidate } from './ritualKnowledge'

type Config = {
  knowledge?: boolean
  source?: boolean
  target?: boolean
  ingredient?: boolean
  activeContent?: boolean
  alternativeCompleted?: boolean
}

function createDb(config: Config = {}) {
  const completed = new Set<string>()
  let upsertCalls = 0
  const discoveries = () => {
    const rows = []
    if (config.knowledge !== false) rows.push({ elementId: 'knowledge', element: { slug: 'ritual' } })
    if (config.source !== false) rows.push({ elementId: 'source', element: { slug: 'escriba' } })
    if (config.target) rows.push({ elementId: 'target', element: { slug: 'traveler' } })
    if (config.ingredient !== false) rows.push({ elementId: 'ingredient', element: { slug: 'ingredient' } })
    return rows
  }
  const candidate = (): RitualKnowledgeCandidate => ({
    id: 'ritual-1',
    advanceId: 'advance-1',
    isActive: true,
    advance: {
      isActive: config.activeContent !== false,
      sourceSequence: {
        number: 6,
        elementId: 'source',
        element: { id: 'source', name: 'Escriba', iconKey: 'book', isActive: true },
        pathway: { name: 'Puerta', isActive: true },
      },
      targetSequence: {
        elementId: 'target',
        element: { isActive: true },
        pathway: { isActive: true },
      },
    },
    ingredients: [
      {
        elementId: 'ingredient',
        quantity: 1,
        element: { name: 'Ingrediente', iconKey: 'sparkles', isActive: true },
      },
    ],
    players: completed.has('ritual-1') ? [{ profileId: 'profile' }] : [],
  })
  const context = {
    id: 'ritual-1',
    advance: {
      isActive: config.activeContent !== false,
      sourceSequence: {
        elementId: 'source',
        element: { isActive: true },
        pathway: { isActive: true },
      },
      targetSequence: {
        elementId: 'target',
        element: { isActive: true },
        pathway: { isActive: true },
      },
      rituals: [
        { id: 'ritual-1', players: [] },
        ...(config.alternativeCompleted
          ? [{ id: 'ritual-2', players: [{ profileId: 'profile' }] }]
          : []),
      ],
    },
    ingredients: [{ elementId: 'ingredient', element: { isActive: true } }],
  }
  const db = {
    ritual: {
      findFirst: async () => context,
      findMany: async () => {
        const requested = candidate()
        return config.alternativeCompleted
          ? [
              requested,
              {
                ...requested,
                id: 'ritual-2',
                players: [{ profileId: 'profile' }],
              },
            ]
          : [requested]
      },
    },
    playerDiscovery: { findMany: async () => discoveries() },
    playerRitual: {
      upsert: async () => {
        upsertCalls += 1
        completed.add('ritual-1')
        return {}
      },
    },
  } as unknown as Db

  return { db, completed, upsertCalls: () => upsertCalls }
}

async function expectCode(config: Config, code: RitualError['code']) {
  const { db } = createDb(config)
  await assert.rejects(
    () => realizarRitual(db, 'profile', 'ritual-1'),
    (error: unknown) => error instanceof RitualError && error.code === code,
  )
}

describe('realizarRitual', () => {
  it('rechaza sin conocimiento ritual', async () => {
    await expectCode({ knowledge: false }, 'KNOWLEDGE_REQUIRED')
  })

  it('rechaza sin la secuencia origen exacta', async () => {
    await expectCode({ source: false }, 'SOURCE_REQUIRED')
  })

  it('rechaza ingredientes incompletos', async () => {
    await expectCode({ ingredient: false }, 'INGREDIENTS_REQUIRED')
  })

  it('rechaza un destino ya descubierto', async () => {
    await expectCode({ target: true }, 'TARGET_DISCOVERED')
  })

  it('completa mediante upsert, devuelve el estado actualizado y es idempotente', async () => {
    const fixture = createDb()
    const first = await realizarRitual(fixture.db, 'profile', 'ritual-1')
    const second = await realizarRitual(fixture.db, 'profile', 'ritual-1')

    assert.equal(first.ok, true)
    assert.equal(first.ritualState.status, 'UNLOCKED')
    assert.equal(first.ritualState.groups[0].protected, true)
    assert.equal(second.ritualState.status, 'UNLOCKED')
    assert.equal(fixture.completed.size, 1)
    assert.equal(fixture.upsertCalls(), 2)
  })

  it('no crea preparaciones redundantes si otra alternativa ya protege el avance', async () => {
    const fixture = createDb({ alternativeCompleted: true })
    const result = await realizarRitual(fixture.db, 'profile', 'ritual-1')
    assert.equal(result.ritualState.status, 'UNLOCKED')
    assert.equal(result.ritualState.groups[0].protected, true)
    assert.equal(fixture.upsertCalls(), 0)
  })
})
