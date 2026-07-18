import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { calcularRevisionMemoria, filtrarClavesValidas, type CombinationStatRow } from './memoriaAprendiz'
import { buildPairInputKey } from './inputKey'

function fila(inputKey: string, lastAttemptAt = new Date('2026-01-01')): CombinationStatRow {
  return { inputKey, lastAttemptAt }
}

describe('filtrarClavesValidas', () => {
  it('incluye un par de dos Elementos normales descubiertos', () => {
    const key = buildPairInputKey('ojo', 'moneda')
    const activos = new Set(['ojo', 'moneda'])
    const resultado = filtrarClavesValidas([fila(key)], (slug) => activos.has(slug))
    assert.deepEqual(resultado, [key])
  })

  it('incluye una autocombinación (cantidad 2 del mismo slug)', () => {
    const key = buildPairInputKey('ojo', 'ojo')
    const resultado = filtrarClavesValidas([fila(key)], () => true)
    assert.deepEqual(resultado, [key])
  })

  it('ignora una clave con más de dos unidades', () => {
    const key = 'ojo*3'
    const resultado = filtrarClavesValidas([fila(key)], () => true)
    assert.deepEqual(resultado, [])
  })

  it('ignora un par con un slug que referencia un Elemento inactivo o no descubierto', () => {
    const key = buildPairInputKey('ojo', 'secreto-oculto')
    const resultado = filtrarClavesValidas([fila(key)], (slug) => slug === 'ojo')
    assert.deepEqual(resultado, [])
  })

  it('ignora en silencio una fila heredada con inputKey corrupta', () => {
    const resultado = filtrarClavesValidas(
      [fila('esto-no-es-una-clave-valida'), fila(buildPairInputKey('ojo', 'moneda'))],
      () => true,
    )
    assert.deepEqual(resultado, [buildPairInputKey('ojo', 'moneda')])
  })

  it('ordena las claves resultantes de forma determinista', () => {
    const a = buildPairInputKey('vision', 'moneda')
    const b = buildPairInputKey('ojo', 'moneda')
    const resultado = filtrarClavesValidas([fila(a), fila(b)], () => true)
    assert.deepEqual(resultado, [...resultado].sort())
  })
})

describe('calcularRevisionMemoria', () => {
  it('cambia cuando cambia el recuento', () => {
    assert.notEqual(calcularRevisionMemoria(1, null), calcularRevisionMemoria(2, null))
  })

  it('cambia cuando cambia la fecha más reciente', () => {
    const a = calcularRevisionMemoria(1, new Date('2026-01-01'))
    const b = calcularRevisionMemoria(1, new Date('2026-02-01'))
    assert.notEqual(a, b)
  })

  it('no incluye ningún identificador de perfil', () => {
    const revision = calcularRevisionMemoria(3, new Date('2026-01-01'))
    assert.equal(/[a-z0-9]{20,}/i.test(revision), false)
  })
})
