import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { construirSubgrafoFase } from './subgrafoFase'
import type { AristaArbol, NodoArbol } from './tipos'

function nodo(id: string, clase: NodoArbol['clase'] = 'elemento'): NodoArbol {
  return {
    id,
    nombre: id,
    clase,
    tipo: null,
    tier: 0,
    caminoIndex: null,
    secuencia: null,
    inicial: false,
    activo: true,
    espontaneo: false,
    iconKey: null,
    descripcion: '',
    desbloqueo: null,
  }
}

describe('construirSubgrafoFase', () => {
  it('muestra el contenido propio con sus dependencias heredadas', () => {
    const nodos = ['el:a', 'el:b', 'el:apertura', 'el:resultado', 'el:futuro'].map((id) => nodo(id))
    const aristas: AristaArbol[] = [
      { de: 'el:a', a: 'el:resultado', tipo: 'receta', via: 'A + B', grupo: 'rec:activa' },
      { de: 'el:b', a: 'el:resultado', tipo: 'receta', via: 'A + B', grupo: 'rec:activa' },
      { de: 'el:futuro', a: 'el:resultado', tipo: 'desbloqueo', via: 'Ruta futura' },
    ]

    const result = construirSubgrafoFase({
      nodos,
      aristas,
      phaseElementIds: ['apertura', 'resultado'],
      initialElementIds: ['apertura'],
      reachableElementIds: ['a', 'b', 'apertura', 'resultado'],
      previousReachableElementIds: ['a', 'b'],
      inactiveRecipeIds: [],
    })

    assert.deepEqual(result.nodos.map((item) => item.id), [
      'el:a',
      'el:b',
      'el:apertura',
      'el:resultado',
    ])
    assert.equal(result.aristas.length, 2)
    assert.equal(result.nodos.find((item) => item.id === 'el:apertura')?.inicial, true)
    assert.equal(result.nodos.find((item) => item.id === 'el:a')?.inicial, false)
  })

  it('conserva rutas de recetas, desbloqueos, avances y rituales', () => {
    const nodos = [
      nodo('el:heredado', 'secuencia'),
      nodo('el:apertura'),
      nodo('el:receta'),
      nodo('el:espontaneo'),
      nodo('el:requisito-conjunto'),
      nodo('el:por-conteo'),
      nodo('av:ascenso', 'avance'),
      nodo('el:destino-avance', 'secuencia'),
      nodo('rit:umbral', 'ritual'),
      nodo('av:ritual', 'avance'),
      nodo('el:destino-ritual', 'secuencia'),
    ]
    const aristas: AristaArbol[] = [
      { de: 'el:apertura', a: 'el:receta', tipo: 'receta', via: 'Receta', grupo: 'rec:activa' },
      { de: 'el:heredado', a: 'el:receta', tipo: 'receta', via: 'Receta', grupo: 'rec:activa' },
      { de: 'el:receta', a: 'el:espontaneo', tipo: 'desbloqueo', via: 'Revelación' },
      { de: 'el:apertura', a: 'el:requisito-conjunto', tipo: 'requisito-conjunto', via: 'Requisitos', grupo: 'req:1' },
      { de: 'el:receta', a: 'el:requisito-conjunto', tipo: 'requisito-conjunto', via: 'Requisitos', grupo: 'req:1' },
      { de: 'el:apertura', a: 'av:ascenso', tipo: 'creacion', via: 'Creación', grupo: 'crear-av:1' },
      { de: 'el:heredado', a: 'el:destino-avance', tipo: 'ascension', via: 'Ascenso', grupo: 'asc:1' },
      { de: 'av:ascenso', a: 'el:destino-avance', tipo: 'ascension', via: 'Ascenso', grupo: 'asc:1' },
      { de: 'el:apertura', a: 'rit:umbral', tipo: 'ritual', via: 'Ritual', grupo: 'crear-rit:1' },
      { de: 'el:heredado', a: 'rit:umbral', tipo: 'ritual', via: 'Ritual', grupo: 'crear-rit:1' },
      { de: 'rit:umbral', a: 'av:ritual', tipo: 'ritual', via: 'Supervivencia' },
      { de: 'el:heredado', a: 'el:destino-ritual', tipo: 'ascension', via: 'Ascenso ritual', grupo: 'asc:2' },
      { de: 'av:ritual', a: 'el:destino-ritual', tipo: 'ascension', via: 'Ascenso ritual', grupo: 'asc:2' },
    ]

    const result = construirSubgrafoFase({
      nodos,
      aristas,
      phaseElementIds: [
        'apertura',
        'receta',
        'espontaneo',
        'requisito-conjunto',
        'por-conteo',
        'destino-avance',
        'destino-ritual',
      ],
      initialElementIds: ['apertura'],
      reachableElementIds: [
        'heredado',
        'apertura',
        'receta',
        'espontaneo',
        'requisito-conjunto',
        'por-conteo',
        'destino-avance',
        'destino-ritual',
      ],
      previousReachableElementIds: ['heredado'],
      inactiveRecipeIds: [],
    })

    assert.deepEqual(new Set(result.nodos.map((item) => item.id)), new Set(nodos.map((item) => item.id)))
    assert.deepEqual(new Set(result.aristas.map((edge) => edge.tipo)), new Set([
      'receta',
      'desbloqueo',
      'requisito-conjunto',
      'creacion',
      'ascension',
      'ritual',
    ]))
  })

  it('deja desconectada una salida que depende de contenido futuro', () => {
    const result = construirSubgrafoFase({
      nodos: [nodo('el:futuro'), nodo('el:resultado')],
      aristas: [{
        de: 'el:futuro',
        a: 'el:resultado',
        tipo: 'receta',
        via: 'Futura',
        grupo: 'rec:futura',
      }],
      phaseElementIds: ['resultado'],
      initialElementIds: [],
      reachableElementIds: ['resultado'],
      previousReachableElementIds: [],
      inactiveRecipeIds: [],
    })

    assert.deepEqual(result.nodos.map((item) => item.id), ['el:resultado'])
    assert.deepEqual(result.aristas, [])
  })

  it('ignora recetas inactivas aunque sus nodos sean alcanzables por otra ruta', () => {
    const result = construirSubgrafoFase({
      nodos: [nodo('el:origen'), nodo('el:resultado')],
      aristas: [{
        de: 'el:origen',
        a: 'el:resultado',
        tipo: 'receta',
        via: 'Inactiva',
        grupo: 'rec:apagada',
      }],
      phaseElementIds: ['resultado'],
      initialElementIds: [],
      reachableElementIds: ['origen', 'resultado'],
      previousReachableElementIds: ['origen'],
      inactiveRecipeIds: ['apagada'],
    })

    assert.deepEqual(result.nodos.map((item) => item.id), ['el:resultado'])
    assert.deepEqual(result.aristas, [])
  })
})
