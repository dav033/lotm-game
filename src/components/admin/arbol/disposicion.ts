// Disposición en capas del grafo (izquierda → derecha), compartida por el
// mapa completo y el explorador. Función pura: recibe los nodos y aristas
// visibles y devuelve las coordenadas.

import { NODO_H, NODO_W, PASO_X, PASO_Y, type AristaArbol, type NodoArbol } from './tipos'

export type Disposicion = {
  posiciones: Map<string, { x: number; y: number }>
  ancho: number
  alto: number
}

// Capa por camino más largo desde las fuentes (con tope por si los datos
// formaran un ciclo). Dentro de cada capa, varias pasadas de baricentro
// acercan cada nodo a sus vecinos para reducir cruces de líneas, y la
// coordenada vertical final se alinea con la media de sus entradas.
export function calcularDisposicion(
  nodos: NodoArbol[],
  aristas: Pick<AristaArbol, 'de' | 'a'>[],
): Disposicion {
  const porId = new Map(nodos.map((n) => [n.id, n]))
  const profundidad = new Map<string, number>(nodos.map((n) => [n.id, 0]))
  const clasePorId = new Map(nodos.map((n) => [n.id, n.clase]))
  // Los rituales son puertas sobre un avance, no productores: sus aristas de
  // salida no empujan la profundidad y después se anclan junto a su avance.
  const aristasDeCapa = aristas.filter((a) => clasePorId.get(a.de) !== 'ritual')
  for (let pasada = 0; pasada < 60; pasada++) {
    let cambio = false
    for (const arista of aristasDeCapa) {
      const desde = profundidad.get(arista.de)
      const hasta = profundidad.get(arista.a)
      if (desde === undefined || hasta === undefined) continue
      const candidata = desde + 1
      if (candidata > hasta && candidata < 40) {
        profundidad.set(arista.a, candidata)
        cambio = true
      }
    }
    if (!cambio) break
  }
  for (const arista of aristas) {
    if (clasePorId.get(arista.de) === 'ritual' && clasePorId.get(arista.a) === 'avance') {
      profundidad.set(arista.de, profundidad.get(arista.a) ?? 0)
    }
  }

  const anteriores = new Map<string, string[]>()
  const siguientes = new Map<string, string[]>()
  for (const arista of aristas) {
    if (!porId.has(arista.de) || !porId.has(arista.a)) continue
    anteriores.set(arista.a, [...(anteriores.get(arista.a) ?? []), arista.de])
    siguientes.set(arista.de, [...(siguientes.get(arista.de) ?? []), arista.a])
  }

  const ordenClase: Record<NodoArbol['clase'], number> = {
    secuencia: 0,
    avance: 1,
    ritual: 2,
    elemento: 3,
  }
  const columnas = new Map<number, NodoArbol[]>()
  for (const nodo of nodos) {
    const capa = profundidad.get(nodo.id) ?? 0
    const lista = columnas.get(capa) ?? []
    lista.push(nodo)
    columnas.set(capa, lista)
  }
  const capasOrdenadas = [...columnas.keys()].sort((a, b) => a - b)
  const fila = new Map<string, number>()
  for (const capa of capasOrdenadas) {
    const lista = columnas.get(capa)!
    // Semilla: agrupar por camino y clase mantiene las ramas juntas.
    lista.sort(
      (a, b) =>
        (a.caminoIndex ?? 99) - (b.caminoIndex ?? 99) ||
        ordenClase[a.clase] - ordenClase[b.clase] ||
        a.nombre.localeCompare(b.nombre, 'es'),
    )
    lista.forEach((nodo, indice) => fila.set(nodo.id, indice))
  }

  const ordenarPorVecinos = (lista: NodoArbol[], vecindario: Map<string, string[]>) => {
    const clave = new Map<string, number>()
    for (const nodo of lista) {
      const filasVecinas = (vecindario.get(nodo.id) ?? [])
        .map((id) => fila.get(id))
        .filter((f): f is number => f !== undefined)
      clave.set(
        nodo.id,
        filasVecinas.length
          ? filasVecinas.reduce((suma, f) => suma + f, 0) / filasVecinas.length
          : fila.get(nodo.id)!,
      )
    }
    lista.sort((a, b) => clave.get(a.id)! - clave.get(b.id)! || fila.get(a.id)! - fila.get(b.id)!)
    lista.forEach((nodo, indice) => fila.set(nodo.id, indice))
  }
  for (let pasada = 0; pasada < 4; pasada++) {
    for (const capa of capasOrdenadas) ordenarPorVecinos(columnas.get(capa)!, anteriores)
    for (const capa of [...capasOrdenadas].reverse()) ordenarPorVecinos(columnas.get(capa)!, siguientes)
  }

  const posiciones = new Map<string, { x: number; y: number }>()
  const desplazarColumna = (lista: NodoArbol[], residuos: number[]) => {
    if (residuos.length === 0) return
    const delta = residuos.reduce((suma, r) => suma + r, 0) / residuos.length
    for (const nodo of lista) {
      const pos = posiciones.get(nodo.id)!
      posiciones.set(nodo.id, { x: pos.x, y: pos.y + delta })
    }
  }
  for (const capa of capasOrdenadas) {
    const lista = columnas.get(capa)!
    let yPrevia = -Infinity
    const residuos: number[] = []
    for (const nodo of lista) {
      const ysEntrantes = (anteriores.get(nodo.id) ?? [])
        .map((id) => posiciones.get(id)?.y)
        .filter((y): y is number => y !== undefined)
      const deseada = ysEntrantes.length
        ? ysEntrantes.reduce((suma, y) => suma + y, 0) / ysEntrantes.length
        : fila.get(nodo.id)! * PASO_Y
      const y = Math.max(deseada, yPrevia + PASO_Y)
      if (ysEntrantes.length) residuos.push(deseada - y)
      posiciones.set(nodo.id, { x: capa * PASO_X, y })
      yPrevia = y
    }
    // La resolución de colisiones solo empuja hacia abajo; recentrar la
    // columna hacia sus entradas evita que el mapa derive en diagonal.
    desplazarColumna(lista, residuos)
  }
  for (const capa of [...capasOrdenadas].reverse()) {
    const lista = columnas.get(capa)!
    const residuos: number[] = []
    for (const nodo of lista) {
      const ysSalientes = (siguientes.get(nodo.id) ?? [])
        .map((id) => posiciones.get(id)?.y)
        .filter((y): y is number => y !== undefined)
      if (ysSalientes.length) {
        const media = ysSalientes.reduce((suma, y) => suma + y, 0) / ysSalientes.length
        residuos.push(media - posiciones.get(nodo.id)!.y)
      }
    }
    desplazarColumna(lista, residuos)
  }
  let minY = Infinity
  let maxY = -Infinity
  for (const { y } of posiciones.values()) {
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  if (!Number.isFinite(minY)) {
    minY = 0
    maxY = 0
  }
  for (const [id, pos] of posiciones) {
    posiciones.set(id, { x: pos.x, y: pos.y - minY })
  }
  const capas = (capasOrdenadas[capasOrdenadas.length - 1] ?? 0) + 1
  return {
    posiciones,
    ancho: capas * PASO_X + NODO_W,
    alto: maxY - minY + NODO_H,
  }
}
