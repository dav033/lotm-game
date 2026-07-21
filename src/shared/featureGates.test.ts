import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveFeatureState } from './featureGates'

describe('resolveFeatureState', () => {
  it('abre la feature al alcanzar su fase mínima y falla cerrado si falta configuración', () => {
    const gate = [{ key: 'ADVANCEMENT_RITUALS', minimumPhaseSortOrder: 6 }]
    assert.equal(resolveFeatureState(gate, 5).ADVANCEMENT_RITUALS, false)
    assert.equal(resolveFeatureState(gate, 6).ADVANCEMENT_RITUALS, true)
    assert.equal(resolveFeatureState([], 99).ADVANCEMENT_RITUALS, false)
  })
})
