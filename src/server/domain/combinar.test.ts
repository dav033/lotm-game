import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { PrismaClient } from '@/generated/prisma/client'
import { combinarParaPerfil } from './combinar'
import { buildPairInputKey } from './inputKey'

const profileId = 'profile'
const phase1 = {
  id: 'phase-1',
  slug: 'fase-1',
  name: 'Fase 1',
  sortOrder: 1,
  unlockAtDiscoveryCount: 0,
  isActive: true,
}

function elemento(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `id-${slug}`,
    slug,
    name: slug,
    description: '',
    iconKey: 'sparkles',
    imageUrl: null,
    type: 'MUNDANO',
    tier: 0,
    isMajorDiscovery: false,
    isActive: true,
    availableFromPhaseId: phase1.id,
    discoveries: [{ profileId }],
    ...overrides,
  }
}

// Mesa fija: Ojo y Moneda, ambos ya descubiertos por el perfil.
const ojo = elemento('ojo')
const moneda = elemento('moneda')
const inputKey = buildPairInputKey('ojo', 'moneda')

function crearTx(overrides: Partial<Record<string, unknown>> = {}) {
  const stats: unknown[] = []
  const discoveryCreates: unknown[] = []
  const base = {
    playerProfile: { update: async () => ({}) },
    playerCombinationStat: {
      upsert: async (args: unknown) => {
        stats.push(args)
        return {}
      },
    },
    playerDiscovery: {
      findUnique: async () => null,
      create: async (args: { data: { elementId: string } }) => {
        discoveryCreates.push(args)
        return {}
      },
      update: async () => ({}),
      findMany: async () => [],
    },
    playerPathwayUnlock: {
      findUnique: async () => null,
      create: async () => ({}),
      upsert: async () => ({}),
    },
    playerAdvance: {
      findUnique: async () => null,
      upsert: async () => ({}),
    },
    element: {
      findMany: async (args: { where?: { slug?: { in?: string[] }; isActive?: boolean }; select?: unknown }) => {
        if (args?.where?.slug?.in) {
          const bySlug = new Map([
            [ojo.slug, ojo],
            [moneda.slug, moneda],
          ])
          return args.where.slug.in.map((slug: string) => bySlug.get(slug)).filter(Boolean)
        }
        if (args?.where?.isActive === true) return [] // desbloqueosEspontaneos: sin candidatos
        return [] // todosLosElementos (select id/type)
      },
    },
    sequence: { findMany: async () => [] },
    progressionPhase: { findMany: async () => [phase1] },
    achievement: { findMany: async () => [] },
    ...overrides,
  }
  return { tx: base, stats, discoveryCreates }
}

function crearDb(tx: unknown) {
  return {
    element: (tx as { element: unknown }).element,
    recipe: { findFirst: async () => null },
    advance: { findUnique: async () => null },
    playerDiscovery: { findMany: async () => [] },
    progressionPhase: { findMany: async () => [phase1] },
    $transaction: async <T>(cb: (client: unknown) => Promise<T>) => cb(tx),
  } as unknown as PrismaClient
}

describe('memoryDelta de la Memoria del Aprendiz (combinación entre dos Elementos normales)', () => {
  it('NO_RECIPE genuino produce memoryDelta FAILED', async () => {
    const { tx, stats } = crearTx()
    const db = crearDb(tx)
    const result = await combinarParaPerfil(db, profileId, ['ojo', 'moneda'])
    assert.equal(result.kind, 'RESOLVED')
    if (result.kind !== 'RESOLVED') return
    assert.equal(result.success, false)
    assert.deepEqual(result.memoryDelta, { inputKey, status: 'FAILED' })
    assert.equal(stats.length, 1)
  })

  it('repetir el mismo par fallido sigue devolviendo la misma clave (una sola entrada en el Set del cliente)', async () => {
    const { tx } = crearTx()
    const db = crearDb(tx)
    const first = await combinarParaPerfil(db, profileId, ['ojo', 'moneda'])
    const second = await combinarParaPerfil(db, profileId, ['moneda', 'ojo'])
    assert.equal(first.kind, 'RESOLVED')
    assert.equal(second.kind, 'RESOLVED')
    if (first.kind !== 'RESOLVED' || second.kind !== 'RESOLVED') return
    assert.deepEqual(first.memoryDelta, second.memoryDelta)
  })

  it('una receta válida produce memoryDelta RESOLVED', async () => {
    const output = elemento('vision', { discoveries: [] })
    const { tx, discoveryCreates } = crearTx()
    const db = {
      element: (tx as { element: unknown }).element,
      recipe: {
        findFirst: async () => ({
          id: 'recipe-1',
          outputs: [
            {
              quantity: 1,
              chance: 1,
              sortOrder: 0,
              element: { ...output, sequence: null },
            },
          ],
        }),
      },
      advance: { findUnique: async () => null },
      playerDiscovery: { findMany: async () => [] },
      progressionPhase: { findMany: async () => [phase1] },
      $transaction: async <T>(cb: (client: unknown) => Promise<T>) => cb(tx),
    } as unknown as PrismaClient

    const result = await combinarParaPerfil(db, profileId, ['ojo', 'moneda'])
    assert.equal(result.kind, 'RESOLVED')
    if (result.kind !== 'RESOLVED') return
    assert.equal(result.success, true)
    assert.deepEqual(result.memoryDelta, { inputKey, status: 'RESOLVED' })
    assert.ok(discoveryCreates.length > 0)
  })

  it('formar un avance a partir de dos Elementos normales (sin receta) produce memoryDelta RESOLVED', async () => {
    const { tx } = crearTx()
    const db = {
      element: (tx as { element: unknown }).element,
      recipe: { findFirst: async () => null },
      advance: {
        findUnique: async () => ({
          id: 'advance-1',
          isActive: true,
          ingredients: [],
          sourceSequence: {
            element: { isActive: true, availableFromPhaseId: phase1.id },
            pathway: { isActive: true, name: 'Camino', iconKey: null },
          },
          targetSequence: {
            element: { isActive: true, availableFromPhaseId: phase1.id },
            pathway: { isActive: true },
          },
        }),
      },
      playerDiscovery: { findMany: async () => [] },
      progressionPhase: { findMany: async () => [phase1] },
      $transaction: async <T>(cb: (client: unknown) => Promise<T>) => cb(tx),
    } as unknown as PrismaClient

    const result = await combinarParaPerfil(db, profileId, ['ojo', 'moneda'])
    assert.equal(result.kind, 'RESOLVED')
    if (result.kind !== 'RESOLVED') return
    assert.equal(result.success, true)
    assert.deepEqual(result.memoryDelta, { inputKey, status: 'RESOLVED' })
  })

  it('una clave permitida de doble efecto entrega receta y avance en la misma acción', async () => {
    const output = elemento('horror', { discoveries: [] })
    const { tx } = crearTx()
    const db = {
      element: (tx as { element: unknown }).element,
      recipe: {
        findFirst: async () => ({
          id: 'recipe-dual',
          outputs: [
            {
              quantity: 1,
              chance: 1,
              sortOrder: 0,
              element: { ...output, sequence: null },
            },
          ],
        }),
      },
      advance: {
        findUnique: async () => ({
          id: 'advance-dual',
          isActive: true,
          ingredients: [],
          sourceSequence: {
            element: { isActive: true, availableFromPhaseId: phase1.id },
            pathway: { isActive: true, name: 'Camino', iconKey: null },
          },
          targetSequence: {
            element: { isActive: true, availableFromPhaseId: phase1.id },
            pathway: { isActive: true },
          },
        }),
      },
      playerDiscovery: { findMany: async () => [] },
      progressionPhase: { findMany: async () => [phase1] },
      $transaction: async <T>(cb: (client: unknown) => Promise<T>) => cb(tx),
    } as unknown as PrismaClient

    const result = await combinarParaPerfil(db, profileId, ['ojo', 'moneda'])
    assert.equal(result.kind, 'RESOLVED')
    if (result.kind !== 'RESOLVED') return
    assert.equal(result.success, true)
    assert.equal(result.results.length, 2)
    assert.equal(result.results.some((item) => item.element.kind === 'ADVANCE'), true)
    assert.equal(result.results.some((item) => item.element.kind === 'ELEMENT'), true)
  })
})
