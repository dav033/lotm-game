import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { defaultPhaseCelebrationMessage } from './phaseCelebrations'

describe('defaultPhaseCelebrationMessage', () => {
  it('asigna las leyendas a la fase de destino', () => {
    assert.equal(defaultPhaseCelebrationMessage(1), '')
    assert.equal(defaultPhaseCelebrationMessage(2), 'Vas entendiendo cómo va esto.')
    assert.match(defaultPhaseCelebrationMessage(6), /rituales de ascensión/)
  })
})
