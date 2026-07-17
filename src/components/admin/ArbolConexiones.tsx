'use client'

// Mapa completo de progresión: todos los nodos y relaciones a la vez, con
// comparación de caminos, vista aislada y árbol dependiente. Es la vista
// «avanzada»; el explorador y la espina de camino cubren el uso diario.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GitBranch, Maximize2, Minimize2, Network, X } from 'lucide-react'
import {
  CENTRO_X,
  CENTRO_Y,
  COLOR_ARISTA_RECETA,
  COLOR_DEPENDIENTE,
  COLOR_DESBLOQUEO,
  COLOR_FALLO,
  COLOR_INTERSECCION,
  COLOR_NEUTRO,
  COLOR_RAIZ_DEPENDENCIA,
  ESTILO_ARISTA,
  ETIQUETA_ARISTA,
  MARGEN,
  NODO_H,
  NODO_W,
  ORDEN_PANEL,
  PASO_X,
  PASO_Y,
  RADIO,
  agruparCombinaciones,
  colorDeCamino,
  colorDeNivelDependencia,
  curva,
  glifoTexto,
  recortar,
  type AristaArbol,
  type CaminoLeyenda,
  type Combinacion,
  type NodoArbol,
} from './arbol/tipos'
import { calcularDisposicion, calcularDisposicionCamino } from './arbol/disposicion'
import {
  ComboLinea,
  DefsArbol,
  MuestraArista,
  NodoItem,
  detenerPuntero,
  usePanZoom,
} from './arbol/primitivas'

export type { AristaArbol, CaminoLeyenda, NodoArbol }

export function ArbolConexiones({
  nodos,
  aristas,
  caminos,
}: {
  nodos: NodoArbol[]
  aristas: AristaArbol[]
  caminos: CaminoLeyenda[]
}) {
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
  const escenaRef = useRef<SVGGElement | null>(null)
  const { fijarVista, zoomEscalonado, iniciarPan, moverPan, terminarPan } = usePanZoom(
    contenedorRef,
    escenaRef,
  )

  const porId = useMemo(() => new Map(nodos.map((n) => [n.id, n])), [nodos])

  const combinaciones = useMemo(() => agruparCombinaciones(aristas), [aristas])

  const indiceCombinaciones = useMemo(() => {
    const porSalida = new Map<string, Combinacion[]>()
    const porEntrada = new Map<string, Combinacion[]>()
    for (const combo of combinaciones) {
      for (const id of combo.salidas) {
        porSalida.set(id, [...(porSalida.get(id) ?? []), combo])
      }
      for (const id of combo.entradas) {
        porEntrada.set(id, [...(porEntrada.get(id) ?? []), combo])
      }
    }
    return { porSalida, porEntrada }
  }, [combinaciones])

  // Componentes de un camino: parte de sus secuencias, avances y rituales, y
  // recorre sus prerrequisitos hacia atrás. Los resultados secundarios no se
  // expanden y una secuencia de otro camino actúa como hoja: ambas reglas
  // impiden que ciclos compartidos absorban casi todo el grafo.
  const componentesCaminos = useMemo(() => {
    const porCamino = new Map<number, Set<string>>()
    const combinacionesPorCamino = new Map<number, Set<Combinacion>>()
    const union = new Set<string>()

    for (const caminoIndex of caminosSeleccionados) {
      const raices = nodos
        .filter((nodo) => nodo.caminoIndex === caminoIndex)
        .map((nodo) => nodo.id)
      const incluidos = new Set(raices)
      const combosIncluidos = new Set<Combinacion>()
      const procesados = new Set<string>()
      const pendientes = [...raices]

      while (pendientes.length > 0) {
        const actual = pendientes.pop()!
        if (procesados.has(actual)) continue
        procesados.add(actual)
        const nodo = porId.get(actual)
        if (
          nodo &&
          nodo.caminoIndex !== null &&
          nodo.caminoIndex !== caminoIndex &&
          nodo.clase !== 'elemento'
        ) {
          continue
        }
        for (const combo of indiceCombinaciones.porSalida.get(actual) ?? []) {
          if (combo.tipo === 'fallo') continue
          combosIncluidos.add(combo)
          for (const id of combo.entradas) {
            incluidos.add(id)
            if (!procesados.has(id)) pendientes.push(id)
          }
        }
      }

      // Los fallos de los rituales y desbloqueos OR disparados por una
      // secuencia pertenecen al camino, pero se muestran como hojas y no como
      // requisitos. Un AND global no pertenece a un camino por contener uno
      // solo de sus requisitos.
      for (const raiz of raices) {
        for (const combo of indiceCombinaciones.porEntrada.get(raiz) ?? []) {
          if (combo.tipo !== 'fallo' && combo.tipo !== 'desbloqueo') {
            continue
          }
          combosIncluidos.add(combo)
          for (const id of [...combo.entradas, ...combo.salidas]) incluidos.add(id)
        }
      }

      porCamino.set(caminoIndex, incluidos)
      combinacionesPorCamino.set(caminoIndex, combosIncluidos)
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

    return { porCamino, combinacionesPorCamino, porNodo, union, interseccion }
  }, [caminosSeleccionados, indiceCombinaciones, nodos, porId])

  const mostrandoSoloInterseccion = caminosSeleccionados.length >= 2
  const nodosCaminosSeleccionados = caminosSeleccionados.length === 0
    ? null
    : mostrandoSoloInterseccion
      ? componentesCaminos.interseccion
      : componentesCaminos.union

  const combinacionesCaminosSeleccionados = useMemo(() => {
    if (caminosSeleccionados.length === 0) return null
    const [primero, ...resto] = caminosSeleccionados
    const base =
      componentesCaminos.combinacionesPorCamino.get(primero) ?? new Set<Combinacion>()
    return new Set(
      [...base].filter((combo) =>
        resto.every((index) =>
          componentesCaminos.combinacionesPorCamino.get(index)?.has(combo),
        ),
      ),
    )
  }, [caminosSeleccionados, componentesCaminos])

  const disposicionGlobal = useMemo(() => calcularDisposicion(nodos, aristas), [nodos, aristas])
  const subgrafoCamino = useMemo(() => {
    if (!nodosCaminosSeleccionados || !combinacionesCaminosSeleccionados) return null
    const aristasCamino: AristaArbol[] = []
    for (const combo of combinacionesCaminosSeleccionados) {
      for (const de of combo.entradas) {
        if (!nodosCaminosSeleccionados.has(de)) continue
        for (const a of combo.salidas) {
          if (!nodosCaminosSeleccionados.has(a)) continue
          aristasCamino.push({ de, a, tipo: combo.tipo, via: combo.via })
        }
      }
    }
    return {
      nodos: nodos.filter((nodo) => nodosCaminosSeleccionados.has(nodo.id)),
      aristas: aristasCamino,
    }
  }, [nodosCaminosSeleccionados, combinacionesCaminosSeleccionados, nodos])
  const disposicion = useMemo(() => {
    if (!subgrafoCamino) return disposicionGlobal
    return calcularDisposicionCamino(
      subgrafoCamino.nodos,
      subgrafoCamino.aristas,
      caminosSeleccionados.length === 1 ? caminosSeleccionados[0] : null,
    )
  }, [subgrafoCamino, disposicionGlobal, caminosSeleccionados])

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

  const cancelarCierreRevelado = useCallback(() => {
    if (temporizadorRevelado.current !== null) {
      clearTimeout(temporizadorRevelado.current)
      temporizadorRevelado.current = null
    }
  }, [])
  const abrirRevelado = useCallback((id: string) => {
    cancelarCierreRevelado()
    setReveladoDe(id)
  }, [cancelarCierreRevelado])
  const soltarRevelado = useCallback(() => {
    cancelarCierreRevelado()
    temporizadorRevelado.current = setTimeout(() => setReveladoDe(null), 350)
  }, [cancelarCierreRevelado])

  useEffect(() => () => cancelarCierreRevelado(), [cancelarCierreRevelado])

  // Cambiar de nodo aislado (o salir del modo) descarta el revelado actual.
  useEffect(() => {
    cancelarCierreRevelado()
    setReveladoDe(null)
    setFantasmaHover(null)
  }, [seleccion, aislado, cancelarCierreRevelado])

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

  // Conjunto de nodos resaltados según el foco activo (selección > hover >
  // búsqueda > caminos). `null` significa «sin foco»: todo a opacidad plena.
  const conjuntoResaltado = useMemo(() => {
    const caminoSet = nodosCaminosSeleccionados
    if (seleccion) {
      const conjunto = new Set(ramaDependienteSeleccionada ?? [])
      if (caminoSet) for (const id of caminoSet) conjunto.add(id)
      return conjunto
    }
    if (hover) {
      const conjunto = new Set<string>([hover])
      for (const id of vecinos.get(hover) ?? []) conjunto.add(id)
      if (caminoSet) for (const id of caminoSet) conjunto.add(id)
      return conjunto
    }
    if (consulta) {
      const conjunto = new Set<string>()
      for (const nodo of nodos) {
        if (!nodo.nombre.toLowerCase().includes(consulta)) continue
        if (caminoSet && !caminoSet.has(nodo.id)) continue
        conjunto.add(nodo.id)
      }
      return conjunto
    }
    if (caminoSet) return caminoSet
    return null
  }, [seleccion, hover, consulta, nodosCaminosSeleccionados, ramaDependienteSeleccionada, vecinos, nodos])

  const hayResaltado = conjuntoResaltado !== null

  const comboResaltado = (participantes: string[], conectaRama: boolean): boolean => {
    const participantesPresentes = participantes.filter((id) =>
      disposicionMostrada.posiciones.has(id),
    )
    const pertenece =
      nodosCaminosSeleccionados !== null &&
      participantesPresentes.length > 0 &&
      participantesPresentes.every((id) => nodosCaminosSeleccionados.has(id))
    if (seleccion) return pertenece || conectaRama
    if (hover) return pertenece || participantes.includes(hover)
    if (consulta) return participantes.some((id) => conjuntoResaltado?.has(id) ?? false)
    if (nodosCaminosSeleccionados) return pertenece
    return false
  }

  const resultadosBusqueda = useMemo(() => {
    if (!consulta) return []
    return nodos
      .filter((n) => n.nombre.toLowerCase().includes(consulta))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .slice(0, 8)
  }, [consulta, nodos])

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
    if (!contenedor || contenedor.clientWidth === 0) return
    // El panel de detalle tapa el borde derecho; se descuenta del encuadre.
    const anchoUtil = contenedor.clientWidth - (seleccion ? 320 : 0)
    const espacioVertical = contenedor.clientHeight - 64
    const kCalculada = Math.min(
      aislado || ramaAislada ? 1.15 : 1,
      (anchoUtil - MARGEN * 2) / disposicionMostrada.ancho,
      (espacioVertical - MARGEN * 2) / disposicionMostrada.alto,
    )
    const k = Math.max(ramaAislada ? 0.55 : 0.2, kCalculada)
    fijarVista({
      x: Math.max(MARGEN, (anchoUtil - disposicionMostrada.ancho * k) / 2),
      y: 60 + Math.max(MARGEN, (espacioVertical - disposicionMostrada.alto * k) / 2),
      k,
    }, true)
  }

  const encuadrarNodos = (ids: Set<string>) => {
    const contenedor = contenedorRef.current
    if (!contenedor || contenedor.clientWidth === 0) return
    if (ids.size === 0) return encuadrar()
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
    fijarVista({
      x: (anchoUtil - ancho * k) / 2 - minX * k,
      y: 60 + (espacioVertical - alto * k) / 2 - minY * k,
      k,
    }, true)
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

  // Manejadores estables para los nodos memoizados: leen el id del dataset,
  // así todos los nodos comparten las mismas referencias.
  const alEntrarNodo = useCallback(
    (e: React.PointerEvent<SVGGElement>) => {
      const id = e.currentTarget.dataset.id
      if (!id) return
      setHover(id)
      if (aislado) abrirRevelado(id)
    },
    [aislado, abrirRevelado],
  )
  const alSalirNodo = useCallback(
    () => {
      setHover(null)
      if (aislado) soltarRevelado()
    },
    [aislado, soltarRevelado],
  )
  const alClickNodo = useCallback((e: React.MouseEvent<SVGGElement>) => {
    e.stopPropagation()
    // El segundo clic de un doble clic no debe alternar la selección.
    if (e.detail > 1) return
    const id = e.currentTarget.dataset.id
    if (!id) return
    setSeleccion((previa) => (previa === id ? null : id))
  }, [])
  const alDobleClickNodo = useCallback((e: React.MouseEvent<SVGGElement>) => {
    e.stopPropagation()
    const id = e.currentTarget.dataset.id
    if (!id) return
    setSeleccion(id)
    setAislado(true)
    setRamaAislada(false)
  }, [])

  const nodoSeleccionado = seleccion ? (porId.get(seleccion) ?? null) : null
  const entradas = seleccion
    ? aristas
        .filter((a) => a.a === seleccion)
        .sort((a, b) => ORDEN_PANEL[a.tipo] - ORDEN_PANEL[b.tipo])
    : []
  const salidas = seleccion
    ? aristas
        .filter((a) => a.de === seleccion)
        .sort((a, b) => ORDEN_PANEL[a.tipo] - ORDEN_PANEL[b.tipo])
    : []
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

  const filtroRama = ramaAislada ? ramaDependienteSeleccionada : null
  const filtroCamino = aislado || ramaAislada ? null : nodosCaminosSeleccionados

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
            onClick={() => zoomEscalonado(1.25)}
          >
            +
          </button>
          <button
            type="button"
            className="btn-ghost px-3 py-1"
            aria-label="Alejar"
            onClick={() => zoomEscalonado(1 / 1.25)}
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
        <span className="text-parchment/70">○ elemento · ◎ secuencia · ◇ avance · ⬡ ritual · ★ inicial · ● espontáneo</span>
        {caminosSeleccionados.length >= 2 && (
          <span className="font-semibold" style={{ color: COLOR_INTERSECCION }}>
            ∩ compartido por todos los caminos seleccionados
          </span>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-fog">
        <span className="flex items-center gap-1.5">
          <MuestraArista color={COLOR_ARISTA_RECETA} />
          Receta
        </span>
        <span className="flex items-center gap-1.5">
          <MuestraArista color="#a2947a" grosor={2.4} />
          Ascensión
        </span>
        <span className="flex items-center gap-1.5">
          <MuestraArista color={COLOR_DESBLOQUEO} guiones="1 4" />
          Desbloqueo espontáneo (basta uno)
        </span>
        <span className="flex items-center gap-1.5">
          <MuestraArista color={COLOR_DESBLOQUEO} guiones="1 4" union />
          Desbloqueo conjunto (todos)
        </span>
        <span className="flex items-center gap-1.5">
          <MuestraArista color={COLOR_FALLO} guiones="5 3" />
          Fallo de ritual
        </span>
      </div>

      <div
        ref={contenedorRef}
        data-foco={hayResaltado ? '' : undefined}
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
          aria-label="Grafo de conexiones entre elementos, recetas, avances, rituales y desbloqueos"
          className="h-full w-full cursor-grab active:cursor-grabbing"
          onPointerDown={iniciarPan}
          onPointerMove={moverPan}
          onPointerUp={() => {
            if (!terminarPan()) setSeleccion(null)
          }}
          onPointerCancel={terminarPan}
        >
          <DefsArbol />
          <rect width="100%" height="100%" fill={ramaAislada ? 'url(#branch-background)' : '#090c12'} />
          <g ref={escenaRef} style={{ transformOrigin: '0 0', transform: 'translate(40px, 40px)' }}>
            {/* La retícula viaja y escala con la escena: se siente un mapa físico. */}
            <rect
              x={-4400}
              y={-4400}
              width={disposicionMostrada.ancho + 8800}
              height={disposicionMostrada.alto + 8800}
              fill="url(#skill-grid)"
              opacity={ramaAislada ? 0.65 : 1}
              pointerEvents="none"
            />
            {combinaciones.map((combo, indiceCombo) => {
              const participantes = [...combo.entradas, ...combo.salidas]
              if (filtroCamino && !combinacionesCaminosSeleccionados?.has(combo)) return null
              const conectaRama =
                combo.entradas.some((id) => ramaDependienteSeleccionada?.has(id)) &&
                combo.salidas.some((id) => ramaDependienteSeleccionada?.has(id))
              if (ramaAislada && !conectaRama) return null

              const resaltado = comboResaltado(participantes, conectaRama)
              const caminosDelCombo = caminosSeleccionados.filter((index) =>
                componentesCaminos.combinacionesPorCamino.get(index)?.has(combo),
              )
              const esInterseccionCombo =
                caminosSeleccionados.length >= 2 &&
                caminosSeleccionados.every((index) => caminosDelCombo.includes(index))
              const esDependenciaSeleccionada = seleccion !== null && conectaRama
              const nivelDependencia = Math.min(
                ...combo.salidas
                  .map((id) => profundidadRamaSeleccionada.get(id))
                  .filter((nivel): nivel is number => nivel !== undefined && nivel > 0),
              )
              const colorSeleccionado = esInterseccionCombo
                ? COLOR_INTERSECCION
                : colorDeCamino(caminosDelCombo[0] ?? null)
              let color: string
              if (esDependenciaSeleccionada) {
                color = colorDeNivelDependencia(Number.isFinite(nivelDependencia) ? nivelDependencia : 1)
              } else if (caminosDelCombo.length > 0 && resaltado && colorSeleccionado) {
                color = colorSeleccionado
              } else if (combo.tipo === 'receta') {
                color = COLOR_ARISTA_RECETA
              } else if (combo.tipo === 'desbloqueo' || combo.tipo === 'requisito-conjunto') {
                color = COLOR_DESBLOQUEO
              } else if (combo.tipo === 'fallo') {
                color = COLOR_FALLO
              } else {
                const nodoCamino = porId.get(
                  combo.tipo === 'ascension' || combo.tipo === 'requisito'
                    ? combo.entradas[0]
                    : combo.salidas[0],
                )
                color = colorDeCamino(nodoCamino?.caminoIndex ?? null) ?? COLOR_ARISTA_RECETA
              }
              const estilo = ESTILO_ARISTA[combo.tipo]
              const grosor = estilo.grosor + (esDependenciaSeleccionada ? 0.8 : 0)

              return (
                <ComboLinea
                  key={indiceCombo}
                  combo={combo}
                  posiciones={disposicionMostrada.posiciones}
                  filtroRama={filtroRama}
                  color={color}
                  grosor={grosor}
                  guiones={estilo.guiones}
                  resaltado={resaltado}
                  titulo={`${ETIQUETA_ARISTA[combo.tipo]}: ${combo.via}`}
                />
              )
            })}

            {nodos.map((nodo) => {
              if (filtroCamino && !filtroCamino.has(nodo.id)) return null
              if (ramaAislada && !ramaDependienteSeleccionada?.has(nodo.id)) return null
              const pos = disposicionMostrada.posiciones.get(nodo.id)
              if (!pos) return null
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
                    : colorDeCamino(nodo.caminoIndex)) ?? COLOR_NEUTRO
              const esFoco = hover === nodo.id || seleccion === nodo.id
              const halo = esFoco
                ? ('foco' as const)
                : esDependienteSeleccionado
                  ? ('dependiente' as const)
                  : resaltadoCamino
                    ? ('camino' as const)
                    : null

              return (
                <NodoItem
                  key={nodo.id}
                  nodo={nodo}
                  x={pos.x}
                  y={pos.y}
                  borde={borde}
                  resaltado={conjuntoResaltado?.has(nodo.id) ?? false}
                  destacado={esRaizDependencia || resaltadoCamino || esDependienteSeleccionado}
                  seleccionado={esRaizDependencia}
                  halo={halo}
                  nivelDependencia={esDependienteSeleccionado ? nivelDependenciaNodo : undefined}
                  esInterseccion={esInterseccion}
                  onEntrar={alEntrarNodo}
                  onSalir={alSalirNodo}
                  onClickNodo={alClickNodo}
                  onDobleClick={alDobleClickNodo}
                />
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
                      onPointerDown={detenerPuntero}
                      onPointerUp={detenerPuntero}
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
                        {glifoTexto(nodo)}
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
            {nodoSeleccionado.descripcion && (
              <p className="mt-2 text-xs italic leading-relaxed text-fog">
                {nodoSeleccionado.descripcion}
              </p>
            )}
            {nodoSeleccionado.desbloqueo ? (
              <p className="mt-2 rounded-md border border-brass-deep/40 bg-brass/5 px-2 py-1.5 text-xs text-brass">
                {nodoSeleccionado.desbloqueo}
              </p>
            ) : nodoSeleccionado.espontaneo ? (
              <p className="mt-1 text-xs text-fog">Se desbloquea de forma espontánea.</p>
            ) : null}
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
