import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  elementoDisponibleEnFase,
  elementoDisponiblePorPhaseId,
  phaseOrderAtDiscoveryCount,
  resolverFasePorDescubrimientos,
} from './fases'

const phases = [
  { sortOrder: 1, unlockAtDiscoveryCount: 0, isActive: true },
  { sortOrder: 2, unlockAtDiscoveryCount: 42, isActive: true },
]

describe('disponibilidad por fases', () => {
  it('cambia de Fase 1 a Fase 2 al alcanzar 42 descubrimientos', () => {
    assert.equal(phaseOrderAtDiscoveryCount(phases, 0), 1)
    assert.equal(phaseOrderAtDiscoveryCount(phases, 41), 1)
    assert.equal(phaseOrderAtDiscoveryCount(phases, 42), 2)
  })

  it('un elemento solo está disponible desde su fase asignada', () => {
    const phase2Element = {
      isActive: true,
      availableFromPhase: { sortOrder: 2, isActive: true },
    }
    assert.equal(elementoDisponibleEnFase(phase2Element, 1), false)
    assert.equal(elementoDisponibleEnFase(phase2Element, 2), true)
    assert.equal(elementoDisponibleEnFase({ ...phase2Element, availableFromPhase: null }, 1), true)
    assert.equal(
      elementoDisponiblePorPhaseId(
        { isActive: true, availableFromPhaseId: 'fase-2' },
        new Set(['fase-1']),
      ),
      false,
    )
    assert.equal(
      elementoDisponiblePorPhaseId(
        { isActive: true, availableFromPhaseId: null },
        new Set(['fase-1']),
      ),
      true,
    )
  })

  it('no deja que un descubrimiento reservado a una fase futura la abra por sí mismo', () => {
    const resolved = resolverFasePorDescubrimientos(
      [
        { id: 'fase-1', ...phases[0] },
        { id: 'fase-2', ...phases[1] },
      ],
      [...Array<string | null>(41).fill(null), 'fase-2'],
    )

    assert.equal(resolved.discoveryCount, 41)
    assert.equal(resolved.sortOrder, 1)
  })

  it('abre secuencialmente por porcentaje del cierre alcanzable', () => {
    const resolved = resolverFasePorDescubrimientos(
      [
        {
          id: 'fase-1',
          sortOrder: 1,
          unlockAtDiscoveryCount: 0,
          advancementRuleJson: '{"type":"ALWAYS"}',
          isActive: true,
        },
        {
          id: 'fase-2',
          sortOrder: 2,
          unlockAtDiscoveryCount: 10,
          advancementRuleJson: '{"type":"DISCOVERY_PERCENTAGE","basisPoints":8000}',
          isActive: true,
        },
      ],
      Array.from({ length: 8 }, (_, index) => ({
        availableFromPhaseId: null,
        elementSlug: `elemento-${index}`,
      })),
    )

    assert.equal(resolved.sortOrder, 2)
    assert.deepEqual([...resolved.availablePhaseIds], ['fase-1', 'fase-2'])
  })

  it('no satisface una regla con su propio elemento futuro', () => {
    const resolved = resolverFasePorDescubrimientos(
      [
        {
          id: 'fase-1',
          sortOrder: 1,
          unlockAtDiscoveryCount: 0,
          advancementRuleJson: '{"type":"ALWAYS"}',
          isActive: true,
        },
        {
          id: 'fase-2',
          sortOrder: 2,
          unlockAtDiscoveryCount: 10,
          advancementRuleJson: '{"type":"ELEMENT_DISCOVERED","elementSlug":"seer"}',
          isActive: true,
        },
      ],
      [{ availableFromPhaseId: 'fase-2', elementSlug: 'seer' }],
    )

    assert.equal(resolved.sortOrder, 1)
  })
})
