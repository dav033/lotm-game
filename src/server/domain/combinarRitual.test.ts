import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { PrismaClient } from '@/generated/prisma/client'
import { combinarParaPerfil, CombinationError } from './combinar'

const profileId = 'profile'
const phase = {
  id: 'phase-1',
  slug: 'fase-1',
  name: 'Fase 1',
  sortOrder: 1,
  unlockAtDiscoveryCount: 0,
  isActive: true,
}

function publicElement(id: string, slug = id) {
  return {
    id,
    slug,
    name: id,
    description: '',
    iconKey: 'sparkles',
    imageUrl: null,
    type: 'CONCEPTO',
    tier: 1,
    isMajorDiscovery: false,
    isActive: true,
    availableFromPhaseId: phase.id,
  }
}

function createFixture({
  featureEnabled = true,
  hasRitual = true,
  knowledge = true,
  prepared = false,
  targetDiscovered = false,
} = {}) {
  let ritualPrepared = prepared
  const writes = {
    profile: 0,
    stats: 0,
    advanceConsumed: 0,
    discovered: [] as string[],
  }
  const pathway = {
    id: 'pathway',
    name: 'Camino de Prueba',
    iconKey: null,
    categoryId: 'category',
    isActive: true,
  }
  const source = { ...publicElement('source'), discoveries: [{ profileId }] }
  const target = {
    ...publicElement('target'),
    discoveries: targetDiscovered ? [{ profileId }] : [],
  }
  const consequence = publicElement('consequence')

  const tx = {
    advance: {
      findUnique: async () => ({
        id: 'advance',
        isActive: true,
        ingredients: [],
        sourceSequence: {
          id: 'source-sequence',
          elementId: source.id,
          element: source,
          pathway,
          number: 6,
          name: 'Origen',
        },
        targetSequence: {
          id: 'target-sequence',
          elementId: target.id,
          element: target,
          pathway,
          number: 5,
          name: 'Destino oculto',
        },
        rituals: hasRitual ? [
          {
            id: 'ritual',
            isActive: true,
            players: ritualPrepared ? [{ profileId }] : [],
            failureOutputs: [{ elementId: consequence.id, element: consequence }],
          },
        ] : [],
      }),
    },
    element: {
      findUnique: async () => source,
      findMany: async () => [],
    },
    sequence: { findMany: async () => [] },
    playerAdvance: {
      findUnique: async () => ({ profileId, advanceId: 'advance', quantity: 1 }),
      delete: async () => {
        writes.advanceConsumed += 1
        return {}
      },
      update: async () => {
        writes.advanceConsumed += 1
        return {}
      },
    },
    playerDiscovery: {
      count: async () => 0,
      findFirst: async () => (knowledge ? { elementId: 'knowledge' } : null),
      findUnique: async () => null,
      findMany: async () => [],
      create: async ({ data }: { data: { elementId: string } }) => {
        writes.discovered.push(data.elementId)
        return {}
      },
    },
    playerProfile: {
      update: async () => {
        writes.profile += 1
        return {}
      },
    },
    playerCombinationStat: {
      upsert: async () => {
        writes.stats += 1
        return {}
      },
    },
    playerPathwayUnlock: {
      findUnique: async () => null,
      create: async () => ({}),
      upsert: async () => ({}),
    },
    achievement: { findMany: async () => [] },
    playerAchievement: { findMany: async () => [], create: async () => ({}) },
    category: { findUnique: async () => null },
    progressionPhase: { findMany: async () => [phase] },
    featureGate: {
      findMany: async () => [{
        key: 'ADVANCEMENT_RITUALS',
        minimumPhaseSortOrder: featureEnabled ? 1 : 2,
      }],
    },
  }
  const db = {
    playerDiscovery: tx.playerDiscovery,
    progressionPhase: tx.progressionPhase,
    featureGate: tx.featureGate,
    $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) => callback(tx),
  } as unknown as PrismaClient

  return {
    db,
    writes,
    setPrepared: (value: boolean) => {
      ritualPrepared = value
    },
  }
}

async function apply(fixture: ReturnType<typeof createFixture>, confirmRitualRisk = false) {
  return combinarParaPerfil(
    fixture.db,
    profileId,
    ['advance-advance', 'source'],
    { confirmRitualRisk },
  )
}

describe('aplicación de avances con ritual', () => {
  it('bloquea un avance ritualizado antes de la fase configurada sin mutar progreso', async () => {
    const fixture = createFixture({ featureEnabled: false, prepared: true })
    await assert.rejects(
      () => apply(fixture, true),
      (error: unknown) =>
        error instanceof CombinationError && /aún no están disponibles/.test(error.message),
    )
    assert.deepEqual(fixture.writes, {
      profile: 0,
      stats: 0,
      advanceConsumed: 0,
      discovered: [],
    })
  })

  it('permite avances sin ritual antes de la fase configurada', async () => {
    const fixture = createFixture({ featureEnabled: false, hasRitual: false })
    const result = await apply(fixture)
    assert.equal(result.kind, 'RESOLVED')
    assert.equal(result.kind === 'RESOLVED' && result.success, true)
    assert.equal(fixture.writes.advanceConsumed, 1)
  })

  it('bloquea sin conocimiento incluso si se intenta forzar la confirmación', async () => {
    for (const confirmed of [false, true]) {
      const fixture = createFixture({ knowledge: false })
      const result = await apply(fixture, confirmed)
      assert.equal(result.kind, 'RITUAL_KNOWLEDGE_REQUIRED')
      assert.deepEqual(fixture.writes, {
        profile: 0,
        stats: 0,
        advanceConsumed: 0,
        discovered: [],
      })
    }
  })

  it('solicita confirmación sin mutar progreso cuando falta preparación', async () => {
    const fixture = createFixture()
    const result = await apply(fixture)
    assert.equal(result.kind, 'RITUAL_PREPARATION_REQUIRED')
    assert.deepEqual(fixture.writes, {
      profile: 0,
      stats: 0,
      advanceConsumed: 0,
      discovered: [],
    })
  })

  it('tras confirmar ejecuta las consecuencias existentes sin consumir el avance ni descubrir el destino', async () => {
    const fixture = createFixture()
    const result = await apply(fixture, true)
    assert.equal(result.kind, 'RESOLVED')
    if (result.kind !== 'RESOLVED') return
    assert.equal(result.success, false)
    assert.deepEqual(result.results.map((item) => item.element.id), ['consequence'])
    assert.equal(fixture.writes.stats, 1)
    assert.equal(fixture.writes.advanceConsumed, 0)
    assert.deepEqual(fixture.writes.discovered, ['consequence'])
  })

  it('revalida al confirmar y asciende normalmente si una alternativa fue preparada entretanto', async () => {
    const fixture = createFixture()
    const challenge = await apply(fixture)
    assert.equal(challenge.kind, 'RITUAL_PREPARATION_REQUIRED')

    fixture.setPrepared(true)
    const result = await apply(fixture, true)
    assert.equal(result.kind, 'RESOLVED')
    if (result.kind !== 'RESOLVED') return
    assert.equal(result.success, true)
    assert.equal(fixture.writes.advanceConsumed, 1)
    assert.ok(fixture.writes.discovered.includes('target'))
    assert.equal(fixture.writes.discovered.includes('consequence'), false)
  })

  it('una confirmación obsoleta no registra intento ni produce consecuencias', async () => {
    const fixture = createFixture({ targetDiscovered: true })
    const result = await apply(fixture, true)
    assert.equal(result.kind, 'RESOLVED')
    assert.deepEqual(fixture.writes, {
      profile: 0,
      stats: 0,
      advanceConsumed: 0,
      discovered: [],
    })
  })
})
