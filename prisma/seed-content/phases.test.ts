import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildStaticSimInput } from './progression-input'
import { simulateProgression } from './progression-simulator'
import { BLOCKED_PHASE_FRONTIER_SLUGS, PHASE_2_AVAILABLE_SLUGS, PROGRESSION_PHASES } from './phases'
import { PHASE1_CLOSURE_SLUGS } from './progression'

describe('fases autoritativas', () => {
  it('separa aperturas manuales de cierres derivados', () => {
    assert.deepEqual([...PROGRESSION_PHASES[0].openingElementSlugs].sort(), [
      'humano',
      'moneda',
      'ojo',
      'tierra',
    ])
    assert.deepEqual([...PROGRESSION_PHASES[1].openingElementSlugs].sort(), [
      'agua',
      'beyonder',
      'misticismo',
    ])
    assert.equal(PHASE1_CLOSURE_SLUGS.length, 39)
    assert.equal(PHASE_2_AVAILABLE_SLUGS.length, 56)
  })

  it('retiene Edad como apertura de una Fase 3 inactiva', () => {
    assert.deepEqual(BLOCKED_PHASE_FRONTIER_SLUGS, ['edad'])
    assert.deepEqual(PROGRESSION_PHASES[2].openingElementSlugs, ['edad'])
    assert.equal(PROGRESSION_PHASES[2].isActive, false)
  })

  it('el simulador respeta exactamente ambos cierres', () => {
    const input = buildStaticSimInput()
    const phase1Input = {
      ...input,
      phases: input.phases?.map((phase) =>
        phase.sortOrder === 1
          ? phase
          : { ...phase, unlockAtDiscoveryCount: Number.MAX_SAFE_INTEGER },
      ),
    }
    assert.deepEqual(
      [...simulateProgression(phase1Input).discovered].sort(),
      [...PHASE1_CLOSURE_SLUGS].sort(),
    )
    assert.deepEqual(
      [...simulateProgression(input).discovered].sort(),
      [...PHASE_2_AVAILABLE_SLUGS].sort(),
    )
  })
})
