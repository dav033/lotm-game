import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { AristaArbol, NodoArbol } from './tipos'
import {
  ID_POOL_FASES,
  asignarPropiedadNodos,
  construirResumenFases,
  type FaseParaResumen,
} from './modeloResumenFases'

const fase = (
  id: string,
  sortOrder: number,
  ownElementIds: string[],
  ownRitualIds: string[] = [],
  name = id,
): FaseParaResumen => ({
  id,
  name,
  sortOrder,
  unlockAtDiscoveryCount: sortOrder * 10,
  isActive: true,
  ownElementIds,
  ownRitualIds,
})

const nodo = (
  id: string,
  clase: NodoArbol['clase'] = 'elemento',
  activo = true,
): NodoArbol => ({
  id,
  nombre: id,
  clase,
  tipo: null,
  tier: 0,
  caminoIndex: null,
  secuencia: clase === 'secuencia' ? 1 : null,
  inicial: false,
  activo,
  espontaneo: false,
  iconKey: null,
  descripcion: '',
  desbloqueo: null,
})

describe('propiedad del resumen por fases', () => {
  it('asigna elementos, secuencias y rituales por pertenencia, y avances por su objetivo', () => {
    const propiedad = asignarPropiedadNodos({
      fases: [
        fase('fase-2', 2, [], ['ritual-2']),
        fase('fase-1', 1, ['elemento-1', 'secuencia-1']),
      ],
      avances: [{ id: 'avance-1', targetElementId: 'secuencia-1' }],
      nodos: [
        nodo('el:elemento-1'),
        nodo('el:secuencia-1', 'secuencia'),
        nodo('rit:ritual-2', 'ritual'),
        nodo('av:avance-1', 'avance'),
        nodo('el:libre'),
      ],
    })

    assert.deepEqual(Object.fromEntries(propiedad), {
      'el:elemento-1': 'fase-1',
      'el:secuencia-1': 'fase-1',
      'rit:ritual-2': 'fase-2',
      'av:avance-1': 'fase-1',
      'el:libre': ID_POOL_FASES,
    })
  })
})

describe('interacciones entre fases', () => {
  it('cuenta una combinación agrupada una sola vez por par dirigido', () => {
    const fases = [
      fase('origen', 1, ['a', 'b']),
      fase('destino', 2, ['x', 'y']),
    ]
    const nodos = [nodo('el:a'), nodo('el:b'), nodo('el:x'), nodo('el:y')]
    const aristas: AristaArbol[] = []
    for (const de of ['el:a', 'el:b']) {
      for (const a of ['el:x', 'el:y']) {
        aristas.push({ de, a, tipo: 'receta', via: 'A + B', grupo: 'rec:activa' })
      }
    }
    aristas.push(aristas[0])
    aristas.push({ de: 'el:a', a: 'el:x', tipo: 'desbloqueo', via: 'Revela X' })

    const resumen = construirResumenFases({
      fases,
      avances: [],
      recetas: [{ id: 'activa', isActive: true }],
      nodos,
      aristas,
    })

    assert.deepEqual(resumen.interacciones, [{
      origenId: 'origen',
      destinoId: 'destino',
      total: 2,
      tipos: [
        { tipo: 'receta', cantidad: 1 },
        { tipo: 'desbloqueo', cantidad: 1 },
      ],
    }])
  })

  it('excluye recetas inactivas y combinaciones con entradas inactivas', () => {
    const resumen = construirResumenFases({
      fases: [fase('origen', 1, ['a', 'apagado']), fase('destino', 2, ['b'])],
      avances: [],
      recetas: [{ id: 'apagada', isActive: false }],
      nodos: [nodo('el:a'), nodo('el:apagado', 'elemento', false), nodo('el:b')],
      aristas: [
        { de: 'el:a', a: 'el:b', tipo: 'receta', via: 'Apagada', grupo: 'rec:apagada' },
        { de: 'el:apagado', a: 'el:b', tipo: 'requisito', via: 'Entrada inactiva' },
        { de: 'el:a', a: 'el:b', tipo: 'desbloqueo', via: 'Activa' },
      ],
    })

    assert.deepEqual(resumen.interacciones[0]?.tipos, [
      { tipo: 'desbloqueo', cantidad: 1 },
    ])
    assert.equal(resumen.interacciones[0]?.total, 1)
  })

  it('añade el pool solo si contiene nodos activos y lo usa en los cruces', () => {
    const conPool = construirResumenFases({
      fases: [fase('fase-1', 1, ['a'])],
      avances: [],
      recetas: [],
      nodos: [nodo('el:a'), nodo('el:libre')],
      aristas: [{ de: 'el:a', a: 'el:libre', tipo: 'desbloqueo', via: 'Pool' }],
    })

    assert.deepEqual(conPool.fases.map((item) => item.id), ['fase-1', ID_POOL_FASES])
    assert.equal(conPool.fases[1].conteos.elementos, 1)
    assert.equal(conPool.interacciones[0].destinoId, ID_POOL_FASES)

    const sinPool = construirResumenFases({
      fases: [fase('fase-1', 1, ['a'])],
      avances: [],
      recetas: [],
      nodos: [nodo('el:a'), nodo('el:libre', 'elemento', false)],
      aristas: [],
    })
    assert.deepEqual(sinPool.fases.map((item) => item.id), ['fase-1'])
  })

  it('ordena fases, cruces y tipos de forma determinista', () => {
    const fases = [
      fase('beta', 2, ['b'], [], 'Beta'),
      fase('zeta', 1, ['z'], [], 'Zeta'),
      fase('alpha', 1, ['a'], [], 'Alpha'),
    ]
    const nodos = [nodo('el:b'), nodo('el:z'), nodo('el:a')]
    const aristas: AristaArbol[] = [
      { de: 'el:z', a: 'el:b', tipo: 'desbloqueo', via: 'Z a B' },
      { de: 'el:a', a: 'el:b', tipo: 'ascension', via: 'A a B' },
      { de: 'el:a', a: 'el:z', tipo: 'ritual', via: 'A a Z' },
      { de: 'el:a', a: 'el:b', tipo: 'receta', via: 'A a B' },
    ]

    const construir = (entrada: AristaArbol[]) => construirResumenFases({
      fases,
      avances: [],
      recetas: [],
      nodos,
      aristas: entrada,
    })
    const resumen = construir(aristas)

    assert.deepEqual(resumen.fases.map((item) => item.id), ['alpha', 'zeta', 'beta'])
    assert.deepEqual(
      resumen.interacciones.map((item) => `${item.origenId}->${item.destinoId}`),
      ['alpha->zeta', 'alpha->beta', 'zeta->beta'],
    )
    assert.deepEqual(resumen.interacciones[1].tipos, [
      { tipo: 'receta', cantidad: 1 },
      { tipo: 'ascension', cantidad: 1 },
    ])
    assert.deepEqual(construir([...aristas].reverse()), resumen)
  })
})
