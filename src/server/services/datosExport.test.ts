import assert from 'node:assert/strict'
import test from 'node:test'
import type { PrismaClient } from '@/generated/prisma/client'
import {
  exportarContenido,
  exportarElementosYCombinaciones,
  validarDocumento,
} from './datos'

const phase = {
  id: 'phase-1',
  slug: 'fase-1',
  name: 'Fase 1',
  description: 'Inicio',
  sortOrder: 1,
  unlockAtDiscoveryCount: 0,
  advancementRuleJson: '{"type":"ALWAYS"}',
  isActive: true,
  createdAt: new Date('2026-07-20T00:00:00.000Z'),
  updatedAt: new Date('2026-07-20T00:00:00.000Z'),
  elements: [],
}

function emptyDatabase(): PrismaClient {
  const findMany = async () => []
  return {
    progressionPhase: { findMany: async () => [phase] },
    featureGate: {
      findMany: async () => [{ key: 'ADVANCEMENT_RITUALS', minimumPhaseSortOrder: 6 }],
    },
    category: { findMany },
    element: { findMany },
    pathway: { findMany },
    sequence: { findMany },
    recipe: { findMany },
    advance: { findMany },
    ritual: { findMany },
    achievement: { findMany },
    elementUnlockTrigger: { findMany },
  } as unknown as PrismaClient
}

test('ambas exportaciones incluyen siempre fases y reglas explícitas', async () => {
  const db = emptyDatabase()
  const backup = await exportarContenido(db)
  const nominal = await exportarElementosYCombinaciones(db)

  assert.equal(backup.version, 5)
  assert.deepEqual(backup.fases[0].advancementRule, { type: 'ALWAYS' })
  assert.equal(backup.featureGates[0].minimumPhaseSortOrder, 6)
  assert.equal(validarDocumento(backup).resumen.fases, 1)

  assert.equal(nominal.version, 4)
  assert.equal(nominal.fases[0].tipo, 'FASE')
  assert.deepEqual(nominal.fases[0].reglaAvance, { type: 'ALWAYS' })
})
