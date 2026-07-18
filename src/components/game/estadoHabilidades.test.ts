import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { facultadesDesdeSlugs } from '@/server/domain/habilidades'
import {
  aplicarDeltaAMemoria,
  crearEstadoInteraccionHabilidades,
  crearMemoriaAprendizVacia,
  hayFacultadesDesbloqueadas,
  parPreviamenteFallido,
  permiteArrastre,
  type EstadoMemoriaAprendiz,
} from './estadoHabilidades'

describe('estado cliente de facultades', () => {
  it('el reset limpia objetivo, resultado, visión y tiers', () => {
    const estado = crearEstadoInteraccionHabilidades()
    assert.equal(estado.modoInteraccion, 'normal')
    assert.equal(estado.seerCargando, false)
    assert.equal(estado.seerResultado, null)
    assert.equal(estado.mysteryActivo, false)
    assert.equal(estado.mysteryCargando, false)
    assert.deepEqual(estado.potencialPorElemento, {})
    assert.equal(hayFacultadesDesbloqueadas(estado.abilities), false)
  })

  it('el panel se oculta sin facultades y aparece con cualquiera, incluido Savant', () => {
    assert.equal(hayFacultadesDesbloqueadas(facultadesDesdeSlugs(new Set())), false)
    assert.equal(hayFacultadesDesbloqueadas(facultadesDesdeSlugs(new Set(['seer']))), true)
    assert.equal(hayFacultadesDesbloqueadas(facultadesDesdeSlugs(new Set(['savant']))), true)
    assert.equal(
      hayFacultadesDesbloqueadas(facultadesDesdeSlugs(new Set(['mystery-pryer']))),
      true,
    )
  })

  it('el Vidente bloquea el arrastre; el modo normal lo conserva', () => {
    assert.equal(permiteArrastre('normal'), true)
    assert.equal(permiteArrastre('vidente-objetivo'), false)
  })
})

describe('Memoria del Aprendiz — estado de cliente', () => {
  function memoriaLista(...keys: string[]): EstadoMemoriaAprendiz {
    return { status: 'ready', revision: 'r1', failedInputKeys: new Set(keys) }
  }

  it('el estado inicial está vacío e "idle"', () => {
    const memoria = crearMemoriaAprendizVacia()
    assert.equal(memoria.status, 'idle')
    assert.equal(memoria.revision, null)
    assert.equal(memoria.failedInputKeys.size, 0)
  })

  it('sin la facultad desbloqueada, nunca marca un par aunque esté en el historial', () => {
    const memoria = memoriaLista('moneda*1|ojo*1')
    assert.equal(parPreviamenteFallido(memoria, false, 'ojo', 'moneda'), false)
  })

  it('con la facultad desbloqueada pero el historial aún cargando, no marca nada', () => {
    const memoria: EstadoMemoriaAprendiz = { status: 'loading', revision: null, failedInputKeys: new Set() }
    assert.equal(parPreviamenteFallido(memoria, true, 'ojo', 'moneda'), false)
  })

  it('marca un par registrado, en cualquier orden de los slugs', () => {
    const memoria = memoriaLista('moneda*1|ojo*1')
    assert.equal(parPreviamenteFallido(memoria, true, 'ojo', 'moneda'), true)
    assert.equal(parPreviamenteFallido(memoria, true, 'moneda', 'ojo'), true)
  })

  it('no marca un par que no está en el historial', () => {
    const memoria = memoriaLista('moneda*1|ojo*1')
    assert.equal(parPreviamenteFallido(memoria, true, 'ojo', 'vision'), false)
  })

  it('reconoce la autocombinación (Ojo + Ojo)', () => {
    const memoria = memoriaLista('ojo*2')
    assert.equal(parPreviamenteFallido(memoria, true, 'ojo', 'ojo'), true)
  })

  it('ignora un avance enmascarado como parte del par', () => {
    const memoria = memoriaLista('moneda*1|ojo*1')
    assert.equal(parPreviamenteFallido(memoria, true, 'advance-xyz', 'moneda'), false)
  })

  it('aplicarDeltaAMemoria: FAILED añade la clave sin mutar el Set anterior', () => {
    const previo = memoriaLista('ojo*1|vision*1')
    const siguiente = aplicarDeltaAMemoria(previo, { inputKey: 'moneda*1|ojo*1', status: 'FAILED' })
    assert.equal(previo.failedInputKeys.size, 1)
    assert.equal(siguiente.failedInputKeys.size, 2)
    assert.notEqual(siguiente.failedInputKeys, previo.failedInputKeys)
  })

  it('aplicarDeltaAMemoria: FAILED repetido es idempotente', () => {
    const previo = memoriaLista('ojo*1|vision*1')
    const siguiente = aplicarDeltaAMemoria(previo, { inputKey: 'ojo*1|vision*1', status: 'FAILED' })
    assert.equal(siguiente.failedInputKeys.size, 1)
  })

  it('aplicarDeltaAMemoria: RESOLVED retira la clave si estaba presente', () => {
    const previo = memoriaLista('ojo*1|vision*1')
    const siguiente = aplicarDeltaAMemoria(previo, { inputKey: 'ojo*1|vision*1', status: 'RESOLVED' })
    assert.equal(siguiente.failedInputKeys.has('ojo*1|vision*1'), false)
  })

  it('aplicarDeltaAMemoria: RESOLVED de una clave ausente no rompe nada', () => {
    const previo = memoriaLista('ojo*1|vision*1')
    const siguiente = aplicarDeltaAMemoria(previo, { inputKey: 'moneda*1|ojo*1', status: 'RESOLVED' })
    assert.deepEqual([...siguiente.failedInputKeys], ['ojo*1|vision*1'])
  })
})
