import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { useJuegoStore } from './store'

describe('confirmación ritual en el store', () => {
  it('cancelar cierra el desafío sin enviar otra petición', () => {
    let requests = 0
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
      requests += 1
      throw new Error('No debería ejecutarse')
    }) as typeof fetch

    try {
      useJuegoStore.setState({
        combinando: false,
        pendingRitualRisk: {
          elementos: ['advance-test', 'source'],
          opciones: { origen: 'mesa' },
        },
      })
      useJuegoStore.getState().cancelarRiesgoRitual()

      assert.equal(useJuegoStore.getState().pendingRitualRisk, null)
      assert.equal(requests, 0)
    } finally {
      globalThis.fetch = originalFetch
      useJuegoStore.setState({ pendingRitualRisk: null, combinando: false })
    }
  })
})
