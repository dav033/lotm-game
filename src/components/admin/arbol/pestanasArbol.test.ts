import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { normalizarPestanaArbol } from './pestanasArbol'

describe('normalizarPestanaArbol', () => {
  it('conserva las pestañas válidas al recargar', () => {
    assert.equal(normalizarPestanaArbol('fases'), 'fases')
    assert.equal(normalizarPestanaArbol('mapa-fases'), 'mapa-fases')
    assert.equal(normalizarPestanaArbol('mapa'), 'mapa')
    assert.equal(normalizarPestanaArbol(['caminos']), 'caminos')
  })

  it('usa el explorador para valores ausentes o desconocidos', () => {
    assert.equal(normalizarPestanaArbol(undefined), 'explorador')
    assert.equal(normalizarPestanaArbol('otra'), 'explorador')
    assert.equal(normalizarPestanaArbol([]), 'explorador')
  })
})
