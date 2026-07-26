import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { titleSizeClass } from './titleFit'

describe('titleSizeClass', () => {
  it('deja los nombres cortos en la talla mayor', () => {
    assert.equal(titleSizeClass('Door'), 'xl')
    assert.equal(titleSizeClass('Seals'), 'xl')
    assert.equal(titleSizeClass('Space'), 'xl')
  })

  it('baja la talla cuando una sola palabra no cabe', () => {
    assert.equal(titleSizeClass('Position'), 'lg')
    assert.equal(titleSizeClass('Concealment'), 'md')
    assert.equal(titleSizeClass('Replication'), 'md')
  })

  it('mide la palabra mas larga, no el total: los espacios ya reparten lineas', () => {
    // "Alternate" (9) manda, aunque el titulo entero tenga 16 caracteres.
    assert.equal(titleSizeClass('Alternate Worlds'), 'lg')
    assert.equal(titleSizeClass('Where the powers come from'), 'xl')
  })

  it('tolera vacio', () => {
    assert.equal(titleSizeClass(''), 'xl')
  })
})
