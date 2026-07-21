import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  evaluatePhaseRule,
  parsePhaseRule,
  phaseRuleSchema,
  summarizePhaseRule,
  type PhaseRule,
} from './phaseRules'

const nestedRule: PhaseRule = {
  type: 'OR',
  conditions: [
    {
      type: 'AND',
      conditions: [
        { type: 'DISCOVERY_COUNT', minimum: 8 },
        { type: 'DISCOVERY_PERCENTAGE', basisPoints: 8_000 },
      ],
    },
    { type: 'ELEMENT_DISCOVERED', elementSlug: 'seer' },
  ],
}

describe('reglas de avance de fase', () => {
  it('evalúa grupos AND/OR anidados', () => {
    assert.equal(evaluatePhaseRule(nestedRule, {
      discoveryCount: 8,
      reachableElementCount: 10,
      discoveredElementSlugs: new Set(),
    }), true)
    assert.equal(evaluatePhaseRule(nestedRule, {
      discoveryCount: 7,
      reachableElementCount: 10,
      discoveredElementSlugs: new Set(),
    }), false)
    assert.equal(evaluatePhaseRule(nestedRule, {
      discoveryCount: 1,
      reachableElementCount: 10,
      discoveredElementSlugs: new Set(['seer']),
    }), true)
  })

  it('calcula porcentajes sin redondear el progreso', () => {
    const rule: PhaseRule = { type: 'DISCOVERY_PERCENTAGE', basisPoints: 8_000 }
    assert.equal(evaluatePhaseRule(rule, {
      discoveryCount: 33,
      reachableElementCount: 42,
      discoveredElementSlugs: new Set(),
    }), false)
    assert.equal(evaluatePhaseRule(rule, {
      discoveryCount: 34,
      reachableElementCount: 42,
      discoveredElementSlugs: new Set(),
    }), true)
  })

  it('convierte datos heredados y resume la expresión completa', () => {
    assert.deepEqual(parsePhaseRule('{mal json', 12), {
      type: 'DISCOVERY_COUNT',
      minimum: 12,
    })
    assert.equal(
      summarizePhaseRule(nestedRule, new Map([['seer', 'Vidente']])),
      '(Descubrir 8 elementos Y Descubrir 80% del cierre alcanzable) O Descubrir Vidente',
    )
    assert.equal(phaseRuleSchema.safeParse({ type: 'AND', conditions: [] }).success, false)
  })
})
