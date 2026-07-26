import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseSequenceReach } from './sequencePips'

describe('parseSequenceReach', () => {
  it('lee una secuencia suelta', () => {
    assert.deepEqual(parseSequenceReach('Authority · Seq 0'), { full: 0, partial: null })
    assert.deepEqual(parseSequenceReach('Seq 2 · From Bizarreness'), { full: 2, partial: null })
  })

  it('lee un rango y pone el control completo en la secuencia mas baja', () => {
    assert.deepEqual(parseSequenceReach('Authority · Seq 1→0'), { full: 0, partial: 1 })
    assert.deepEqual(parseSequenceReach('Seq 1 -> 0'), { full: 0, partial: 1 })
  })

  it('devuelve null cuando el kicker no menciona secuencia', () => {
    assert.equal(parseSequenceReach('Authority · From Bizarreness'), null)
    assert.equal(parseSequenceReach(''), null)
  })
})
