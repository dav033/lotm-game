import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { calcularDisposicion, calcularDisposicionCamino } from './disposicion'
import { NODO_W, PASO_X, type AristaArbol, type NodoArbol } from './tipos'

function nodo(
  id: string,
  clase: NodoArbol['clase'],
  tier: number,
  caminoIndex: number | null,
): NodoArbol {
  return {
    id,
    nombre: id,
    clase,
    tipo: null,
    tier,
    caminoIndex,
    secuencia: clase === 'secuencia' ? 9 - tier : null,
    inicial: false,
    activo: true,
    espontaneo: false,
    iconKey: null,
    descripcion: '',
    desbloqueo: null,
  }
}

describe('calcularDisposicion', () => {
  it('no reserva una columna vacía después del último nodo', () => {
    const disposicion = calcularDisposicion([nodo('unico', 'elemento', 0, null)], [])
    assert.equal(disposicion.ancho, NODO_W)
  })

  it('condensa ciclos y continúa sus descendientes en la capa siguiente', () => {
    const nodos = [
      nodo('a', 'elemento', 0, null),
      nodo('b', 'elemento', 0, null),
      nodo('descendiente', 'elemento', 0, null),
    ]
    const disposicion = calcularDisposicion(nodos, [
      { de: 'a', a: 'b' },
      { de: 'b', a: 'a' },
      { de: 'b', a: 'descendiente' },
    ])

    assert.equal(disposicion.posiciones.get('a')?.x, disposicion.posiciones.get('b')?.x)
    assert.equal(
      disposicion.posiciones.get('descendiente')?.x,
      (disposicion.posiciones.get('a')?.x ?? 0) + PASO_X,
    )
    assert.equal(disposicion.ancho, PASO_X + NODO_W)
  })

  it('produce las mismas capas aunque cambie el orden de las aristas', () => {
    const nodos = [
      nodo('origen', 'elemento', 0, null),
      nodo('a', 'elemento', 0, null),
      nodo('b', 'elemento', 0, null),
      nodo('salida', 'elemento', 0, null),
    ]
    const aristas = [
      { de: 'origen', a: 'a' },
      { de: 'a', a: 'b' },
      { de: 'b', a: 'a' },
      { de: 'b', a: 'salida' },
    ]

    const directa = calcularDisposicion(nodos, aristas)
    const invertida = calcularDisposicion(nodos, [...aristas].reverse())

    assert.equal(directa.ancho, invertida.ancho)
    for (const actual of nodos) {
      assert.equal(
        directa.posiciones.get(actual.id)?.x,
        invertida.posiciones.get(actual.id)?.x,
      )
    }
  })

  it('no trunca cadenas legítimas de más de cuarenta capas', () => {
    const nodos = Array.from({ length: 45 }, (_, i) => nodo(`n${i}`, 'elemento', 0, null))
    const aristas = nodos.slice(1).map((actual, i) => ({ de: nodos[i].id, a: actual.id }))

    const disposicion = calcularDisposicion(nodos, aristas)

    assert.equal(disposicion.posiciones.get('n44')?.x, 44 * PASO_X)
    assert.equal(disposicion.ancho, 44 * PASO_X + NODO_W)
  })

  it('mantiene el ritual junto a su avance sin convertir los fallos en progreso', () => {
    const nodos = [
      nodo('ingrediente', 'elemento', 0, null),
      nodo('ritual', 'ritual', 0, 0),
      nodo('avance', 'avance', 0, 0),
      nodo('destino', 'secuencia', 1, 0),
      nodo('fallo', 'elemento', 0, null),
    ]
    const disposicion = calcularDisposicion(nodos, [
      { de: 'ingrediente', a: 'ritual' },
      { de: 'ritual', a: 'avance' },
      { de: 'avance', a: 'destino' },
      { de: 'ritual', a: 'fallo' },
    ])

    assert.equal(disposicion.posiciones.get('ritual')?.x, disposicion.posiciones.get('avance')?.x)
    assert.equal(disposicion.posiciones.get('avance')?.x, PASO_X)
    assert.equal(disposicion.posiciones.get('destino')?.x, PASO_X * 2)
    assert.equal(disposicion.posiciones.get('fallo')?.x, 0)
  })
})

describe('calcularDisposicionCamino', () => {
  it('no superpone avances alternativos hacia la misma secuencia', () => {
    const nodos = [
      nodo('avance-1', 'avance', 0, 0),
      nodo('avance-2', 'avance', 0, 0),
      nodo('destino', 'secuencia', 2, 0),
    ]
    const aristas: AristaArbol[] = [
      { de: 'avance-1', a: 'destino', tipo: 'ascension', via: 'Primera' },
      { de: 'avance-2', a: 'destino', tipo: 'ascension', via: 'Segunda' },
    ]

    const disposicion = calcularDisposicionCamino(nodos, aristas, 0)

    assert.notEqual(
      disposicion.posiciones.get('avance-1')?.y,
      disposicion.posiciones.get('avance-2')?.y,
    )
  })
})
