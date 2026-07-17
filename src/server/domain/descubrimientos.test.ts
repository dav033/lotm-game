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

describe('desbloquearEspontaneos', () => {
  it('crea PlayerPathwayUnlock cuando un elemento de secuencia se desbloquea espontáneamente', async () => {
    const ELEM_SEQ = { id: 'elem-seq-1', isActive: true, type: 'SECUENCIA', unlockedByType: 'SECUENCIA' }
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
    const elemNormal = { id: 'elem-normal', isActive: true, type: 'NORMAL', unlockedByType: 'NORMAL' }
    let upsertLlamado = false

    const mockDb = {
      playerDiscovery: { findMany: async () => [], create: async () => ({}), upsert: async () => ({}) },
      element: { findMany: async () => [elemNormal] },
      sequence: { findMany: async () => [] },
      playerPathwayUnlock: { upsert: async () => { upsertLlamado = true; return {} } },
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
    const ELEM1 = { id: 'elem-1', isActive: true, type: 'SEQ', unlockedByType: 'SEQ' }
    const ELEM2 = { id: 'elem-2', isActive: true, type: 'SEQ', unlockedByType: 'SEQ' }
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
})
