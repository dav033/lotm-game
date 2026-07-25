import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { discardCachedRemoteCards, localEditorSnapshot, mergeRemoteCards } from './remoteSync'

const local = { id: 'local-1', state: { name: 'Local' } }
const remote = { id: 'mcp:remote-1', remoteId: 'remote-1', source: 'mcp', state: { name: 'Remote' } }

describe('sincronizacion de cartas MCP', () => {
  it('no restaura cartas MCP eliminadas desde IndexedDB', () => {
    assert.deepEqual(discardCachedRemoteCards([remote, local]), [local])
  })

  it('una respuesta remota vacia elimina cartas MCP sin tocar las locales', () => {
    assert.deepEqual(mergeRemoteCards([remote, local], []), [local])
  })

  it('nunca persiste una seleccion o estado remoto en IndexedDB', () => {
    assert.deepEqual(localEditorSnapshot([remote, local], remote.id), {
      batch: [local],
      editingId: local.id,
      state: local.state,
    })
  })
})
