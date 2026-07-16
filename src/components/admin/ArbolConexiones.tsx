'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { GitBranch, Maximize2, Minimize2, Network, X } from 'lucide-react'

// Mapa de progresión inspirado en los árboles de habilidades de juegos. El
// color identifica el camino y la silueta distingue cada clase de nodo.

export type NodoArbol = {
  id: string
  nombre: string
  clase: 'elemento' | 'secuencia' | 'avance' | 'ritual'
  tipo: string | null
  tier: number
  caminoIndex: number | null
  secuencia: number | null
  inicial: boolean
  activo: boolean
  espontaneo: boolean
}

export type AristaArbol = {
  de: string
  a: string
  tipo: 'receta' | 'creacion' | 'ascension' | 'requisito' | 'ritual'
  via: string
  // Aristas con el mismo grupo forman una sola combinación (p. ej. los
  // ingredientes de una receta) y se dibujan convergiendo en un punto de unión.
  grupo?: string
}

export type CaminoLeyenda = { nombre: string; index: number }

// Paleta categórica por camino sobre fondo oscuro. Se repite solo si el
// contenido supera diez caminos.
const COLORES_CAMINO = [
  '#3f96c9',
  '#c2841f',
  '#c94f75',
  '#6fae5a',
  '#8d70c9',
  '#d06f43',
  '#4ba6a0',
  '#b8659d',
  '#8f9f42',
  '#6c8fd1',
]
const COLOR_NEUTRO = '#57492f' // line2: nodos sin camino
const COLOR_ARISTA_RECETA = '#7d6f57'
const COLOR_INTERSECCION = '#f2d58a'
const COLOR_DEPENDIENTE = '#77c7e8'
const COLOR_RAIZ_DEPENDENCIA = '#f3d68d'
const COLORES_NIVEL_DEPENDENCIA = ['#77d5ea', '#71bdf0', '#829ff0', '#9a89e8', '#b57edc']

const NODO_W = 128
const NODO_H = 104
const PASO_X = 210
const PASO_Y = 116
const MARGEN = 40
const CENTRO_X = NODO_W / 2
const CENTRO_Y = 38
const RADIO = 29

const ETIQUETA_ARISTA: Record<AristaArbol['tipo'], string> = {
  receta: 'Receta',
  creacion: 'Crea el avance',
  ascension: 'Asciende a',
  requisito: 'Se combina con',
  ritual: 'Ritual',
}

function colorDeCamino(index: number | null): string | null {
  return index !== null && index >= 0
    ? COLORES_CAMINO[index % COLORES_CAMINO.length]
    : null
}

function colorDeNivelDependencia(nivel: number): string {
  return COLORES_NIVEL_DEPENDENCIA[Math.min(Math.max(nivel - 1, 0), COLORES_NIVEL_DEPENDENCIA.length - 1)]
}

function recortar(texto: string, max: number): string {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto
}

function glifoNodo(nodo: NodoArbol): string {
  if (nodo.clase === 'secuencia') return String(nodo.secuencia)
  if (nodo.clase === 'avance') return '↑'
  if (nodo.clase === 'ritual') return '✦'
  if (nodo.inicial) return '★'
  return nodo.nombre.slice(0, 1).toUpperCase()
}

type Combinacion = {
  entradas: string[]
  salidas: string[]
  tipo: AristaArbol['tipo']
  via: string
}

function curva(x1: number, y1: number, x2: number, y2: number): string {
  const xm = x1 + (x2 - x1) / 2
  return `M ${x1} ${y1} C ${xm} ${y1}, ${xm} ${y2}, ${x2} ${y2}`
}

export function ArbolConexiones({
  nodos,
  aristas,
  caminos,
}: {
  nodos: NodoArbol[]
  aristas: AristaArbol[]
  caminos: CaminoLeyenda[]
}) {
  const [vista, setVista] = useState({ x: MARGEN, y: MARGEN, k: 1 })
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [caminosSeleccionados, setCaminosSeleccionados] = useState<number[]>([])
  const [aislado, setAislado] = useState(false)
  const [ramaAislada, setRamaAislada] = useState(false)
  const [hover, setHover] = useState<string | null>(null)
  // Nodo cuyas conexiones fantasma están reveladas en la vista aislada. Se
  // mantiene con un periodo de gracia para poder llegar hasta los fantasmas.
  const [reveladoDe, setReveladoDe] = useState<string | null>(null)
  const [fantasmaHover, setFantasmaHover] = useState<string | null>(null)
  const temporizadorRevelado = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [pantallaCompleta, setPantallaCompleta] = useState(false)
  const raizRef = useRef<HTMLDivElement | null>(null)
  const contenedorRef = useRef<HTMLDivElement | null>(null)
  const arrastreRef = useRef<{ x: number; y: number; pointerId: number; movio: boolean } | null>(null)

  const porId = useMemo(() => new Map(nodos.map((n) => [n.id, n])), [nodos])

  // Las aristas del mismo grupo (los ingredientes de una receta) se funden en
  // una combinación; el resto se dibuja como enlace directo.
  const combinaciones = useMemo(() => {
    const porGrupo = new Map<string, Combinacion>()
    const sueltas: Combinacion[] = []
    for (const arista of aristas) {
      if (!arista.grupo) {
        sueltas.push({ entradas: [arista.de], salidas: [arista.a], tipo: arista.tipo, via: arista.via })
        continue
      }
      let combo = porGrupo.get(arista.grupo)
      if (!combo) {
        combo = { entradas: [], salidas: [], tipo: arista.tipo, via: arista.via }
        porGrupo.set(arista.grupo, combo)
      }
      if (!combo.entradas.includes(arista.de)) combo.entradas.push(arista.de)
      if (!combo.salidas.includes(arista.a)) combo.salidas.push(arista.a)
    }
    return [...porGrupo.values(), ...sueltas]
  }, [aristas])

  // Componentes de un camino: parte de sus secuencias, avances y rituales, y
  // recorre todas las combinaciones hacia atrás. Si una receta tiene varios
  // resultados, todos se incluyen porque se descubren en la misma operación.
  const componentesCaminos = useMemo(() => {
    const porCamino = new Map<number, Set<string>>()
    const union = new Set<string>()

    for (const caminoIndex of caminosSeleccionados) {
      const incluidos = new Set(
        nodos.filter((nodo) => nodo.caminoIndex === caminoIndex).map((nodo) => nodo.id),
      )
      let cambio = true
      while (cambio) {
        cambio = false
        for (const combo of combinaciones) {
          if (!combo.salidas.some((id) => incluidos.has(id))) continue
          for (const id of [...combo.entradas, ...combo.salidas]) {
            if (!incluidos.has(id)) {
              incluidos.add(id)
              cambio = true
            }
          }
        }
      }
      porCamino.set(caminoIndex, incluidos)
      for (const id of incluidos) union.add(id)
    }

    const porNodo = new Map<string, number[]>()
    for (const [caminoIndex, ids] of porCamino) {
      for (const id of ids) porNodo.set(id, [...(porNodo.get(id) ?? []), caminoIndex])
    }

    const interseccion = new Set<string>()
    if (caminosSeleccionados.length >= 2) {
      const [primero, ...resto] = caminosSeleccionados
      for (const id of porCamino.get(primero) ?? []) {
        const nodo = porId.get(id)
        if (
          (nodo?.clase === 'elemento' || nodo?.clase === 'secuencia') &&
          resto.every((index) => porCamino.get(index)?.has(id))
        ) {
          interseccion.add(id)
        }
      }
    }

    return { porCamino, porNodo, union, interseccion }
  }, [caminosSeleccionados, combinaciones, nodos, porId])

  const mostrandoSoloInterseccion = caminosSeleccionados.length >= 2
  const nodosCaminosSeleccionados = caminosSeleccionados.length === 0
    ? null
    : mostrandoSoloInterseccion
      ? componentesCaminos.interseccion
      : componentesCaminos.union

  // Posiciones: capa por camino más largo desde las fuentes (con tope por si
  // los datos formaran un ciclo). Dentro de cada capa, varias pasadas de
  // baricentro acercan cada nodo a sus vecinos para reducir cruces de líneas,
  // y la coordenada vertical final se alinea con la media de sus entradas.
  const disposicion = useMemo(() => {
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
  }, [nodos, aristas, porId])

  // Vista aislada opcional: solo el nodo fijado con sus dependencias a la
  // izquierda y sus resultados a la derecha.
  const disposicionActiva = useMemo(() => {
    if (!seleccion || !aislado) return disposicion
    const entradas = [...new Set(aristas.filter((a) => a.a === seleccion).map((a) => a.de))]
    const salidas = [...new Set(aristas.filter((a) => a.de === seleccion).map((a) => a.a))]
    const soloSalidas = salidas.filter((id) => !entradas.includes(id))
    const filas = Math.max(entradas.length, soloSalidas.length, 1)
    const posiciones = new Map<string, { x: number; y: number }>()
    const centrarFila = (indice: number, total: number) => (indice + (filas - total) / 2) * PASO_Y
    // Margen lateral reservado para los nodos que el hover revela a los lados.
    const margen = 150

    entradas.forEach((id, indice) => posiciones.set(id, { x: margen, y: centrarFila(indice, entradas.length) }))
    posiciones.set(seleccion, { x: margen + PASO_X, y: ((filas - 1) * PASO_Y) / 2 })
    soloSalidas.forEach((id, indice) =>
      posiciones.set(id, { x: margen + PASO_X * 2, y: centrarFila(indice, soloSalidas.length) }),
    )

    return {
      posiciones,
      ancho: PASO_X * 2 + NODO_W + margen * 2,
      alto: filas * PASO_Y,
    }
  }, [seleccion, aislado, disposicion, aristas])

  const cancelarCierreRevelado = () => {
    if (temporizadorRevelado.current !== null) {
      clearTimeout(temporizadorRevelado.current)
      temporizadorRevelado.current = null
    }
  }
  const abrirRevelado = (id: string) => {
    cancelarCierreRevelado()
    setReveladoDe(id)
  }
  const soltarRevelado = () => {
    cancelarCierreRevelado()
    temporizadorRevelado.current = setTimeout(() => setReveladoDe(null), 350)
  }

  useEffect(() => () => cancelarCierreRevelado(), [])

  // Cambiar de nodo aislado (o salir del modo) descarta el revelado actual.
  useEffect(() => {
    cancelarCierreRevelado()
    setReveladoDe(null)
    setFantasmaHover(null)
  }, [seleccion, aislado])

  // En la vista aislada, señalar un vecino revela temporalmente sus propias
  // conexiones que no están en pantalla: un adelanto antes de navegar a él.
  const revelado = useMemo(() => {
    if (!aislado || !seleccion || !reveladoDe || reveladoDe === seleccion) return null
    const base = disposicionActiva.posiciones
    const origen = base.get(reveladoDe)
    if (!origen) return null
    const entradasExtra = [...new Set(aristas.filter((a) => a.a === reveladoDe && !base.has(a.de)).map((a) => a.de))]
    const salidasExtra = [...new Set(aristas.filter((a) => a.de === reveladoDe && !base.has(a.a)).map((a) => a.a))]
    if (entradasExtra.length === 0 && salidasExtra.length === 0) return null
    // Con muchas conexiones la pila desbordaría la vista: se muestra un
    // adelanto acotado y el resto se resume en un contador.
    const LIMITE = 7
    const apilar = (ids: string[], x: number) => {
      const visibles = ids.slice(0, LIMITE)
      return {
        nodos: visibles.map((id, indice) => ({ id, x, y: origen.y + (indice - (visibles.length - 1) / 2) * 92 })),
        ocultos: ids.length - visibles.length,
      }
    }
    return {
      origen,
      entrantes: apilar(entradasExtra, origen.x - 150),
      salientes: apilar(salidasExtra, origen.x + 150),
    }
  }, [aislado, seleccion, reveladoDe, disposicionActiva, aristas])

  // Vecindad para el foco: al señalar un nodo se atenúa todo lo no conectado.
  // Los compañeros de combinación también cuentan: responder «¿con qué se
  // combina esto?» es el uso principal del mapa.
  const vecinos = useMemo(() => {
    const mapa = new Map<string, Set<string>>()
    const anotar = (a: string, b: string) => {
      if (a === b) return
      if (!mapa.has(a)) mapa.set(a, new Set())
      mapa.get(a)!.add(b)
    }
    for (const combo of combinaciones) {
      const participantes = [...combo.entradas, ...combo.salidas]
      for (const a of participantes) for (const b of participantes) anotar(a, b)
    }
    return mapa
  }, [combinaciones])

  const dependientesDirectos = useMemo(() => {
    const mapa = new Map<string, Set<string>>()
    for (const arista of aristas) {
      if (!mapa.has(arista.de)) mapa.set(arista.de, new Set())
      mapa.get(arista.de)!.add(arista.a)
    }
    return mapa
  }, [aristas])

  const profundidadRamaSeleccionada = useMemo(() => {
    const profundidades = new Map<string, number>()
    if (!seleccion) return profundidades
    profundidades.set(seleccion, 0)
    const pendientes = [seleccion]
    while (pendientes.length > 0) {
      const actual = pendientes.pop()!
      const siguienteNivel = profundidades.get(actual)! + 1
      for (const dependiente of dependientesDirectos.get(actual) ?? []) {
        const nivelActual = profundidades.get(dependiente)
        if (nivelActual !== undefined && nivelActual <= siguienteNivel) continue
        profundidades.set(dependiente, siguienteNivel)
        pendientes.push(dependiente)
      }
    }
    return profundidades
  }, [seleccion, dependientesDirectos])

  const ramaDependienteSeleccionada = useMemo(
    () => seleccion ? new Set(profundidadRamaSeleccionada.keys()) : null,
    [seleccion, profundidadRamaSeleccionada],
  )
  const profundidadMaximaSeleccionada = Math.max(0, ...profundidadRamaSeleccionada.values())

  // La rama aislada se recompone desde cero. Reutilizar las coordenadas del
  // mapa completo conservaría los huecos de todos los nodos ocultos.
  const disposicionRamaDependiente = useMemo(() => {
    if (!seleccion || !ramaDependienteSeleccionada) return null
    const PASO_RAMA_X = 165
    const PASO_RAMA_Y = 100
    const porNivel = new Map<number, NodoArbol[]>()
    let maxNivel = 0
    for (const id of ramaDependienteSeleccionada) {
      const nodo = porId.get(id)
      const nivel = profundidadRamaSeleccionada.get(id)
      if (!nodo || nivel === undefined) continue
      if (mostrandoSoloInterseccion && !componentesCaminos.interseccion.has(id)) continue
      porNivel.set(nivel, [...(porNivel.get(nivel) ?? []), nodo])
      maxNivel = Math.max(maxNivel, nivel)
    }

    let maxFilas = 1
    for (const lista of porNivel.values()) {
      lista.sort((a, b) => {
        const yA = disposicion.posiciones.get(a.id)?.y ?? 0
        const yB = disposicion.posiciones.get(b.id)?.y ?? 0
        return yA - yB || a.nombre.localeCompare(b.nombre, 'es')
      })
      maxFilas = Math.max(maxFilas, lista.length)
    }

    const posiciones = new Map<string, { x: number; y: number }>()
    const centroY = ((maxFilas - 1) * PASO_RAMA_Y) / 2
    for (const [nivel, lista] of porNivel) {
      const inicioY = centroY - ((lista.length - 1) * PASO_RAMA_Y) / 2
      lista.forEach((nodo, indice) => {
        posiciones.set(nodo.id, { x: nivel * PASO_RAMA_X, y: inicioY + indice * PASO_RAMA_Y })
      })
    }

    return {
      posiciones,
      ancho: maxNivel * PASO_RAMA_X + NODO_W,
      alto: (maxFilas - 1) * PASO_RAMA_Y + NODO_H,
    }
  }, [seleccion, ramaDependienteSeleccionada, profundidadRamaSeleccionada, mostrandoSoloInterseccion, componentesCaminos.interseccion, porId, disposicion])

  const disposicionMostrada = ramaAislada && disposicionRamaDependiente
    ? disposicionRamaDependiente
    : disposicionActiva

  const consulta = busqueda.trim().toLowerCase()
  const focoId = seleccion ?? hover
  const nodoVisible = (id: string): boolean => {
    const perteneceAlCamino = nodosCaminosSeleccionados?.has(id) ?? false
    if (seleccion) {
      return perteneceAlCamino || (ramaDependienteSeleccionada?.has(id) ?? false)
    }
    if (hover) {
      return perteneceAlCamino || id === hover || (vecinos.get(hover)?.has(id) ?? false)
    }
    if (consulta) {
      const nodo = porId.get(id)
      const coincide = nodo ? nodo.nombre.toLowerCase().includes(consulta) : false
      return coincide && (nodosCaminosSeleccionados === null || perteneceAlCamino)
    }
    if (nodosCaminosSeleccionados) return perteneceAlCamino
    return true
  }
  const comboVisible = (combo: Combinacion): boolean => {
    const participantes = [...combo.entradas, ...combo.salidas]
    const perteneceAlCamino =
      nodosCaminosSeleccionados !== null &&
      participantes.every((id) => nodosCaminosSeleccionados.has(id))
    if (seleccion) {
      const perteneceALaRama =
        combo.entradas.some((id) => ramaDependienteSeleccionada?.has(id)) &&
        combo.salidas.some((id) => ramaDependienteSeleccionada?.has(id))
      return perteneceAlCamino || perteneceALaRama
    }
    if (hover) return perteneceAlCamino || participantes.includes(hover)
    if (consulta) return participantes.some((id) => nodoVisible(id))
    if (nodosCaminosSeleccionados) return perteneceAlCamino
    return true
  }
  const hayResaltado = focoId !== null || consulta.length > 0 || nodosCaminosSeleccionados !== null

  const resultadosBusqueda = useMemo(() => {
    if (!consulta) return []
    return nodos
      .filter((n) => n.nombre.toLowerCase().includes(consulta))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .slice(0, 8)
  }, [consulta, nodos])

  // Zoom con rueda anclado al cursor; React registra wheel como pasivo, así
  // que el listener se instala a mano para poder llamar a preventDefault.
  useEffect(() => {
    const contenedor = contenedorRef.current
    if (!contenedor) return
    const alRodar = (e: WheelEvent) => {
      e.preventDefault()
      const caja = contenedor.getBoundingClientRect()
      const cx = e.clientX - caja.left
      const cy = e.clientY - caja.top
      setVista((v) => {
        const k = Math.min(2.5, Math.max(0.2, v.k * Math.exp(-e.deltaY * 0.0012)))
        return {
          k,
          x: cx - ((cx - v.x) * k) / v.k,
          y: cy - ((cy - v.y) * k) / v.k,
        }
      })
    }
    contenedor.addEventListener('wheel', alRodar, { passive: false })
    return () => contenedor.removeEventListener('wheel', alRodar)
  }, [])

  useEffect(() => {
    const alCambiarPantalla = () => setPantallaCompleta(document.fullscreenElement === raizRef.current)
    document.addEventListener('fullscreenchange', alCambiarPantalla)
    return () => document.removeEventListener('fullscreenchange', alCambiarPantalla)
  }, [])

  // Al deseleccionar se vuelve siempre al mapa completo.
  useEffect(() => {
    if (!seleccion) {
      setAislado(false)
      setRamaAislada(false)
    }
  }, [seleccion])

  const seleccionar = (id: string) => {
    setSeleccion(id)
  }

  // Encuadre inicial: que el grafo entre a lo ancho del contenedor.
  const encuadrar = () => {
    const contenedor = contenedorRef.current
    if (!contenedor) return
    // El panel de detalle tapa el borde derecho; se descuenta del encuadre.
    const anchoUtil = contenedor.clientWidth - (seleccion ? 320 : 0)
    const espacioVertical = contenedor.clientHeight - 64
    const kCalculada = Math.min(
      aislado || ramaAislada ? 1.15 : 1,
      (anchoUtil - MARGEN * 2) / disposicionMostrada.ancho,
      (espacioVertical - MARGEN * 2) / disposicionMostrada.alto,
    )
    const k = Math.max(ramaAislada ? 0.55 : 0.2, kCalculada)
    setVista({
      x: Math.max(MARGEN, (anchoUtil - disposicionMostrada.ancho * k) / 2),
      y: 60 + Math.max(MARGEN, (espacioVertical - disposicionMostrada.alto * k) / 2),
      k,
    })
  }

  const encuadrarNodos = (ids: Set<string>) => {
    const contenedor = contenedorRef.current
    if (!contenedor || ids.size === 0) return encuadrar()
    const posiciones = [...ids]
      .map((id) => disposicionMostrada.posiciones.get(id))
      .filter((pos): pos is { x: number; y: number } => pos !== undefined)
    if (posiciones.length === 0) return encuadrar()

    const minX = Math.min(...posiciones.map((pos) => pos.x))
    const maxX = Math.max(...posiciones.map((pos) => pos.x + NODO_W))
    const minY = Math.min(...posiciones.map((pos) => pos.y))
    const maxY = Math.max(...posiciones.map((pos) => pos.y + NODO_H))
    const ancho = maxX - minX
    const alto = maxY - minY
    const anchoUtil = contenedor.clientWidth - (seleccion ? 320 : 0)
    const espacioVertical = contenedor.clientHeight - 64
    const kCalculada = Math.min(
      1.25,
      (anchoUtil - MARGEN * 2) / ancho,
      (espacioVertical - MARGEN * 2) / alto,
    )
    const k = Math.max(ramaAislada ? 0.55 : 0.2, kCalculada)
    setVista({
      x: (anchoUtil - ancho * k) / 2 - minX * k,
      y: 60 + (espacioVertical - alto * k) / 2 - minY * k,
      k,
    })
  }

  const alternarCamino = (index: number) => {
    setCaminosSeleccionados((actuales) =>
      actuales.includes(index)
        ? actuales.filter((actual) => actual !== index)
        : [...actuales, index],
    )
    setSeleccion(null)
    setAislado(false)
    setRamaAislada(false)
    setBusqueda('')
  }

  const limpiarCaminos = () => {
    setCaminosSeleccionados([])
    setSeleccion(null)
    setAislado(false)
    setRamaAislada(false)
    setBusqueda('')
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (ramaAislada && ramaDependienteSeleccionada) encuadrarNodos(ramaDependienteSeleccionada)
      else if (nodosCaminosSeleccionados) encuadrarNodos(nodosCaminosSeleccionados)
      else encuadrar()
    })
    return () => cancelAnimationFrame(frame)
    // Cambia la geometría al montar, al seleccionar camino y al aislar nodos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disposicionMostrada, nodosCaminosSeleccionados])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (ramaAislada && ramaDependienteSeleccionada) encuadrarNodos(ramaDependienteSeleccionada)
      else if (nodosCaminosSeleccionados) encuadrarNodos(nodosCaminosSeleccionados)
      else encuadrar()
    })
    return () => cancelAnimationFrame(frame)
    // La geometría del contenedor cambia al entrar o salir de pantalla completa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pantallaCompleta])

  useEffect(() => {
    if (!seleccion || aislado || !ramaDependienteSeleccionada) return
    const frame = requestAnimationFrame(() => encuadrarNodos(ramaDependienteSeleccionada))
    return () => cancelAnimationFrame(frame)
    // La selección cambia el área que debe quedar visible junto al panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccion, aislado, ramaAislada, ramaDependienteSeleccionada])

  const alternarPantallaCompleta = async () => {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await raizRef.current?.requestFullscreen()
  }

  const iniciarPan = (e: React.PointerEvent) => {
    arrastreRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId, movio: false }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  const moverPan = (e: React.PointerEvent) => {
    const inicio = arrastreRef.current
    if (!inicio || inicio.pointerId !== e.pointerId) return
    setVista((v) => ({ ...v, x: v.x + e.clientX - inicio.x, y: v.y + e.clientY - inicio.y }))
    arrastreRef.current = { ...inicio, x: e.clientX, y: e.clientY, movio: true }
  }
  const finalizarPan = () => {
    arrastreRef.current = null
  }

  const nodoSeleccionado = seleccion ? (porId.get(seleccion) ?? null) : null
  const entradas = seleccion ? aristas.filter((a) => a.a === seleccion) : []
  const salidas = seleccion ? aristas.filter((a) => a.de === seleccion) : []
  const dependientesSeleccionados = seleccion
    ? [...(dependientesDirectos.get(seleccion) ?? [])]
    : []
  const totalDependientesSeleccionados = Math.max(0, (ramaDependienteSeleccionada?.size ?? 0) - 1)

  const conexionPanel = (arista: AristaArbol, idVecino: string, indice: number) => (
    <li key={indice}>
      <button
        type="button"
        className="w-full rounded-md px-2 py-1 text-left text-fog transition-colors hover:bg-brass/10"
        onClick={() => seleccionar(idVecino)}
      >
        <span className="text-parchment">{porId.get(idVecino)?.nombre ?? '?'}</span>
        <span className="block text-xs">{ETIQUETA_ARISTA[arista.tipo]}: {arista.via}</span>
      </button>
    </li>
  )

  return (
    <div ref={raizRef} className={pantallaCompleta ? 'overflow-auto bg-ink p-4' : ''}>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel/70 p-3 shadow-[inset_0_1px_0_rgba(201,163,92,0.06)]">
        <div className="relative">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar habilidad…"
            className="campo w-64"
            aria-label="Buscar habilidad por nombre"
          />
          {resultadosBusqueda.length > 0 && (
            <ul className="absolute left-0 top-full z-30 mt-1 w-72 overflow-hidden rounded-xl border border-line2 bg-[#111016]/95 py-1 shadow-[0_18px_60px_rgba(0,0,0,0.65)] backdrop-blur-md">
              {resultadosBusqueda.map((nodo) => {
                const color = colorDeCamino(nodo.caminoIndex) ?? COLOR_NEUTRO
                return (
                  <li key={nodo.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-parchment transition-colors hover:bg-brass/10"
                      onClick={() => {
                        setBusqueda('')
                        seleccionar(nodo.id)
                      }}
                    >
                      <span
                        aria-hidden
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: color }}
                      />
                      <span className="truncate">{nodo.nombre}</span>
                      <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wider text-fog">
                        {nodo.clase === 'secuencia' ? `Sec. ${nodo.secuencia}` : nodo.clase}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs text-fog">
          <span className="shrink-0 uppercase tracking-wider">Camino</span>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value !== '') alternarCamino(Number(e.target.value))
            }}
            className="campo min-w-52"
            aria-label="Añadir camino a la comparación"
          >
            <option value="">
              {caminosSeleccionados.length === 0 ? 'Seleccionar camino…' : 'Añadir otro camino…'}
            </option>
            {caminos.filter((camino) => !caminosSeleccionados.includes(camino.index)).map((camino) => (
              <option key={camino.index} value={camino.index}>
                {camino.nombre}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="btn-ghost px-3 py-1"
            aria-label="Acercar"
            onClick={() => setVista((v) => ({ ...v, k: Math.min(2.5, v.k * 1.25) }))}
          >
            +
          </button>
          <button
            type="button"
            className="btn-ghost px-3 py-1"
            aria-label="Alejar"
            onClick={() => setVista((v) => ({ ...v, k: Math.max(0.2, v.k / 1.25) }))}
          >
            −
          </button>
          <button
            type="button"
            className="btn-ghost px-3 py-1"
            onClick={() => {
              if (caminosSeleccionados.length > 0) limpiarCaminos()
              else encuadrar()
            }}
          >
            Ver todo
          </button>
          <button
            type="button"
            className="btn-ghost flex items-center gap-1.5 px-3 py-1"
            onClick={alternarPantallaCompleta}
          >
            {pantallaCompleta ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            {pantallaCompleta ? 'Salir' : 'Pantalla completa'}
          </button>
        </div>
        <p className="text-xs text-fog lg:ml-auto">
          Arrastra para moverte, rueda para acercar, clic para ver conexiones, doble clic para aislar.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-fog">
        {caminos.map((camino) => (
          <button
            key={camino.index}
            type="button"
            aria-pressed={caminosSeleccionados.includes(camino.index)}
            onClick={() => alternarCamino(camino.index)}
            className={`flex items-center gap-1.5 rounded-full border px-2 py-1 transition-colors ${
              caminosSeleccionados.includes(camino.index)
                ? 'border-parchment/60 bg-parchment/10 text-parchment'
                : 'border-transparent hover:border-line hover:bg-panel/60'
            }`}
          >
            <span
              aria-hidden
              className="inline-block h-3 w-3 rounded-full shadow-[0_0_8px_currentColor]"
              style={{ background: colorDeCamino(camino.index) ?? COLOR_NEUTRO, color: colorDeCamino(camino.index) ?? COLOR_NEUTRO }}
            />
            {camino.nombre}
          </button>
        ))}
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-3 rounded-full border border-line2" />
          Sin camino
        </span>
        <span className="text-parchment/70">○ elemento · ◎ secuencia · ◇ avance · ⬡ ritual · ★ inicial</span>
        {caminosSeleccionados.length >= 2 && (
          <span className="font-semibold" style={{ color: COLOR_INTERSECCION }}>
            ∩ compartido por todos los caminos seleccionados
          </span>
        )}
      </div>

      <div
        ref={contenedorRef}
        className={`relative touch-none overflow-hidden rounded-2xl border bg-[#090c12] transition-[border-color,box-shadow] duration-300 ${
          ramaAislada
            ? 'border-[#77c7e8]/50 shadow-[inset_0_0_100px_rgba(35,92,126,0.18),0_20px_70px_-30px_rgba(90,178,225,0.35)]'
            : 'border-line2 shadow-[inset_0_0_80px_rgba(0,0,0,0.85),0_20px_60px_-35px_rgba(0,0,0,0.9)]'
        } ${
          pantallaCompleta ? 'h-[calc(100vh-10rem)] min-h-[420px]' : 'h-[72vh] min-h-[520px]'
        }`}
      >
        <div className={`pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between border-b px-4 py-2 backdrop-blur-sm ${
          ramaAislada ? 'border-[#77c7e8]/25 bg-[#0b141d]/85' : 'border-line/60 bg-ink/55'
        }`}>
          <div className="flex items-center gap-2.5">
            {ramaAislada && (
              <span className="grid h-8 w-8 place-items-center rounded-full border border-[#77c7e8]/40 bg-[#77c7e8]/10 text-[#9de5f5] shadow-[0_0_18px_rgba(119,199,232,0.2)]">
                <GitBranch className="h-4 w-4" />
              </span>
            )}
            <div>
              <p className={`font-[family-name:var(--font-display)] text-xs uppercase tracking-[0.22em] ${ramaAislada ? 'text-[#9de5f5]' : 'text-brass'}`}>
                {ramaAislada ? 'Árbol dependiente' : 'Mapa de progresión'}
              </p>
              <p className="text-[10px] text-fog">
                {ramaAislada
                  ? `${nodoSeleccionado?.nombre ?? 'Selección'} · ${totalDependientesSeleccionados} descendientes en ${profundidadMaximaSeleccionada} niveles`
                  : caminosSeleccionados.length === 0
                    ? 'Las ramas avanzan de izquierda a derecha · las líneas que convergen en un punto se combinan'
                    : caminosSeleccionados.length === 1
                      ? `${caminos.find((camino) => camino.index === caminosSeleccionados[0])?.nombre ?? 'Camino'} · dependencias completas resaltadas`
                      : `${caminosSeleccionados.length} caminos · ${componentesCaminos.interseccion.size} elementos compartidos por todos`}
              </p>
            </div>
          </div>
          <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-wider ${
            ramaAislada ? 'border-[#77c7e8]/35 bg-[#77c7e8]/10 text-[#9de5f5]' : 'border-line text-fog'
          }`}>
            {ramaAislada
              ? `${ramaDependienteSeleccionada?.size ?? 0} nodos`
              : `${nodosCaminosSeleccionados?.size ?? nodos.length} habilidades`}
          </span>
        </div>
        <svg
          role="img"
          aria-label="Grafo de conexiones entre elementos, recetas, avances y caminos"
          className="h-full w-full cursor-grab active:cursor-grabbing"
          onPointerDown={iniciarPan}
          onPointerMove={moverPan}
          onPointerUp={() => {
            const arrastro = arrastreRef.current?.movio
            finalizarPan()
            if (!arrastro) setSeleccion(null)
          }}
          onPointerCancel={finalizarPan}
        >
          <defs>
            <pattern id="skill-grid" width="44" height="44" patternUnits="userSpaceOnUse">
              <path d="M 44 0 L 0 0 0 44" fill="none" stroke="#57492f" strokeWidth="0.45" opacity="0.2" />
              <circle cx="0" cy="0" r="1" fill="#c9a35c" opacity="0.25" />
            </pattern>
            <radialGradient id="skill-node" cx="35%" cy="25%" r="75%">
              <stop offset="0" stopColor="#302819" />
              <stop offset="0.55" stopColor="#191711" />
              <stop offset="1" stopColor="#090b0e" />
            </radialGradient>
            <radialGradient id="branch-background" cx="45%" cy="42%" r="72%">
              <stop offset="0" stopColor="#122b3b" />
              <stop offset="0.48" stopColor="#0b1722" />
              <stop offset="1" stopColor="#070a10" />
            </radialGradient>
            <filter id="skill-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="line-glow" x="-20%" y="-100%" width="140%" height="300%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <rect width="100%" height="100%" fill={ramaAislada ? 'url(#branch-background)' : '#090c12'} />
          <rect width="100%" height="100%" fill="url(#skill-grid)" opacity={ramaAislada ? 0.65 : 1} />
          <g transform={`translate(${vista.x} ${vista.y}) scale(${vista.k})`}>
            {combinaciones.map((combo, indiceCombo) => {
              const participantesCombo = [...combo.entradas, ...combo.salidas]
              if (
                mostrandoSoloInterseccion &&
                !participantesCombo.every((id) => componentesCaminos.interseccion.has(id))
              ) return null
              const conectaRamaDependiente =
                combo.entradas.some((id) => ramaDependienteSeleccionada?.has(id)) &&
                combo.salidas.some((id) => ramaDependienteSeleccionada?.has(id))
              if (ramaAislada && !conectaRamaDependiente) return null
              const posiciones = disposicionMostrada.posiciones
              const entradasPos = combo.entradas
                .map((id) => ({ id, pos: posiciones.get(id) }))
                .filter(
                  (p): p is { id: string; pos: { x: number; y: number } } =>
                    !!p.pos && (!ramaAislada || ramaDependienteSeleccionada?.has(p.id) === true),
                )
              const salidasPos = combo.salidas
                .map((id) => ({ id, pos: posiciones.get(id) }))
                .filter(
                  (p): p is { id: string; pos: { x: number; y: number } } =>
                    !!p.pos && (!ramaAislada || ramaDependienteSeleccionada?.has(p.id) === true),
                )
              if (entradasPos.length === 0 || salidasPos.length === 0) return null

              const visible = comboVisible(combo)
              const nodoCamino =
                combo.tipo === 'receta'
                  ? null
                  : (porId.get(
                      combo.tipo === 'ascension' || combo.tipo === 'requisito'
                        ? combo.entradas[0]
                        : combo.salidas[0],
                    ) ?? null)
              const caminosDelCombo = caminosSeleccionados.filter((index) =>
                participantesCombo.every((id) => componentesCaminos.porCamino.get(index)?.has(id)),
              )
              const esInterseccionCombo =
                caminosSeleccionados.length >= 2 &&
                caminosSeleccionados.every((index) => caminosDelCombo.includes(index))
              const esDependenciaSeleccionada = seleccion !== null && conectaRamaDependiente
              const nivelDependencia = Math.min(
                ...combo.salidas
                  .map((id) => profundidadRamaSeleccionada.get(id))
                  .filter((nivel): nivel is number => nivel !== undefined && nivel > 0),
              )
              const colorSeleccionado = esInterseccionCombo
                ? COLOR_INTERSECCION
                : colorDeCamino(caminosDelCombo[0] ?? null)
              const color =
                esDependenciaSeleccionada
                  ? colorDeNivelDependencia(Number.isFinite(nivelDependencia) ? nivelDependencia : 1)
                  : caminosDelCombo.length > 0 && visible && colorSeleccionado
                  ? colorSeleccionado
                  : combo.tipo === 'receta'
                    ? COLOR_ARISTA_RECETA
                    : (colorDeCamino(nodoCamino?.caminoIndex ?? null) ?? COLOR_ARISTA_RECETA)
              const grosorBase =
                combo.tipo === 'ascension' ? 2.2 : combo.tipo === 'receta' ? 1.1 : combo.tipo === 'ritual' ? 1.8 : 1.5
              const grosor = grosorBase + (esDependenciaSeleccionada ? 0.8 : 0)
              const guiones =
                combo.tipo === 'creacion' ? '6 4' : combo.tipo === 'requisito' || combo.tipo === 'ritual' ? '2 4' : undefined
              const titulo = `${ETIQUETA_ARISTA[combo.tipo]}: ${combo.via}`

              const salidasDe = (x1: number, y1: number) =>
                salidasPos.map(({ pos }, i) => {
                  const x2 = pos.x + CENTRO_X - RADIO
                  const y2 = pos.y + CENTRO_Y
                  return (
                    <g key={`s${i}`}>
                      <path d={curva(x1, y1, x2, y2)} fill="none" stroke="#050608" strokeWidth={grosor + 5} strokeLinecap="round" />
                      <path
                        d={curva(x1, y1, x2, y2)}
                        fill="none"
                        stroke={color}
                        strokeWidth={grosor}
                        strokeDasharray={guiones}
                        strokeLinecap="round"
                        filter={visible && hayResaltado ? 'url(#line-glow)' : undefined}
                      />
                      <path
                        d={`M ${x2 - 7} ${y2 - 4.5} L ${x2 - 0.5} ${y2} L ${x2 - 7} ${y2 + 4.5}`}
                        fill="none"
                        stroke={color}
                        strokeWidth={grosor + 0.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  )
                })

              if (entradasPos.length <= 1) {
                const { pos } = entradasPos[0]
                const x1 = pos.x + CENTRO_X + RADIO
                const y1 = pos.y + CENTRO_Y
                return (
                  <g key={indiceCombo} opacity={visible ? (hayResaltado ? 1 : 0.58) : 0.05}>
                    {salidasDe(x1, y1)}
                    <title>{titulo}</title>
                  </g>
                )
              }

              // Punto de unión: los ingredientes convergen antes del resultado.
              const maxSalidaEntrada = Math.max(...entradasPos.map(({ pos }) => pos.x + CENTRO_X + RADIO))
              const minEntradaSalida = Math.min(...salidasPos.map(({ pos }) => pos.x + CENTRO_X - RADIO))
              const todasY = [...entradasPos, ...salidasPos].map(({ pos }) => pos.y + CENTRO_Y)
              const jx = (maxSalidaEntrada + minEntradaSalida) / 2
              const jy = todasY.reduce((suma, y) => suma + y, 0) / todasY.length
              return (
                <g key={indiceCombo} opacity={visible ? (hayResaltado ? 1 : 0.58) : 0.05}>
                  {entradasPos.map(({ pos }, i) => {
                    const x1 = pos.x + CENTRO_X + RADIO
                    const y1 = pos.y + CENTRO_Y
                    return (
                      <g key={`e${i}`}>
                        <path d={curva(x1, y1, jx, jy)} fill="none" stroke="#050608" strokeWidth={grosor + 5} strokeLinecap="round" />
                        <path
                          d={curva(x1, y1, jx, jy)}
                          fill="none"
                          stroke={color}
                          strokeWidth={grosor}
                          strokeDasharray={guiones}
                          strokeLinecap="round"
                          filter={visible && hayResaltado ? 'url(#line-glow)' : undefined}
                        />
                      </g>
                    )
                  })}
                  {salidasDe(jx, jy)}
                  <circle
                    cx={jx}
                    cy={jy}
                    r={4}
                    fill={color}
                    stroke="#050608"
                    strokeWidth={1.5}
                    filter={visible && hayResaltado ? 'url(#skill-glow)' : undefined}
                  />
                  <title>{titulo}</title>
                </g>
              )
            })}

            {nodos.map((nodo) => {
              if (mostrandoSoloInterseccion && !componentesCaminos.interseccion.has(nodo.id)) {
                return null
              }
              if (ramaAislada && !ramaDependienteSeleccionada?.has(nodo.id)) return null
              const pos = disposicionMostrada.posiciones.get(nodo.id)
              if (!pos) return null
              const color = colorDeCamino(nodo.caminoIndex)
              const caminosDelNodo = componentesCaminos.porNodo.get(nodo.id) ?? []
              const resaltadoCamino = caminosDelNodo.length > 0
              const esInterseccion = componentesCaminos.interseccion.has(nodo.id)
              const nivelDependenciaNodo = profundidadRamaSeleccionada.get(nodo.id)
              const esRaizDependencia = seleccion === nodo.id
              const esDependienteSeleccionado =
                nivelDependenciaNodo !== undefined && nivelDependenciaNodo > 0
              const borde =
                (esRaizDependencia
                  ? COLOR_RAIZ_DEPENDENCIA
                  : esDependienteSeleccionado
                  ? colorDeNivelDependencia(nivelDependenciaNodo)
                  : esInterseccion
                  ? COLOR_INTERSECCION
                  : resaltadoCamino
                    ? colorDeCamino(caminosDelNodo[0])
                    : color) ?? COLOR_NEUTRO
              const visible = nodoVisible(nodo.id)
              return (
                <g
                  key={nodo.id}
                  transform={`translate(${pos.x} ${pos.y})`}
                  opacity={visible ? (nodo.activo ? 1 : 0.55) : 0.08}
                  className="cursor-pointer"
                  onPointerDown={(e) => e.stopPropagation()}
                  // Sin esto, el pointerup llega al fondo del SVG y deselecciona
                  // un instante, lo que sacaría del modo aislado al navegar.
                  onPointerUp={(e) => e.stopPropagation()}
                  onPointerEnter={() => {
                    setHover(nodo.id)
                    if (aislado) abrirRevelado(nodo.id)
                  }}
                  onPointerLeave={() => {
                    setHover(null)
                    if (aislado) soltarRevelado()
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    // El segundo clic de un doble clic no debe alternar la selección.
                    if (e.detail > 1) return
                    if (seleccion === nodo.id) setSeleccion(null)
                    else seleccionar(nodo.id)
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    seleccionar(nodo.id)
                    setAislado(true)
                    setRamaAislada(false)
                  }}
                >
                  {esRaizDependencia && (
                    <g pointerEvents="none">
                      <circle
                        cx={CENTRO_X}
                        cy={CENTRO_Y}
                        r={44}
                        fill="none"
                        stroke={COLOR_RAIZ_DEPENDENCIA}
                        strokeWidth={7}
                        opacity={0.1}
                        filter="url(#skill-glow)"
                      />
                      <circle
                        cx={CENTRO_X}
                        cy={CENTRO_Y}
                        r={41}
                        fill="none"
                        stroke={COLOR_RAIZ_DEPENDENCIA}
                        strokeWidth={1.5}
                        strokeDasharray="3 6"
                        opacity={0.9}
                      />
                    </g>
                  )}
                  {(seleccion === nodo.id || hover === nodo.id || resaltadoCamino || esDependienteSeleccionado) && (
                    <circle
                      cx={CENTRO_X}
                      cy={CENTRO_Y}
                      r={39}
                      fill={borde}
                      opacity={seleccion === nodo.id || hover === nodo.id ? 0.22 : esDependienteSeleccionado ? 0.18 : 0.12}
                      filter="url(#skill-glow)"
                    />
                  )}
                  {nodo.clase === 'avance' ? (
                    <path
                      d={`M ${CENTRO_X} ${CENTRO_Y - 33} L ${CENTRO_X + 33} ${CENTRO_Y} L ${CENTRO_X} ${CENTRO_Y + 33} L ${CENTRO_X - 33} ${CENTRO_Y} Z`}
                      fill="url(#skill-node)"
                      stroke={seleccion === nodo.id ? '#e9dcbe' : borde}
                      strokeWidth={seleccion === nodo.id || resaltadoCamino || esDependienteSeleccionado ? 3 : 2}
                    />
                  ) : nodo.clase === 'ritual' ? (
                    <path
                      d={`M ${CENTRO_X - 27} ${CENTRO_Y - 20} L ${CENTRO_X} ${CENTRO_Y - 35} L ${CENTRO_X + 27} ${CENTRO_Y - 20} L ${CENTRO_X + 27} ${CENTRO_Y + 20} L ${CENTRO_X} ${CENTRO_Y + 35} L ${CENTRO_X - 27} ${CENTRO_Y + 20} Z`}
                      fill="url(#skill-node)"
                      stroke={seleccion === nodo.id ? '#e9dcbe' : borde}
                      strokeWidth={seleccion === nodo.id || resaltadoCamino || esDependienteSeleccionado ? 3 : 2}
                      strokeDasharray="3 3"
                    />
                  ) : (
                    <>
                      {nodo.clase === 'secuencia' && (
                        <circle
                          cx={CENTRO_X}
                          cy={CENTRO_Y}
                          r={35}
                          fill="none"
                          stroke={borde}
                          strokeWidth={2}
                          opacity={0.65}
                        />
                      )}
                      <circle
                        cx={CENTRO_X}
                        cy={CENTRO_Y}
                        r={nodo.clase === 'secuencia' ? 29 : RADIO}
                        fill="url(#skill-node)"
                        stroke={seleccion === nodo.id ? '#e9dcbe' : borde}
                        strokeWidth={nodo.clase === 'secuencia' || seleccion === nodo.id || resaltadoCamino || esDependienteSeleccionado ? 3 : 2}
                      />
                    </>
                  )}
                  <circle cx={CENTRO_X} cy={CENTRO_Y} r={21} fill="none" stroke={borde} strokeWidth={0.7} opacity={0.45} />
                  <text
                    x={CENTRO_X}
                    y={CENTRO_Y + 6}
                    fill="#e9dcbe"
                    fontSize={nodo.clase === 'secuencia' ? 18 : 17}
                    fontWeight="600"
                    textAnchor="middle"
                    style={{ userSelect: 'none', fontFamily: 'var(--font-display)' }}
                  >
                    {glifoNodo(nodo)}
                  </text>
                  {nodo.espontaneo && (
                    <circle cx={CENTRO_X + 25} cy={CENTRO_Y - 23} r={4} fill="#e9dcbe" stroke={borde} strokeWidth={2} />
                  )}
                  {esDependienteSeleccionado && (
                    <g aria-label={`Nivel ${nivelDependenciaNodo} de dependencia`}>
                      <circle
                        cx={CENTRO_X - 39}
                        cy={CENTRO_Y}
                        r={9}
                        fill="#0b1119"
                        stroke={borde}
                        strokeWidth={1.5}
                      />
                      <text
                        x={CENTRO_X - 39}
                        y={CENTRO_Y + 3.5}
                        fill={borde}
                        fontSize={9}
                        fontWeight="700"
                        textAnchor="middle"
                      >
                        {nivelDependenciaNodo}
                      </text>
                    </g>
                  )}
                  {esInterseccion && (
                    <g aria-label="Elemento compartido por los caminos seleccionados">
                      <circle
                        cx={CENTRO_X - 27}
                        cy={CENTRO_Y - 25}
                        r={9}
                        fill="#111016"
                        stroke={COLOR_INTERSECCION}
                        strokeWidth={1.5}
                      />
                      <text
                        x={CENTRO_X - 27}
                        y={CENTRO_Y - 21.5}
                        fill={COLOR_INTERSECCION}
                        fontSize={11}
                        fontWeight="700"
                        textAnchor="middle"
                      >
                        ∩
                      </text>
                    </g>
                  )}
                  <text
                    x={CENTRO_X}
                    y={82}
                    fill="#e9dcbe"
                    fontSize={11.5}
                    fontWeight="600"
                    textAnchor="middle"
                    style={{ userSelect: 'none' }}
                  >
                    {recortar(nodo.nombre, 19)}
                  </text>
                  <text
                    x={CENTRO_X}
                    y={98}
                    fill={borde}
                    fontSize={8.5}
                    textAnchor="middle"
                    letterSpacing="1.1"
                    style={{ userSelect: 'none', textTransform: 'uppercase' }}
                  >
                    {nodo.activo
                      ? nodo.clase === 'secuencia'
                        ? `SECUENCIA ${nodo.secuencia}`
                        : esDependienteSeleccionado
                          ? `N${nivelDependenciaNodo} · ${nodo.tipo ?? nodo.clase}`
                          : nodo.tipo ?? nodo.clase
                      : 'INACTIVO'}
                  </text>
                  {nodo.inicial && nodo.clase !== 'elemento' && (
                    <text x={CENTRO_X - 31} y={CENTRO_Y - 25} fill="#e9dcbe" fontSize={10}>★</text>
                  )}
                  <title>
                    {`${nodo.nombre}${nodo.activo ? '' : ' (inactivo)'} — ${nodo.clase}` +
                      (nodo.tipo ? ` · ${nodo.tipo}` : '') +
                      (nodo.espontaneo ? ' · desbloqueo espontáneo' : '') +
                      (esInterseccion ? ' · compartido por los caminos seleccionados' : '') +
                      (esDependienteSeleccionado ? ' · depende directa o indirectamente de la selección' : '')}
                  </title>
                </g>
              )
            })}

            {revelado && (
              <g>
                {[revelado.entrantes, revelado.salientes].map((lado, i) =>
                  lado.ocultos > 0 && lado.nodos.length > 0 ? (
                    <text
                      key={i}
                      pointerEvents="none"
                      x={lado.nodos[0].x + CENTRO_X}
                      y={lado.nodos[lado.nodos.length - 1].y + CENTRO_Y + 62}
                      fill="#e9dcbe"
                      fontSize={10.5}
                      textAnchor="middle"
                      opacity={0.75}
                      style={{ userSelect: 'none' }}
                    >
                      +{lado.ocultos} más
                    </text>
                  ) : null,
                )}
                {[
                  ...revelado.entrantes.nodos.map((f) => ({ ...f, entrante: true })),
                  ...revelado.salientes.nodos.map((f) => ({ ...f, entrante: false })),
                ].map((fantasma) => {
                  const nodo = porId.get(fantasma.id)
                  if (!nodo) return null
                  const borde = colorDeCamino(nodo.caminoIndex) ?? COLOR_NEUTRO
                  const activo = fantasmaHover === fantasma.id
                  const ox = revelado.origen.x + CENTRO_X
                  const oy = revelado.origen.y + CENTRO_Y
                  const gx = fantasma.x + CENTRO_X
                  const gy = fantasma.y + CENTRO_Y
                  const trazado = fantasma.entrante
                    ? curva(gx + 20, gy, ox - RADIO, oy)
                    : curva(ox + RADIO, oy, gx - 20, gy)
                  return (
                    <g
                      key={fantasma.id}
                      opacity={activo ? 1 : 0.85}
                      className="cursor-pointer"
                      onPointerDown={(e) => e.stopPropagation()}
                      onPointerUp={(e) => e.stopPropagation()}
                      onPointerEnter={() => {
                        // Mientras el puntero esté sobre un fantasma, el
                        // revelado no se cierra.
                        cancelarCierreRevelado()
                        setFantasmaHover(fantasma.id)
                      }}
                      onPointerLeave={() => {
                        setFantasmaHover(null)
                        soltarRevelado()
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        seleccionar(fantasma.id)
                      }}
                    >
                      <path d={trazado} fill="none" stroke="#050608" strokeWidth={5} strokeLinecap="round" />
                      <path
                        d={trazado}
                        fill="none"
                        stroke={borde}
                        strokeWidth={activo ? 1.8 : 1.2}
                        strokeDasharray={activo ? undefined : '3 3'}
                        strokeLinecap="round"
                      />
                      {!fantasma.entrante && (
                        <path
                          d={`M ${gx - 26} ${gy - 4} L ${gx - 20.5} ${gy} L ${gx - 26} ${gy + 4}`}
                          fill="none"
                          stroke={borde}
                          strokeWidth={1.6}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                      {activo && (
                        <circle cx={gx} cy={gy} r={27} fill={borde} opacity={0.22} filter="url(#skill-glow)" />
                      )}
                      <circle
                        cx={gx}
                        cy={gy}
                        r={20}
                        fill="#0b0d12"
                        stroke={activo ? '#e9dcbe' : borde}
                        strokeWidth={activo ? 2 : 1.5}
                        strokeDasharray={activo ? undefined : '4 3'}
                      />
                      <text
                        x={gx}
                        y={gy + 4.5}
                        fill="#e9dcbe"
                        fontSize={12}
                        fontWeight="600"
                        textAnchor="middle"
                        style={{ userSelect: 'none', fontFamily: 'var(--font-display)' }}
                      >
                        {glifoNodo(nodo)}
                      </text>
                      <text
                        x={gx}
                        y={gy + 36}
                        fill="#e9dcbe"
                        fontSize={10}
                        textAnchor="middle"
                        style={{ userSelect: 'none' }}
                      >
                        {recortar(nodo.nombre, 16)}
                      </text>
                      <title>{`${nodo.nombre} — clic para aislarlo`}</title>
                    </g>
                  )
                })}
              </g>
            )}
          </g>
        </svg>

        {nodoSeleccionado && (
          <aside
            aria-label={`Detalle de ${nodoSeleccionado.nombre}`}
            className={`absolute bottom-3 right-3 top-16 w-[min(19rem,calc(100%-1.5rem))] overflow-y-auto rounded-xl border p-4 text-sm backdrop-blur-md transition-colors ${
              ramaAislada
                ? 'border-[#77c7e8]/40 bg-[#0d151e]/95 shadow-[0_18px_60px_rgba(0,0,0,0.65),0_0_35px_rgba(78,159,201,0.12)]'
                : 'border-line2 bg-[#111016]/95 shadow-[0_18px_60px_rgba(0,0,0,0.65)]'
            }`}
          >
            <div className={`mb-3 h-px bg-gradient-to-r from-transparent to-transparent ${ramaAislada ? 'via-[#77c7e8]' : 'via-brass-deep'}`} />
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-[family-name:var(--font-display)] font-semibold text-parchment">
                {nodoSeleccionado.inicial ? '★ ' : ''}
                {nodoSeleccionado.nombre}
                {!nodoSeleccionado.activo && <span className="text-fog"> (inactivo)</span>}
              </h3>
              <button
                type="button"
                aria-label="Cerrar detalle"
                className="btn-ghost -mr-1 -mt-1 shrink-0 px-1.5 py-1"
                onClick={() => setSeleccion(null)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-brass-deep">
              {nodoSeleccionado.clase}
              {nodoSeleccionado.tipo ? ` · ${nodoSeleccionado.tipo}` : ''}
              {nodoSeleccionado.secuencia !== null ? ` · Secuencia ${nodoSeleccionado.secuencia}` : ''}
            </p>
            {nodoSeleccionado.espontaneo && (
              <p className="mt-1 text-xs text-fog">Se desbloquea de forma espontánea.</p>
            )}
            <div className="mt-3 overflow-hidden rounded-lg border border-[#77c7e8]/25 bg-gradient-to-br from-[#77c7e8]/10 via-[#121a25]/80 to-[#9a89e8]/10">
              <div className="flex items-center gap-2 border-b border-[#77c7e8]/15 px-3 py-2">
                <Network className="h-3.5 w-3.5 text-[#9de5f5]" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9de5f5]">
                  Alcance dependiente
                </span>
              </div>
              <div className="grid grid-cols-3 divide-x divide-[#77c7e8]/15 text-center">
                <div className="px-1 py-2">
                  <strong className="block font-[family-name:var(--font-display)] text-base text-parchment">
                    {dependientesSeleccionados.length}
                  </strong>
                  <span className="text-[9px] uppercase tracking-wider text-fog">Directos</span>
                </div>
                <div className="px-1 py-2">
                  <strong className="block font-[family-name:var(--font-display)] text-base text-parchment">
                    {totalDependientesSeleccionados}
                  </strong>
                  <span className="text-[9px] uppercase tracking-wider text-fog">Totales</span>
                </div>
                <div className="px-1 py-2">
                  <strong className="block font-[family-name:var(--font-display)] text-base text-parchment">
                    {profundidadMaximaSeleccionada}
                  </strong>
                  <span className="text-[9px] uppercase tracking-wider text-fog">Niveles</span>
                </div>
              </div>
              <div className="h-1 bg-gradient-to-r from-[#77d5ea] via-[#829ff0] to-[#b57edc] opacity-80" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={aislado}
                className={`min-h-14 rounded-lg border px-2 py-2 text-xs transition-all ${
                  aislado
                    ? 'border-brass/60 bg-brass/15 text-parchment shadow-[0_0_18px_rgba(201,163,92,0.12)]'
                    : 'border-line2 bg-panel/45 text-fog hover:border-brass-deep hover:text-parchment'
                }`}
                onClick={() => {
                  if (aislado) setAislado(false)
                  else {
                    setAislado(true)
                    setRamaAislada(false)
                  }
                }}
              >
                <Network className="mx-auto mb-1 h-3.5 w-3.5" />
                {aislado ? 'Volver al mapa' : 'Aislar conexiones inmediatas'}
              </button>
              <button
                type="button"
                aria-pressed={ramaAislada}
                className={`min-h-14 rounded-lg border px-2 py-2 text-xs transition-all ${
                  ramaAislada
                    ? 'border-[#77c7e8]/60 bg-gradient-to-br from-[#77c7e8]/20 to-[#9a89e8]/15 text-[#c8f3fb] shadow-[0_0_22px_rgba(119,199,232,0.16)]'
                    : 'border-line2 bg-panel/45 text-fog hover:border-[#77c7e8]/45 hover:text-[#c8f3fb]'
                }`}
                onClick={() => {
                  if (ramaAislada) setRamaAislada(false)
                  else {
                    setRamaAislada(true)
                    setAislado(false)
                  }
                }}
              >
                <GitBranch className="mx-auto mb-1 h-3.5 w-3.5" />
                {ramaAislada ? 'Volver al mapa' : 'Aislar árbol dependiente'}
              </button>
            </div>
            {entradas.length > 0 && (
              <>
                <h4 className="mt-3 text-xs uppercase tracking-wider text-brass-deep">Le llega de</h4>
                <ul className="mt-1 space-y-0.5">
                  {entradas.map((arista, i) => conexionPanel(arista, arista.de, i))}
                </ul>
              </>
            )}
            {salidas.length > 0 && (
              <>
                <h4 className="mt-3 text-xs uppercase tracking-wider" style={{ color: COLOR_DEPENDIENTE }}>
                  Dependientes directos
                </h4>
                <ul className="mt-1 space-y-0.5">
                  {salidas.map((arista, i) => conexionPanel(arista, arista.a, i))}
                </ul>
              </>
            )}
            {entradas.length === 0 && salidas.length === 0 && (
              <p className="mt-3 text-xs italic text-fog">Sin conexiones registradas.</p>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}
