import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  agruparCombinaciones,
  calcularComponentesCaminos,
  normalizarTexto,
  type AristaArbol,
  type NodoArbol,
} from './tipos'

function nodo(
  id: string,
  caminoIndex: number | null = null,
  clase: NodoArbol['clase'] = 'elemento',
): NodoArbol {
  return {
    id,
    nombre: id,
    clase,
    tipo: null,
    tier: 0,
    caminoIndex,
    secuencia: clase === 'secuencia' ? 9 : null,
    inicial: false,
    activo: true,
    espontaneo: false,
    iconKey: null,
    descripcion: '',
    desbloqueo: null,
  }
}

describe('agruparCombinaciones', () => {
  it('conserva todos los ingredientes y salidas de una receta multiproducto', () => {
    const aristas: AristaArbol[] = []
    for (const de of ['a', 'b']) {
      for (const a of ['resultado-1', 'resultado-2']) {
        aristas.push({ de, a, tipo: 'receta', via: 'A + B', grupo: 'rec:1' })
      }
    }

    const [combo] = agruparCombinaciones(aristas)

    assert.deepEqual(combo.entradas, ['a', 'b'])
    assert.deepEqual(combo.salidas, ['resultado-1', 'resultado-2'])
    assert.equal(combo.id, 'grupo:rec:1')
  })

  it('genera identidades estables y únicas para aristas sueltas repetidas', () => {
    const arista: AristaArbol = { de: 'a', a: 'b', tipo: 'receta', via: 'A + B' }
    const combos = agruparCombinaciones([arista, arista])

    assert.equal(new Set(combos.map((combo) => combo.id)).size, 2)
    assert.deepEqual(
      agruparCombinaciones([arista]).map((combo) => combo.id),
      agruparCombinaciones([arista]).map((combo) => combo.id),
    )
  })
})

describe('normalizarTexto', () => {
  it('permite buscar nombres sin distinguir acentos ni mayúsculas', () => {
    assert.equal(normalizarTexto('Árbitro'), 'arbitro')
    assert.ok(normalizarTexto('Invocación').includes(normalizarTexto('invocacion')))
  })
})

describe('calcularComponentesCaminos', () => {
  it('muestra salidas secundarias como hojas sin recorrer sus dependencias', () => {
    const nodos = [
      nodo('secuencia-principal', 0, 'secuencia'),
      nodo('secuencia-secundaria', 1, 'secuencia'),
      nodo('ingrediente-a'),
      nodo('ingrediente-b'),
      nodo('dependencia-ajena'),
    ]
    const combinaciones = agruparCombinaciones([
      { de: 'ingrediente-a', a: 'secuencia-principal', tipo: 'receta', via: 'A + B', grupo: 'rec:1' },
      { de: 'ingrediente-b', a: 'secuencia-principal', tipo: 'receta', via: 'A + B', grupo: 'rec:1' },
      { de: 'ingrediente-a', a: 'secuencia-secundaria', tipo: 'receta', via: 'A + B', grupo: 'rec:1' },
      { de: 'ingrediente-b', a: 'secuencia-secundaria', tipo: 'receta', via: 'A + B', grupo: 'rec:1' },
      { de: 'dependencia-ajena', a: 'secuencia-secundaria', tipo: 'receta', via: 'Otra receta' },
    ])

    const componentes = calcularComponentesCaminos(nodos, combinaciones, [0])
    const incluidos = componentes.porCamino.get(0)

    assert.ok(incluidos?.has('secuencia-principal'))
    assert.ok(incluidos?.has('secuencia-secundaria'))
    assert.ok(incluidos?.has('ingrediente-a'))
    assert.ok(incluidos?.has('ingrediente-b'))
    assert.equal(incluidos?.has('dependencia-ajena'), false)
    assert.equal(componentes.combinacionesPorCamino.get(0)?.size, 1)
  })
})
