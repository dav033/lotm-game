'use client'

// Explorador expandible: la vista por defecto del árbol. Arranca con los
// elementos iniciales y cada nodo se despliega bajo demanda (⊕ por dirección),
// pidiendo su vecindario a la API. Nunca dibuja más que lo abierto, así que
// escala con el contenido sin despeinarse.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Compass, Eraser, X } from 'lucide-react'
import {
  CENTRO_X,
  CENTRO_Y,
  COLOR_ARISTA_RECETA,
  COLOR_DESBLOQUEO,
  COLOR_FALLO,
  COLOR_NEUTRO,
  COLOR_RAIZ_DEPENDENCIA,
  ESTILO_ARISTA,
  ETIQUETA_ARISTA,
  FAMILIA_ARISTA,
  MARGEN,
  ORDEN_PANEL,
  RADIO,
  agruparCombinaciones,
  claveArista,
  colorDeCamino,
  type AristaArbol,
  type CaminoLeyenda,
  type Combinacion,
  type FamiliaArista,
  type NodoArbol,
} from './tipos'
import { calcularDisposicion } from './disposicion'
import {
  ComboLinea,
  DefsArbol,
  MuestraArista,
  NodoItem,
  detenerPuntero,
  usePanZoom,
} from './primitivas'

type RespuestaGrafo = { nodos: NodoArbol[]; aristas: AristaArbol[] }

const ETIQUETA_FILTRO: Record<FamiliaArista, string> = {
  receta: 'Recetas',
  desbloqueo: 'Desbloqueos',
  progresion: 'Avances y rituales',
  fallo: 'Fallos de ritual',
}

export function ExploradorArbol({
  inicial,
  caminos,
  nodoSolicitado,
  pantallaCompleta = false,
}: {
  inicial: NodoArbol[]
  caminos: CaminoLeyenda[]
  // Petición externa (p. ej. desde la vista de camino): añadir y seleccionar.
  nodoSolicitado?: { id: string; nonce: number } | null
  pantallaCompleta?: boolean
}) {
  const [nodosMapa, setNodosMapa] = useState<Map<string, NodoArbol>>(
    () => new Map(inicial.map((n) => [n.id, n])),
  )
  const [aristasMapa, setAristasMapa] = useState<Map<string, AristaArbol>>(() => new Map())
  const [raices, setRaices] = useState<Set<string>>(() => new Set(inicial.map((n) => n.id)))
  // Expansiones por dirección: "id>" = dependientes a la derecha, "<id" = orígenes.
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set())
  const [cargando, setCargando] = useState<Set<string>>(() => new Set())
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [filtros, setFiltros] = useState<Record<FamiliaArista, boolean>>({
    receta: true,
    desbloqueo: true,
    progresion: true,
    fallo: false,
  })
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<NodoArbol[]>([])
  const [error, setError] = useState<string | null>(null)
  // Vecindarios ya descargados: expandir de nuevo no repite la petición.
  const vecindarioPedido = useRef<Set<string>>(new Set())
  const nonceBusqueda = useRef(0)

  const contenedorRef = useRef<HTMLDivElement | null>(null)
  const escenaRef = useRef<SVGGElement | null>(null)
  const { fijarVista, zoomEscalonado, iniciarPan, moverPan, terminarPan } = usePanZoom(
    contenedorRef,
    escenaRef,
  )

  const fusionarGrafo = useCallback((nodos: NodoArbol[], aristas: AristaArbol[]) => {
    if (nodos.length > 0) {
      setNodosMapa((previos) => {
        const mapa = new Map(previos)
        for (const nodo of nodos) mapa.set(nodo.id, nodo)
        return mapa
      })
    }
    if (aristas.length > 0) {
      setAristasMapa((previas) => {
        const mapa = new Map(previas)
        for (const arista of aristas) mapa.set(claveArista(arista), arista)
        return mapa
      })
    }
  }, [])

  const pedirJson = useCallback(async (url: string): Promise<RespuestaGrafo | null> => {
    try {
      const res = await fetch(url)
      if (!res.ok) {
        setError('No se pudo cargar esa parte del árbol.')
        return null
      }
      setError(null)
      return (await res.json()) as RespuestaGrafo
    } catch {
      setError('No se pudo cargar esa parte del árbol.')
      return null
    }
  }, [])

  // Combinaciones tras aplicar los filtros por familia de relación.
  const combos = useMemo(() => {
    const visibles = [...aristasMapa.values()].filter((a) => filtros[FAMILIA_ARISTA[a.tipo]])
    return agruparCombinaciones(visibles)
  }, [aristasMapa, filtros])

  // Cierre de visibilidad: raíces + todo lo alcanzado por expansiones en la
  // dirección correspondiente. Un combo arrastra a TODOS sus participantes
  // (los coingredientes hacen falta para dibujar el punto de unión).
  const visibles = useMemo(() => {
    const conjunto = new Set<string>()
    for (const id of raices) if (nodosMapa.has(id)) conjunto.add(id)
    let cambio = true
    while (cambio) {
      cambio = false
      for (const combo of combos) {
        const porSalida = combo.entradas.some((id) => conjunto.has(id) && expandidos.has(`${id}>`))
        const porEntrada = combo.salidas.some((id) => conjunto.has(id) && expandidos.has(`<${id}`))
        if (!porSalida && !porEntrada) continue
        for (const id of [...combo.entradas, ...combo.salidas]) {
          if (!conjunto.has(id) && nodosMapa.has(id)) {
            conjunto.add(id)
            cambio = true
          }
        }
      }
    }
    return conjunto
  }, [raices, expandidos, combos, nodosMapa])

  const combosVisibles = useMemo(
    () =>
      combos.filter((combo) =>
        [...combo.entradas, ...combo.salidas].every((id) => visibles.has(id)),
      ),
    [combos, visibles],
  )

  const nodosVisibles = useMemo(
    () => [...visibles].map((id) => nodosMapa.get(id)).filter((n): n is NodoArbol => !!n),
    [visibles, nodosMapa],
  )

  const disposicion = useMemo(() => {
    const aristasSinteticas = combosVisibles.flatMap((combo) =>
      combo.entradas.flatMap((de) => combo.salidas.map((a) => ({ de, a }))),
    )
    return calcularDisposicion(nodosVisibles, aristasSinteticas)
  }, [nodosVisibles, combosVisibles])

  // Conexiones ya visibles por nodo, para calcular cuántas quedan ocultas.
  const conexionesVisibles = useMemo(() => {
    const entrada = new Map<string, number>()
    const salida = new Map<string, number>()
    for (const combo of combosVisibles) {
      for (const de of combo.entradas) salida.set(de, (salida.get(de) ?? 0) + 1)
      for (const a of combo.salidas) entrada.set(a, (entrada.get(a) ?? 0) + 1)
    }
    return { entrada, salida }
  }, [combosVisibles])

  const vecinos = useMemo(() => {
    const mapa = new Map<string, Set<string>>()
    const anotar = (a: string, b: string) => {
      if (a === b) return
      if (!mapa.has(a)) mapa.set(a, new Set())
      mapa.get(a)!.add(b)
    }
    for (const combo of combosVisibles) {
      const participantes = [...combo.entradas, ...combo.salidas]
      for (const a of participantes) for (const b of participantes) anotar(a, b)
    }
    return mapa
  }, [combosVisibles])

  const foco = seleccion ?? hover
  const conjuntoResaltado = useMemo(() => {
    if (!foco) return null
    const conjunto = new Set<string>([foco])
    for (const id of vecinos.get(foco) ?? []) conjunto.add(id)
    return conjunto
  }, [foco, vecinos])
  const hayResaltado = conjuntoResaltado !== null

  // ---------- Expansión ----------

  const asegurarVecindario = useCallback(
    async (id: string, clave: string) => {
      if (vecindarioPedido.current.has(id)) return true
      setCargando((previos) => new Set(previos).add(clave))
      const datos = await pedirJson(`/api/admin/arbol?vista=vecinos&id=${encodeURIComponent(id)}`)
      setCargando((previos) => {
        const conjunto = new Set(previos)
        conjunto.delete(clave)
        return conjunto
      })
      if (!datos) return false
      fusionarGrafo(datos.nodos, datos.aristas)
      vecindarioPedido.current.add(id)
      return true
    },
    [pedirJson, fusionarGrafo],
  )

  const alternarExpansion = useCallback(
    async (id: string, direccion: 'entrada' | 'salida') => {
      const clave = direccion === 'salida' ? `${id}>` : `<${id}`
      if (expandidos.has(clave)) {
        setExpandidos((previos) => {
          const conjunto = new Set(previos)
          conjunto.delete(clave)
          return conjunto
        })
        return
      }
      if (!(await asegurarVecindario(id, clave))) return
      setExpandidos((previos) => new Set(previos).add(clave))
    },
    [expandidos, asegurarVecindario],
  )

  const alClickExpansor = useCallback(
    (e: React.MouseEvent<SVGGElement>) => {
      e.stopPropagation()
      const id = e.currentTarget.dataset.id
      const direccion = e.currentTarget.dataset.dir as 'entrada' | 'salida' | undefined
      if (id && direccion) void alternarExpansion(id, direccion)
    },
    [alternarExpansion],
  )

  const añadirCamino = useCallback(
    async (indice: number) => {
      const datos = await pedirJson(`/api/admin/arbol?vista=camino-grafo&indice=${indice}`)
      if (!datos) return
      fusionarGrafo(datos.nodos, datos.aristas)
      setRaices((previas) => {
        const conjunto = new Set(previas)
        for (const nodo of datos.nodos) conjunto.add(nodo.id)
        return conjunto
      })
    },
    [pedirJson, fusionarGrafo],
  )

  const añadirNodo = useCallback(
    async (nodo: NodoArbol) => {
      fusionarGrafo([nodo], [])
      setRaices((previas) => new Set(previas).add(nodo.id))
      setSeleccion(nodo.id)
      setBusqueda('')
      setResultados([])
      // El vecindario llega en segundo plano para que los ⊕ ya estén frescos.
      void asegurarVecindario(nodo.id, `${nodo.id}>`)
    },
    [fusionarGrafo, asegurarVecindario],
  )

  const limpiar = useCallback(() => {
    setRaices(new Set(inicial.map((n) => n.id)))
    setExpandidos(new Set())
    setSeleccion(null)
    setError(null)
  }, [inicial])

  // Petición externa (desde la espina de camino): traer el nodo y enfocarlo.
  useEffect(() => {
    if (!nodoSolicitado) return
    let cancelado = false
    void (async () => {
      const { id } = nodoSolicitado
      const datos = await pedirJson(`/api/admin/arbol?vista=vecinos&id=${encodeURIComponent(id)}`)
      if (!datos || cancelado) return
      fusionarGrafo(datos.nodos, datos.aristas)
      vecindarioPedido.current.add(id)
      setRaices((previas) => new Set(previas).add(id))
      setSeleccion(id)
    })()
    return () => {
      cancelado = true
    }
    // Se dispara por nonce: cada clic externo vuelve a enfocar aunque repita id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodoSolicitado?.nonce])

  // ---------- Búsqueda ----------

  useEffect(() => {
    const consulta = busqueda.trim()
    if (consulta.length < 2) {
      setResultados([])
      return
    }
    const nonce = ++nonceBusqueda.current
    const temporizador = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/arbol?vista=buscar&q=${encodeURIComponent(consulta)}`)
        if (!res.ok || nonce !== nonceBusqueda.current) return
        const datos = (await res.json()) as { nodos: NodoArbol[] }
        setResultados(datos.nodos)
      } catch {
        /* la búsqueda es tolerante a fallos */
      }
    }, 250)
    return () => clearTimeout(temporizador)
  }, [busqueda])

  // ---------- Encuadre ----------

  const encuadrar = useCallback(() => {
    const contenedor = contenedorRef.current
    if (!contenedor || contenedor.clientWidth === 0) return
    const anchoUtil = contenedor.clientWidth - (seleccion ? 320 : 0)
    const alto = contenedor.clientHeight
    const k = Math.min(
      1,
      Math.max(0.25, Math.min(
        (anchoUtil - MARGEN * 2) / Math.max(disposicion.ancho, 1),
        (alto - MARGEN * 2) / Math.max(disposicion.alto, 1),
      )),
    )
    fijarVista({
      x: Math.max(MARGEN, (anchoUtil - disposicion.ancho * k) / 2),
      y: Math.max(MARGEN, (alto - disposicion.alto * k) / 2),
      k,
    }, true)
  }, [disposicion, seleccion, fijarVista])

  useEffect(() => {
    const frame = requestAnimationFrame(encuadrar)
    return () => cancelAnimationFrame(frame)
    // Reencuadra cuando cambia lo visible (expansiones, raíces, filtros).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disposicion])

  // ---------- Interacción con nodos ----------

  const alEntrarNodo = useCallback((e: React.PointerEvent<SVGGElement>) => {
    const id = e.currentTarget.dataset.id
    if (id) setHover(id)
  }, [])
  const alSalirNodo = useCallback(() => setHover(null), [])
  const alClickNodo = useCallback((e: React.MouseEvent<SVGGElement>) => {
    e.stopPropagation()
    if (e.detail > 1) return
    const id = e.currentTarget.dataset.id
    if (!id) return
    setSeleccion((previa) => (previa === id ? null : id))
  }, [])
  // Doble clic: expandir dependientes (lo más frecuente al explorar).
  const alDobleClickNodo = useCallback(
    (e: React.MouseEvent<SVGGElement>) => {
      e.stopPropagation()
      const id = e.currentTarget.dataset.id
      if (!id) return
      setSeleccion(id)
      void alternarExpansion(id, 'salida')
    },
    [alternarExpansion],
  )

  const nodoSeleccionado = seleccion ? (nodosMapa.get(seleccion) ?? null) : null
  const conexionesSeleccion = useMemo(() => {
    if (!seleccion) return { entradas: [] as Combinacion[], salidas: [] as Combinacion[] }
    return {
      entradas: combosVisibles
        .filter((c) => c.salidas.includes(seleccion))
        .sort((a, b) => ORDEN_PANEL[a.tipo] - ORDEN_PANEL[b.tipo]),
      salidas: combosVisibles
        .filter((c) => c.entradas.includes(seleccion))
        .sort((a, b) => ORDEN_PANEL[a.tipo] - ORDEN_PANEL[b.tipo]),
    }
  }, [seleccion, combosVisibles])

  const colorCombo = (combo: Combinacion): string => {
    if (combo.tipo === 'receta') return COLOR_ARISTA_RECETA
    if (combo.tipo === 'desbloqueo' || combo.tipo === 'requisito-conjunto') return COLOR_DESBLOQUEO
    if (combo.tipo === 'fallo') return COLOR_FALLO
    const ancla = nodosMapa.get(
      combo.tipo === 'ascension' || combo.tipo === 'requisito'
        ? combo.entradas[0]
        : combo.salidas[0],
    )
    return colorDeCamino(ancla?.caminoIndex ?? null) ?? COLOR_ARISTA_RECETA
  }

  const raicesIniciales = useMemo(() => new Set(inicial.map((n) => n.id)), [inicial])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel/70 p-3 shadow-[inset_0_1px_0_rgba(201,163,92,0.06)]">
        <div className="relative">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Añadir elemento al lienzo…"
            className="campo w-64"
            aria-label="Buscar un elemento para añadirlo al lienzo"
          />
          {resultados.length > 0 && (
            <ul className="absolute left-0 top-full z-30 mt-1 w-72 overflow-hidden rounded-xl border border-line2 bg-[#111016]/95 py-1 shadow-[0_18px_60px_rgba(0,0,0,0.65)] backdrop-blur-md">
              {resultados.map((nodo) => (
                <li key={nodo.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-parchment transition-colors hover:bg-brass/10"
                    onClick={() => void añadirNodo(nodo)}
                  >
                    <span
                      aria-hidden
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: colorDeCamino(nodo.caminoIndex) ?? COLOR_NEUTRO }}
                    />
                    <span className="truncate">{nodo.nombre}</span>
                    <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wider text-fog">
                      {nodo.clase === 'secuencia' ? `Sec. ${nodo.secuencia}` : nodo.clase}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs text-fog">
          <span className="shrink-0 uppercase tracking-wider">Camino</span>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value !== '') void añadirCamino(Number(e.target.value))
              e.target.value = ''
            }}
            className="campo min-w-48"
            aria-label="Añadir la espina de un camino al lienzo"
          >
            <option value="">Añadir camino…</option>
            {caminos.map((camino) => (
              <option key={camino.index} value={camino.index}>
                {camino.nombre}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fog">
          {(Object.keys(ETIQUETA_FILTRO) as FamiliaArista[]).map((familia) => (
            <label key={familia} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={filtros[familia]}
                onChange={() =>
                  setFiltros((previos) => ({ ...previos, [familia]: !previos[familia] }))
                }
                className="accent-[var(--color-brass)]"
              />
              {ETIQUETA_FILTRO[familia]}
            </label>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="btn-ghost px-3 py-1" aria-label="Acercar" onClick={() => zoomEscalonado(1.25)}>
            +
          </button>
          <button type="button" className="btn-ghost px-3 py-1" aria-label="Alejar" onClick={() => zoomEscalonado(1 / 1.25)}>
            −
          </button>
          <button type="button" className="btn-ghost flex items-center gap-1.5 px-3 py-1" onClick={encuadrar}>
            <Compass className="h-3.5 w-3.5" />
            Encuadrar
          </button>
          <button type="button" className="btn-ghost flex items-center gap-1.5 px-3 py-1" onClick={limpiar}>
            <Eraser className="h-3.5 w-3.5" />
            Limpiar
          </button>
        </div>
        <p className="text-xs text-fog lg:ml-auto">
          ⊕ despliega conexiones por lado · doble clic expande dependientes.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-fog">
        <span className="flex items-center gap-1.5">
          <MuestraArista color={COLOR_ARISTA_RECETA} />
          Receta
        </span>
        <span className="flex items-center gap-1.5">
          <MuestraArista color={COLOR_DESBLOQUEO} guiones="1 4" />
          Desbloqueo espontáneo
        </span>
        <span className="flex items-center gap-1.5">
          <MuestraArista color={COLOR_FALLO} guiones="5 3" />
          Fallo de ritual
        </span>
        <span className="text-parchment/70">
          ◀ orígenes · dependientes ▶ · ★ inicial · ● espontáneo
        </span>
        <span className="ml-auto rounded-full border border-line px-2 py-1 text-[10px] uppercase tracking-wider">
          {nodosVisibles.length} nodos · {combosVisibles.length} combinaciones en el lienzo
        </span>
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-md border border-wine bg-wine/20 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <div
        ref={contenedorRef}
        data-foco={hayResaltado ? '' : undefined}
        className={`relative touch-none overflow-hidden rounded-2xl border border-line2 bg-[#090c12] shadow-[inset_0_0_80px_rgba(0,0,0,0.85),0_20px_60px_-35px_rgba(0,0,0,0.9)] ${
          pantallaCompleta ? 'h-[calc(100vh-13rem)] min-h-[420px]' : 'h-[72vh] min-h-[520px]'
        }`}
      >
        {nodosVisibles.length === 0 && (
          <div className="absolute inset-0 z-10 grid place-items-center">
            <p className="max-w-sm text-center text-sm text-fog">
              El lienzo está vacío: no hay elementos iniciales. Busca un elemento o añade un
              camino para empezar a explorar.
            </p>
          </div>
        )}
        <svg
          role="img"
          aria-label="Explorador expandible del árbol de habilidades"
          className="h-full w-full cursor-grab active:cursor-grabbing"
          onPointerDown={iniciarPan}
          onPointerMove={moverPan}
          onPointerUp={() => {
            if (!terminarPan()) setSeleccion(null)
          }}
          onPointerCancel={terminarPan}
        >
          <DefsArbol />
          <rect width="100%" height="100%" fill="#090c12" />
          <g ref={escenaRef} style={{ transformOrigin: '0 0', transform: 'translate(40px, 40px)' }}>
            <rect
              x={-4400}
              y={-4400}
              width={disposicion.ancho + 8800}
              height={disposicion.alto + 8800}
              fill="url(#skill-grid)"
              pointerEvents="none"
            />
            {combosVisibles.map((combo, indice) => {
              const participantes = [...combo.entradas, ...combo.salidas]
              const estilo = ESTILO_ARISTA[combo.tipo]
              return (
                <ComboLinea
                  key={indice}
                  combo={combo}
                  posiciones={disposicion.posiciones}
                  filtroRama={null}
                  color={colorCombo(combo)}
                  grosor={estilo.grosor}
                  guiones={estilo.guiones}
                  resaltado={foco !== null && participantes.includes(foco)}
                  titulo={`${ETIQUETA_ARISTA[combo.tipo]}: ${combo.via}`}
                />
              )
            })}

            {nodosVisibles.map((nodo) => {
              const pos = disposicion.posiciones.get(nodo.id)
              if (!pos) return null
              const esSeleccion = seleccion === nodo.id
              const borde =
                (esSeleccion ? COLOR_RAIZ_DEPENDENCIA : colorDeCamino(nodo.caminoIndex)) ??
                COLOR_NEUTRO
              return (
                <NodoItem
                  key={nodo.id}
                  nodo={nodo}
                  x={pos.x}
                  y={pos.y}
                  borde={borde}
                  resaltado={conjuntoResaltado?.has(nodo.id) ?? false}
                  destacado={esSeleccion}
                  seleccionado={esSeleccion}
                  halo={hover === nodo.id || esSeleccion ? 'foco' : null}
                  nivelDependencia={undefined}
                  esInterseccion={false}
                  onEntrar={alEntrarNodo}
                  onSalir={alSalirNodo}
                  onClickNodo={alClickNodo}
                  onDobleClick={alDobleClickNodo}
                />
              )
            })}

            {/* Expansores ⊕/⊖ por dirección, superpuestos a cada nodo. */}
            {nodosVisibles.map((nodo) => {
              const pos = disposicion.posiciones.get(nodo.id)
              if (!pos) return null
              const claveEntrada = `<${nodo.id}`
              const claveSalida = `${nodo.id}>`
              const abiertoEntrada = expandidos.has(claveEntrada)
              const abiertoSalida = expandidos.has(claveSalida)
              const ocultasEntrada = Math.max(
                0,
                (nodo.gradoEntrada ?? 0) - (conexionesVisibles.entrada.get(nodo.id) ?? 0),
              )
              const ocultasSalida = Math.max(
                0,
                (nodo.gradoSalida ?? 0) - (conexionesVisibles.salida.get(nodo.id) ?? 0),
              )
              const mostrarEntrada = abiertoEntrada || ocultasEntrada > 0
              const mostrarSalida = abiertoSalida || ocultasSalida > 0
              if (!mostrarEntrada && !mostrarSalida) return null

              const boton = (
                direccion: 'entrada' | 'salida',
                abierto: boolean,
                ocultas: number,
                clave: string,
              ) => {
                const cx = direccion === 'entrada' ? CENTRO_X - RADIO - 15 : CENTRO_X + RADIO + 15
                const texto = cargando.has(clave) ? '…' : abierto ? '−' : `+${ocultas}`
                const titulo = abierto
                  ? 'Contraer'
                  : direccion === 'entrada'
                    ? `Mostrar ${ocultas} orígenes ocultos`
                    : `Mostrar ${ocultas} conexiones dependientes`
                return (
                  <g
                    className="arbol-expansor"
                    data-id={nodo.id}
                    data-dir={direccion}
                    onClick={alClickExpansor}
                    onPointerDown={detenerPuntero}
                    onPointerUp={detenerPuntero}
                  >
                    <circle cx={cx} cy={CENTRO_Y} r={10} />
                    <text x={cx} y={CENTRO_Y + 3.5} textAnchor="middle" fontSize={texto.length > 3 ? 8 : 9.5} fontWeight="700">
                      {texto}
                    </text>
                    <title>{titulo}</title>
                  </g>
                )
              }

              return (
                <g
                  key={`exp:${nodo.id}`}
                  className="arbol-expansores"
                  style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
                >
                  {mostrarEntrada && boton('entrada', abiertoEntrada, ocultasEntrada, claveEntrada)}
                  {mostrarSalida && boton('salida', abiertoSalida, ocultasSalida, claveSalida)}
                </g>
              )
            })}
          </g>
        </svg>

        {nodoSeleccionado && (
          <aside
            aria-label={`Detalle de ${nodoSeleccionado.nombre}`}
            className="absolute bottom-3 right-3 top-3 w-[min(19rem,calc(100%-1.5rem))] overflow-y-auto rounded-xl border border-line2 bg-[#111016]/95 p-4 text-sm shadow-[0_18px_60px_rgba(0,0,0,0.65)] backdrop-blur-md"
          >
            <div className="mb-3 h-px bg-gradient-to-r from-transparent via-brass-deep to-transparent" />
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
            {nodoSeleccionado.desbloqueo && (
              <p className="mt-2 rounded-md border border-brass-deep/40 bg-brass/5 px-2 py-1.5 text-xs text-brass">
                {nodoSeleccionado.desbloqueo}
              </p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
              <div className="rounded-lg border border-line2 bg-panel/45 px-2 py-2">
                <strong className="block font-[family-name:var(--font-display)] text-base text-parchment">
                  {nodoSeleccionado.gradoEntrada ?? 0}
                </strong>
                <span className="text-[9px] uppercase tracking-wider text-fog">Orígenes</span>
              </div>
              <div className="rounded-lg border border-line2 bg-panel/45 px-2 py-2">
                <strong className="block font-[family-name:var(--font-display)] text-base text-parchment">
                  {nodoSeleccionado.gradoSalida ?? 0}
                </strong>
                <span className="text-[9px] uppercase tracking-wider text-fog">Dependientes</span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="btn-ghost px-2 py-2 text-xs"
                onClick={() => void alternarExpansion(nodoSeleccionado.id, 'entrada')}
              >
                {expandidos.has(`<${nodoSeleccionado.id}`) ? 'Contraer orígenes' : 'Expandir orígenes'}
              </button>
              <button
                type="button"
                className="btn-ghost px-2 py-2 text-xs"
                onClick={() => void alternarExpansion(nodoSeleccionado.id, 'salida')}
              >
                {expandidos.has(`${nodoSeleccionado.id}>`) ? 'Contraer dependientes' : 'Expandir dependientes'}
              </button>
            </div>
            {raices.has(nodoSeleccionado.id) && !raicesIniciales.has(nodoSeleccionado.id) && (
              <button
                type="button"
                className="btn-ghost mt-2 w-full px-2 py-2 text-xs"
                onClick={() => {
                  setRaices((previas) => {
                    const conjunto = new Set(previas)
                    conjunto.delete(nodoSeleccionado.id)
                    return conjunto
                  })
                  setSeleccion(null)
                }}
              >
                Quitar del lienzo
              </button>
            )}
            {conexionesSeleccion.entradas.length > 0 && (
              <>
                <h4 className="mt-3 text-xs uppercase tracking-wider text-brass-deep">Le llega de</h4>
                <ul className="mt-1 space-y-0.5">
                  {conexionesSeleccion.entradas.map((combo, i) => (
                    <li key={i} className="rounded-md px-2 py-1 text-xs text-fog">
                      <span className="text-parchment">{ETIQUETA_ARISTA[combo.tipo]}</span>: {combo.via}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {conexionesSeleccion.salidas.length > 0 && (
              <>
                <h4 className="mt-3 text-xs uppercase tracking-wider text-brass-deep">Alimenta a</h4>
                <ul className="mt-1 space-y-0.5">
                  {conexionesSeleccion.salidas.map((combo, i) => (
                    <li key={i} className="rounded-md px-2 py-1 text-xs text-fog">
                      <span className="text-parchment">{ETIQUETA_ARISTA[combo.tipo]}</span>: {combo.via}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {conexionesSeleccion.entradas.length === 0 && conexionesSeleccion.salidas.length === 0 && (
              <p className="mt-3 text-xs italic text-fog">
                Sin conexiones visibles: usa los botones ⊕ para desplegarlas.
              </p>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}
