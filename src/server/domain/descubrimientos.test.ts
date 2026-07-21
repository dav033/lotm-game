import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { desbloquearEspontaneos } from './descubrimientos'
import type { Db } from '../db'

type SequenceFindManyArgs = {
  where?: { elementId?: { in?: string[] } }
}

type PathwayUnlockUpsertArgs = {
  create: { profileId: string; pathwayId: string; unlockedAt: Date }
}

const phase = { id: 'phase-1', sortOrder: 1, unlockAtDiscoveryCount: 0, isActive: true }
const progressionPhase = { findMany: async () => [phase] }

describe('desbloquearEspontaneos', () => {
  it('concede la apertura de fase pero no descubre un elemento global sin ruta', async () => {
    const created: string[] = []
    const opening = {
      id: 'opening',
      isActive: true,
      availableFromPhaseId: phase.id,
      type: 'CONCEPTO',
      unlockedByType: null,
      unlockedBySequenceNumber: null,
      unlockedAtDiscoveryCount: null,
      unlockTriggers: [],
      unlockRequirements: [],
    }
    const global = { ...opening, id: 'global', availableFromPhaseId: null }
    const mockDb = {
      playerDiscovery: {
        findMany: async () => [],
        create: async ({ data }: { data: { elementId: string } }) => {
          created.push(data.elementId)
          return {}
        },
      },
      element: { findMany: async () => [opening, global] },
      sequence: { findMany: async () => [] },
      playerPathwayUnlock: { upsert: async () => ({}) },
      progressionPhase,
    } as unknown as Db

    await desbloquearEspontaneos(mockDb, 'profile-1', [], new Date())
    assert.deepEqual(created, ['opening'])
  })

  it('crea PlayerPathwayUnlock cuando un elemento de secuencia se desbloquea espontáneamente', async () => {
    const ELEM_SEQ = {
      id: 'elem-seq-1',
      isActive: true,
      availableFromPhaseId: phase.id,
      type: 'SECUENCIA',
      unlockedByType: 'SECUENCIA',
      unlockedBySequenceNumber: null,
      unlockTriggers: [],
      unlockRequirements: [],
    }
    const SECUENCIA = { id: 'seq-1', elementId: 'elem-seq-1', pathwayId: 'pathway-seq-1', number: 1, isActive: true }
    const upsertCalls: PathwayUnlockUpsertArgs[] = []

    const mockDb = {
      playerDiscovery: {
        findMany: async () => [],
        create: async () => ({}),
        upsert: async () => ({}),
      },
      element: {
        findMany: async () => [ELEM_SEQ],
      },
      sequence: {
        findMany: async (args?: SequenceFindManyArgs) => {
          const ids = args?.where?.elementId?.in ?? []
          return ids.includes('elem-seq-1') ? [SECUENCIA] : []
        },
      },
      playerPathwayUnlock: {
        upsert: async (args: PathwayUnlockUpsertArgs) => { upsertCalls.push(args); return {} },
      },
      progressionPhase,
    } as unknown as Db

    const descubiertos = await desbloquearEspontaneos(
      mockDb,
      'profile-1',
      [{ id: 'trigger-1', type: 'SECUENCIA' }],
      new Date(),
    )

    // Verificar que se encontraron descubrimientos
    assert.equal(descubiertos.length, 1, `esperado 1, obtenido ${descubiertos.length}`)
    assert.equal(descubiertos[0].id, 'elem-seq-1')

    // Verificar que se llamó upsert para PlayerPathwayUnlock
    assert.equal(upsertCalls.length, 1, `upsert llamado ${upsertCalls.length} veces`)
    assert.equal(upsertCalls[0].create.profileId, 'profile-1')
    assert.equal(upsertCalls[0].create.pathwayId, 'pathway-seq-1')
  })

  it('no crea PlayerPathwayUnlock cuando se desbloquean elementos sin secuencia', async () => {
    const elemNormal = {
      id: 'elem-normal',
      isActive: true,
      availableFromPhaseId: phase.id,
      type: 'NORMAL',
      unlockedByType: 'NORMAL',
      unlockedBySequenceNumber: null,
      unlockTriggers: [],
      unlockRequirements: [],
    }
    let upsertLlamado = false

    const mockDb = {
      playerDiscovery: { findMany: async () => [], create: async () => ({}), upsert: async () => ({}) },
      element: { findMany: async () => [elemNormal] },
      sequence: { findMany: async () => [] },
      playerPathwayUnlock: { upsert: async () => { upsertLlamado = true; return {} } },
      progressionPhase,
    } as unknown as Db

    const descubiertos = await desbloquearEspontaneos(
      mockDb,
      'profile-1',
      [{ id: 'trigger-1', type: 'NORMAL' }],
      new Date(),
    )

    assert.equal(descubiertos.length, 1)
    assert.equal(upsertLlamado, false)
  })

  it('evita duplicados de PlayerPathwayUnlock para mismo pathway', async () => {
    const ELEM1 = {
      id: 'elem-1',
      isActive: true,
      availableFromPhaseId: phase.id,
      type: 'SEQ',
      unlockedByType: 'SEQ',
      unlockedBySequenceNumber: null,
      unlockTriggers: [],
      unlockRequirements: [],
    }
    const ELEM2 = {
      id: 'elem-2',
      isActive: true,
      availableFromPhaseId: phase.id,
      type: 'SEQ',
      unlockedByType: 'SEQ',
      unlockedBySequenceNumber: null,
      unlockTriggers: [],
      unlockRequirements: [],
    }
    const SEQ1 = { id: 'seq-1', elementId: 'elem-1', pathwayId: 'pathway-1', number: 1, isActive: true }
    const SEQ2 = { id: 'seq-2', elementId: 'elem-2', pathwayId: 'pathway-1', number: 2, isActive: true }
    const upsertCalls: PathwayUnlockUpsertArgs[] = []

    const mockDb = {
      playerDiscovery: { findMany: async () => [], create: async () => ({}), upsert: async () => ({}) },
      element: { findMany: async () => [ELEM1, ELEM2] },
      sequence: {
        findMany: async (args?: SequenceFindManyArgs) => {
          const ids = args?.where?.elementId?.in ?? []
          const r: (typeof SEQ1 | typeof SEQ2)[] = []
          if (ids.includes('elem-1')) r.push(SEQ1)
          if (ids.includes('elem-2')) r.push(SEQ2)
          return r
        },
      },
      playerPathwayUnlock: { upsert: async (args: PathwayUnlockUpsertArgs) => { upsertCalls.push(args); return {} } },
      progressionPhase,
    } as unknown as Db

    await desbloquearEspontaneos(
      mockDb,
      'profile-1',
      [{ id: 'trigger-1', type: 'SEQ' }],
      new Date(),
    )

    // Solo un upsert aunque se desbloqueen dos secuencias del mismo camino.
    assert.equal(upsertCalls.length, 1, `upsert llamado ${upsertCalls.length} veces`)
    assert.equal(upsertCalls[0].create.pathwayId, 'pathway-1')
  })

  it('no descubre una secuencia cuyo pathway está inactivo', async () => {
    const inactiveSequenceElement = {
      id: 'inactive-sequence-element',
      isActive: true,
      availableFromPhaseId: phase.id,
      type: 'BEYONDER',
      unlockedByType: 'MUNDANO',
      unlockedBySequenceNumber: null,
      unlockedAtDiscoveryCount: null,
      unlockTriggers: [],
      unlockRequirements: [],
      sequence: { pathway: { isActive: false } },
    }
    let created = false
    const mockDb = {
      playerDiscovery: {
        findMany: async () => [],
        create: async () => { created = true; return {} },
      },
      element: { findMany: async () => [inactiveSequenceElement] },
      sequence: { findMany: async () => [] },
      playerPathwayUnlock: { upsert: async () => ({}) },
      progressionPhase,
    } as unknown as Db

    const result = await desbloquearEspontaneos(
      mockDb,
      'profile-1',
      [{ id: 'trigger-1', type: 'MUNDANO' }],
      new Date(),
    )

    assert.deepEqual(result, [])
    assert.equal(created, false)
  })
})
