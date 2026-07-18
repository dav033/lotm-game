// Disposición en capas del grafo (izquierda → derecha), compartida por el
// mapa completo y el explorador. Función pura: recibe los nodos y aristas
// visibles y devuelve las coordenadas.

import { NODO_H, NODO_W, PASO_X, PASO_Y, type AristaArbol, type NodoArbol } from './tipos'

export type Disposicion = {
  posiciones: Map<string, { x: number; y: number }>
  ancho: number
  alto: number
}

// Capa por camino más largo desde las fuentes. Los ciclos se condensan antes
// en componentes fuertemente conexas para que no creen columnas vacías ni
// dependan del orden de las aristas. Dentro de cada capa, varias pasadas de
// baricentro acercan cada nodo a sus vecinos para reducir cruces de líneas.
export function calcularDisposicion(
  nodos: NodoArbol[],
  aristas: Pick<AristaArbol, 'de' | 'a'>[],
): Disposicion {
  const porId = new Map(nodos.map((n) => [n.id, n]))
  const clasePorId = new Map(nodos.map((n) => [n.id, n.clase]))

  // Un ritual es una puerta del avance, no una etapa posterior. Contraer
  // ritual → avance antes de buscar ciclos mantiene ambos en la misma capa y
  // permite que los ingredientes del ritual sí condicionen esa profundidad.
  const padre = new Map(nodos.map((nodo) => [nodo.id, nodo.id]))
  const raiz = (id: string): string => {
    let actual = id
    while (padre.get(actual) !== actual) actual = padre.get(actual)!
    let cursor = id
    while (padre.get(cursor) !== cursor) {
      const siguiente = padre.get(cursor)!
      padre.set(cursor, actual)
      cursor = siguiente
    }
    return actual
  }
  for (const arista of aristas) {
    if (clasePorId.get(arista.de) === 'ritual' && clasePorId.get(arista.a) === 'avance') {
      padre.set(raiz(arista.de), raiz(arista.a))
    }
  }

  const unidades: string[] = []
  const unidadesVistas = new Set<string>()
  for (const nodo of nodos) {
    const id = raiz(nodo.id)
    if (!unidadesVistas.has(id)) {
      unidadesVistas.add(id)
      unidades.push(id)
    }
  }

  const adyacencia = new Map(unidades.map((id) => [id, new Set<string>()]))
  for (const arista of aristas) {
    if (!porId.has(arista.de) || !porId.has(arista.a)) continue
    // Las consecuencias de un ritual son resultados laterales, no progreso.
    // La puerta ritual → avance ya quedó representada por la contracción.
    if (clasePorId.get(arista.de) === 'ritual') continue
    const desde = raiz(arista.de)
    const hasta = raiz(arista.a)
    if (desde !== hasta) adyacencia.get(desde)!.add(hasta)
  }

  // Tarjan condensa cada ciclo en una unidad. El grafo resultante siempre es
  // acíclico, incluso cuando recetas y desbloqueos se retroalimentan.
  let siguienteIndice = 0
  const indice = new Map<string, number>()
  const enlaceBajo = new Map<string, number>()
  const pila: string[] = []
  const enPila = new Set<string>()
  const componentePorUnidad = new Map<string, number>()
  const componentes: string[][] = []
  const visitar = (id: string) => {
    indice.set(id, siguienteIndice)
    enlaceBajo.set(id, siguienteIndice)
    siguienteIndice++
    pila.push(id)
    enPila.add(id)

    for (const vecino of adyacencia.get(id) ?? []) {
      if (!indice.has(vecino)) {
        visitar(vecino)
        enlaceBajo.set(id, Math.min(enlaceBajo.get(id)!, enlaceBajo.get(vecino)!))
      } else if (enPila.has(vecino)) {
        enlaceBajo.set(id, Math.min(enlaceBajo.get(id)!, indice.get(vecino)!))
      }
    }

    if (enlaceBajo.get(id) !== indice.get(id)) return
    const componente: string[] = []
    let extraido: string
    do {
      extraido = pila.pop()!
      enPila.delete(extraido)
      componentePorUnidad.set(extraido, componentes.length)
      componente.push(extraido)
    } while (extraido !== id)
    componentes.push(componente)
  }
  for (const id of unidades) if (!indice.has(id)) visitar(id)

  const dag = componentes.map(() => new Set<number>())
  const gradoEntrada = componentes.map(() => 0)
  for (const desde of unidades) {
    const componenteDesde = componentePorUnidad.get(desde)!
    for (const hasta of adyacencia.get(desde) ?? []) {
      const componenteHasta = componentePorUnidad.get(hasta)!
      if (componenteDesde === componenteHasta || dag[componenteDesde].has(componenteHasta)) continue
      dag[componenteDesde].add(componenteHasta)
      gradoEntrada[componenteHasta]++
    }
  }

  const profundidadComponente = componentes.map(() => 0)
  const pendientes = gradoEntrada
    .map((grado, componente) => ({ grado, componente }))
    .filter(({ grado }) => grado === 0)
    .map(({ componente }) => componente)
  for (let cursor = 0; cursor < pendientes.length; cursor++) {
    const desde = pendientes[cursor]
    for (const hasta of dag[desde]) {
      profundidadComponente[hasta] = Math.max(
        profundidadComponente[hasta],
        profundidadComponente[desde] + 1,
      )
      gradoEntrada[hasta]--
      if (gradoEntrada[hasta] === 0) pendientes.push(hasta)
    }
  }

  const profundidad = new Map<string, number>()
  for (const nodo of nodos) {
    profundidad.set(
      nodo.id,
      profundidadComponente[componentePorUnidad.get(raiz(nodo.id))!] ?? 0,
    )
  }

  const anteriores = new Map<string, string[]>()
  const siguientes = new Map<string, string[]>()
  for (const arista of aristas) {
    if (!porId.has(arista.de) || !porId.has(arista.a)) continue
    const previas = anteriores.get(arista.a) ?? []
    previas.push(arista.de)
    anteriores.set(arista.a, previas)
    const posteriores = siguientes.get(arista.de) ?? []
    posteriores.push(arista.a)
    siguientes.set(arista.de, posteriores)
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
  const ultimaCapa = capasOrdenadas[capasOrdenadas.length - 1] ?? 0
  return {
    posiciones,
    ancho: ultimaCapa * PASO_X + NODO_W,
    alto: maxY - minY + NODO_H,
  }
}

// Disposición enfocada para uno o varios caminos. El tier define columnas
// estables y evita que los ciclos de recetas empujen nodos a profundidades
// arbitrarias. En un camino individual, su secuencia y sus avances forman una
// espina horizontal; rituales y dependencias se ordenan debajo.
export function calcularDisposicionCamino(
  nodos: NodoArbol[],
  aristas: AristaArbol[],
  caminoPrincipal: number | null,
): Disposicion {
  if (nodos.length === 0) {
    return { posiciones: new Map(), ancho: NODO_W, alto: NODO_H }
  }

  const porId = new Map(nodos.map((nodo) => [nodo.id, nodo]))
  const destinoDeAvance = new Map<string, string>()
  const avanceDeRitual = new Map<string, string>()
  const anteriores = new Map<string, string[]>()
  const siguientes = new Map<string, string[]>()
  const aristasEntrantes = new Map<string, AristaArbol[]>()

  for (const arista of aristas) {
    if (!porId.has(arista.de) || !porId.has(arista.a)) continue
    const previas = anteriores.get(arista.a) ?? []
    previas.push(arista.de)
    anteriores.set(arista.a, previas)
    const posteriores = siguientes.get(arista.de) ?? []
    posteriores.push(arista.a)
    siguientes.set(arista.de, posteriores)
    const entrantes = aristasEntrantes.get(arista.a) ?? []
    entrantes.push(arista)
    aristasEntrantes.set(arista.a, entrantes)
    if (arista.tipo === 'ascension') destinoDeAvance.set(arista.de, arista.a)
    if (
      arista.tipo === 'ritual' &&
      porId.get(arista.de)?.clase === 'ritual' &&
      porId.get(arista.a)?.clase === 'avance'
    ) {
      avanceDeRitual.set(arista.de, arista.a)
    }
  }

  const capa = new Map<string, number>()
  const capaDeAvance = (id: string): number => {
    const destino = porId.get(destinoDeAvance.get(id) ?? '')
    return destino ? destino.tier * 2 - 1 : 0
  }
  const esSecuenciaPrincipal = (nodo: NodoArbol) =>
    caminoPrincipal !== null &&
    nodo.caminoIndex === caminoPrincipal &&
    nodo.clase === 'secuencia'
  const nodosFlexibles: NodoArbol[] = []
  for (const nodo of nodos) {
    if (nodo.clase === 'avance') {
      capa.set(nodo.id, capaDeAvance(nodo.id))
    } else if (nodo.clase === 'ritual') {
      capa.set(nodo.id, capaDeAvance(avanceDeRitual.get(nodo.id) ?? '') - 1)
    } else if (esSecuenciaPrincipal(nodo)) {
      capa.set(nodo.id, nodo.tier * 2)
    } else {
      nodosFlexibles.push(nodo)
    }
  }

  // Cada tier dispone de dos columnas. Repartir sus elementos entre ambas
  // evita pilas verticales enormes sin alterar el orden general de progreso.
  const ocupacion = new Map<number, number>()
  for (const columna of capa.values()) {
    ocupacion.set(columna, (ocupacion.get(columna) ?? 0) + 1)
  }
  nodosFlexibles.sort(
    (a, b) =>
      a.tier - b.tier ||
      a.nombre.localeCompare(b.nombre, 'es'),
  )
  for (const nodo of nodosFlexibles) {
    const izquierda = nodo.tier * 2 - 1
    const derecha = nodo.tier * 2
    const columna =
      (ocupacion.get(izquierda) ?? 0) <= (ocupacion.get(derecha) ?? 0)
        ? izquierda
        : derecha
    capa.set(nodo.id, columna)
    ocupacion.set(columna, (ocupacion.get(columna) ?? 0) + 1)
  }

  for (const nodo of nodosFlexibles) {
    const entradas = aristasEntrantes.get(nodo.id) ?? []
    if (
      entradas.length === 0 ||
      !entradas.every(
        (arista) => arista.tipo === 'fallo' || arista.tipo === 'desbloqueo',
      )
    ) {
      continue
    }
    const capasOrigen = entradas
      .map((arista) => capa.get(arista.de))
      .filter((columna): columna is number => columna !== undefined)
    if (capasOrigen.length > 0) capa.set(nodo.id, Math.max(...capasOrigen) + 1)
  }

  const minCapa = Math.min(...capa.values())
  const columnas = new Map<number, NodoArbol[]>()
  for (const nodo of nodos) {
    const columna = (capa.get(nodo.id) ?? 0) - minCapa
    const lista = columnas.get(columna) ?? []
    lista.push(nodo)
    columnas.set(columna, lista)
  }
  const capasOrdenadas = [...columnas.keys()].sort((a, b) => a - b)

  const esEspina = (nodo: NodoArbol) =>
    caminoPrincipal !== null &&
    nodo.caminoIndex === caminoPrincipal &&
    (nodo.clase === 'secuencia' || nodo.clase === 'avance')
  const esRitualPrincipal = (nodo: NodoArbol) =>
    caminoPrincipal !== null &&
    nodo.caminoIndex === caminoPrincipal &&
    nodo.clase === 'ritual'
  const ordenClase: Record<NodoArbol['clase'], number> = {
    secuencia: 0,
    avance: 1,
    ritual: 2,
    elemento: 3,
  }
  const fila = new Map<string, number>()

  const asignarFilas = (lista: NodoArbol[]) => {
    const espina = lista.filter(esEspina)
    const rituales = lista.filter(esRitualPrincipal)
    const resto = lista.filter((nodo) => !esEspina(nodo) && !esRitualPrincipal(nodo))
    lista.splice(0, lista.length, ...espina, ...rituales, ...resto)
    espina.forEach((nodo, indice) => fila.set(nodo.id, indice))
    rituales.forEach((nodo, indice) => fila.set(nodo.id, espina.length + indice))
    const inicioResto = caminoPrincipal === null ? 0 : Math.max(2, espina.length + rituales.length)
    resto.forEach((nodo, indice) => fila.set(nodo.id, inicioResto + indice))
  }

  for (const columna of capasOrdenadas) {
    const lista = columnas.get(columna)!
    lista.sort(
      (a, b) =>
        Number(esEspina(b)) - Number(esEspina(a)) ||
        Number(esRitualPrincipal(b)) - Number(esRitualPrincipal(a)) ||
        (a.caminoIndex ?? 99) - (b.caminoIndex ?? 99) ||
        ordenClase[a.clase] - ordenClase[b.clase] ||
        a.nombre.localeCompare(b.nombre, 'es'),
    )
    asignarFilas(lista)
  }

  const ordenarPorVecinos = (lista: NodoArbol[], vecindario: Map<string, string[]>) => {
    const fijas = lista.filter((nodo) => esEspina(nodo) || esRitualPrincipal(nodo))
    const moviles = lista.filter((nodo) => !esEspina(nodo) && !esRitualPrincipal(nodo))
    const baricentros = new Map<string, number>()
    for (const nodo of moviles) {
      const filas = (vecindario.get(nodo.id) ?? [])
        .map((id) => fila.get(id))
        .filter((valor): valor is number => valor !== undefined)
      baricentros.set(
        nodo.id,
        filas.length > 0
          ? filas.reduce((suma, valor) => suma + valor, 0) / filas.length
          : (fila.get(nodo.id) ?? 0),
      )
    }
    moviles.sort(
      (a, b) =>
        baricentros.get(a.id)! - baricentros.get(b.id)! ||
        ordenClase[a.clase] - ordenClase[b.clase] ||
        a.nombre.localeCompare(b.nombre, 'es'),
    )
    lista.splice(0, lista.length, ...fijas, ...moviles)
    asignarFilas(lista)
  }

  for (let pasada = 0; pasada < 4; pasada++) {
    for (const columna of capasOrdenadas) {
      ordenarPorVecinos(columnas.get(columna)!, anteriores)
    }
    for (const columna of [...capasOrdenadas].reverse()) {
      ordenarPorVecinos(columnas.get(columna)!, siguientes)
    }
  }

  const PASO_CAMINO_X = 185
  const filaRelativa = new Map<string, number>()
  let filaMinima = 0
  let filaMaxima = 0
  for (const columna of capasOrdenadas) {
    const lista = columnas.get(columna)!
    const espina = lista.filter(esEspina)
    const rituales = lista.filter(esRitualPrincipal)
    const resto = lista.filter((nodo) => !esEspina(nodo) && !esRitualPrincipal(nodo))
    espina.forEach((nodo, indice) => filaRelativa.set(nodo.id, indice))
    rituales.forEach((nodo, indice) => filaRelativa.set(nodo.id, espina.length + indice))

    // Repartir dependencias a ambos lados de la espina reduce la altura a la
    // mitad y permite encuadrar el camino sin volver ilegibles sus nodos.
    const superiores = Math.ceil(resto.length / 2)
    resto.forEach((nodo, indice) => {
      const numeroFila =
        indice < superiores
          ? indice - superiores
          : espina.length + rituales.length + indice - superiores
      filaRelativa.set(nodo.id, numeroFila)
    })
    for (const nodo of lista) {
      const numeroFila = filaRelativa.get(nodo.id) ?? 0
      filaMinima = Math.min(filaMinima, numeroFila)
      filaMaxima = Math.max(filaMaxima, numeroFila)
    }
  }

  const posiciones = new Map<string, { x: number; y: number }>()
  for (const columna of capasOrdenadas) {
    for (const nodo of columnas.get(columna)!) {
      const numeroFila = filaRelativa.get(nodo.id) ?? 0
      posiciones.set(nodo.id, {
        x: columna * PASO_CAMINO_X,
        y: (numeroFila - filaMinima) * PASO_Y,
      })
    }
  }

  const ultimaCapa = capasOrdenadas[capasOrdenadas.length - 1] ?? 0
  return {
    posiciones,
    ancho: ultimaCapa * PASO_CAMINO_X + NODO_W,
    alto: (filaMaxima - filaMinima) * PASO_Y + NODO_H,
  }
}
