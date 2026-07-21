import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { PrismaClient } from '@/generated/prisma/client'
import { importarContenido, ImportError, validarDocumento } from './datos'

function database(deleted: string[]): PrismaClient {
  const remove = (name: string) => ({
    deleteMany: async () => {
      deleted.push(name)
      return { count: 0 }
    },
  })
  const count = async () => 0
  const tx = {
    playerDiscovery: { count },
    playerPathwayUnlock: { count },
    playerAdvance: { count },
    playerRitual: { count },
    playerAchievement: { count },
    playerCombinationStat: { count },
    recipeIngredient: remove('recipes-ingredients'),
    recipe: remove('recipes'),
    advance: remove('advances'),
    achievement: remove('achievements'),
    sequence: remove('sequences'),
    pathway: remove('pathways'),
    elementCategory: remove('element-categories'),
    element: {
      ...remove('elements'),
      count,
      updateMany: async () => ({ count: 0 }),
    },
    progressionPhase: {
      ...remove('phases'),
      findMany: async () => [],
      findFirst: async () => null,
    },
    featureGate: { upsert: async () => ({}) },
    category: remove('categories'),
    playerProfile: { findMany: async () => [] },
  }
  return {
    $transaction: async (callback: (client: typeof tx) => unknown) => callback(tx),
  } as unknown as PrismaClient
}

describe('importarContenido', () => {
  it('elimina las fases existentes al reemplazar el catálogo', async () => {
    const deleted: string[] = []
    await importarContenido(database(deleted), { version: 2 }, 'reemplazar')
    assert.equal(deleted.includes('phases'), true)
    assert.ok(deleted.indexOf('elements') < deleted.indexOf('phases'))
  })

  it('conserva las fases ausentes al fusionar', async () => {
    const deleted: string[] = []
    await importarContenido(database(deleted), { version: 2 }, 'fusionar')
    assert.equal(deleted.includes('phases'), false)
  })

  it('normaliza fases v2 a reglas explícitas y exige fases en v3', () => {
    const legacy = validarDocumento({
      version: 2,
      fases: [{
        slug: 'fase-2',
        name: 'Fase 2',
        sortOrder: 2,
        unlockAtDiscoveryCount: 42,
      }],
    })
    assert.deepEqual(legacy.doc.fases[0].advancementRule, {
      type: 'DISCOVERY_COUNT',
      minimum: 42,
    })
    assert.equal(legacy.doc.version, 5)
    assert.deepEqual(legacy.doc.featureGates, [])
    assert.throws(() => validarDocumento({ version: 3 }), ImportError)
  })

  it('valida e importa la configuración de features', async () => {
    const raw = {
      version: 5,
      fases: [],
      featureGates: [{ key: 'ADVANCEMENT_RITUALS', minimumPhaseSortOrder: 6 }],
    }
    assert.equal(validarDocumento(raw).resumen.featureGates, 1)
    await importarContenido(database([]), raw, 'fusionar')
  })
})
