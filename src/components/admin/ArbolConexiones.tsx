'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

// Mapa de conexiones del archivo: elementos, recetas, avances, secuencias y
// rituales como grafo dirigido por capas (izquierda → derecha por profundidad).
// El color codifica el camino (paleta validada para CVD sobre superficie
// oscura); la clase del nodo va por forma e insignia, nunca solo por color.

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
}

export type CaminoLeyenda = { nombre: string; index: number }

// Paleta categórica por camino, validada con el validador de dataviz
// (modo oscuro, superficie #161009, todos los pares): azul, ámbar, rosa.
const COLORES_CAMINO = ['#3f96c9', '#c2841f', '#c94f75']
const COLOR_NEUTRO = '#57492f' // line2: nodos sin camino
const COLOR_ARISTA_RECETA = '#7d6f57'

const NODO_W = 176
const NODO_H = 38
const PASO_X = 250
const PASO_Y = 48
const MARGEN = 24

const ETIQUETA_ARISTA: Record<AristaArbol['tipo'], string> = {
  receta: 'Receta',
  creacion: 'Crea el avance',
  ascension: 'Asciende a',
  requisito: 'Se combina con',
  ritual: 'Ritual',
}

function colorDeCamino(index: number | null): string | null {
  return index !== null && index >= 0 && index < COLORES_CAMINO.length
    ? COLORES_CAMINO[index]
    : null
}

function recortar(texto: string, max: number): string {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto
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
  const [hover, setHover] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const contenedorRef = useRef<HTMLDivElement | null>(null)
  const arrastreRef = useRef<{ x: number; y: number; pointerId: number } | null>(null)

  // Posiciones: capa por camino más largo desde las fuentes (con tope por si
  // los datos formaran un ciclo), y filas ordenadas por camino/clase/nombre.
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
    const posiciones = new Map<string, { x: number; y: number }>()
    let filasMax = 0
    for (const [capa, lista] of columnas) {
      lista.sort(
        (a, b) =>
          (a.caminoIndex ?? 99) - (b.caminoIndex ?? 99) ||
          ordenClase[a.clase] - ordenClase[b.clase] ||
          a.nombre.localeCompare(b.nombre, 'es'),
      )
      lista.forEach((nodo, fila) => {
        posiciones.set(nodo.id, { x: capa * PASO_X, y: fila * PASO_Y })
      })
      filasMax = Math.max(filasMax, lista.length)
    }
    const capas = Math.max(...[...columnas.keys()], 0) + 1
    return {
      posiciones,
      ancho: capas * PASO_X + NODO_W,
      alto: filasMax * PASO_Y + NODO_H,
    }
  }, [nodos, aristas])

  const porId = useMemo(() => new Map(nodos.map((n) => [n.id, n])), [nodos])

  // Vecindad para el foco: al señalar un nodo se atenúa todo lo no conectado.
  const vecinos = useMemo(() => {
    const mapa = new Map<string, Set<string>>()
    const anotar = (a: string, b: string) => {
      if (!mapa.has(a)) mapa.set(a, new Set())
      mapa.get(a)!.add(b)
    }
    for (const arista of aristas) {
      anotar(arista.de, arista.a)
      anotar(arista.a, arista.de)
    }
    return mapa
  }, [aristas])

  const consulta = busqueda.trim().toLowerCase()
  const foco = hover ?? seleccion
  const nodoVisible = (id: string): boolean => {
    if (consulta) {
      const nodo = porId.get(id)
      return nodo ? nodo.nombre.toLowerCase().includes(consulta) : false
    }
    if (!foco) return true
    return id === foco || (vecinos.get(foco)?.has(id) ?? false)
  }
  const aristaVisible = (arista: AristaArbol): boolean => {
    if (consulta) return nodoVisible(arista.de) && nodoVisible(arista.a)
    if (!foco) return true
    return arista.de === foco || arista.a === foco
  }

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

  // Encuadre inicial: que el grafo entre a lo ancho del contenedor.
  useEffect(() => {
    const contenedor = contenedorRef.current
    if (!contenedor) return
    const k = Math.min(1, (contenedor.clientWidth - MARGEN * 2) / disposicion.ancho)
    setVista({ x: MARGEN, y: MARGEN, k })
  }, [disposicion.ancho])

  const iniciarPan = (e: React.PointerEvent) => {
    arrastreRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  const moverPan = (e: React.PointerEvent) => {
    const inicio = arrastreRef.current
    if (!inicio || inicio.pointerId !== e.pointerId) return
    setVista((v) => ({ ...v, x: v.x + e.clientX - inicio.x, y: v.y + e.clientY - inicio.y }))
    arrastreRef.current = { ...inicio, x: e.clientX, y: e.clientY }
  }
  const finalizarPan = () => {
    arrastreRef.current = null
  }

  const nodoSeleccionado = seleccion ? (porId.get(seleccion) ?? null) : null
  const entradas = seleccion ? aristas.filter((a) => a.a === seleccion) : []
  const salidas = seleccion ? aristas.filter((a) => a.de === seleccion) : []

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar nodo por nombre…"
          className="campo max-w-64"
          aria-label="Buscar nodo por nombre"
        />
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
              const contenedor = contenedorRef.current
              const k = contenedor
                ? Math.min(1, (contenedor.clientWidth - MARGEN * 2) / disposicion.ancho)
                : 1
              setVista({ x: MARGEN, y: MARGEN, k })
              setSeleccion(null)
            }}
          >
            Reencuadrar
          </button>
        </div>
        <p className="text-xs text-fog">
          Arrastra para desplazarte, rueda para acercar, clic en un nodo para fijar sus conexiones.
        </p>
      </div>

      {/* Leyenda: el color es el camino; la clase va en la forma del borde. */}
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-fog">
        {caminos.map((camino) => (
          <span key={camino.index} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-3 w-3 rounded-sm"
              style={{ background: colorDeCamino(camino.index) ?? COLOR_NEUTRO }}
            />
            {camino.nombre}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-3 rounded-sm border border-line2" />
          Sin camino
        </span>
        <span>Borde grueso = secuencia · discontinuo = avance · punteado = ritual · ★ = inicial</span>
      </div>

      <div
        ref={contenedorRef}
        className="relative h-[72vh] touch-none overflow-hidden rounded-lg border border-line bg-panel"
      >
        <svg
          role="img"
          aria-label="Grafo de conexiones entre elementos, recetas, avances y caminos"
          className="h-full w-full cursor-grab active:cursor-grabbing"
          onPointerDown={iniciarPan}
          onPointerMove={moverPan}
          onPointerUp={finalizarPan}
          onPointerCancel={finalizarPan}
          onClick={() => setSeleccion(null)}
        >
          <g transform={`translate(${vista.x} ${vista.y}) scale(${vista.k})`}>
            {aristas.map((arista, i) => {
              const de = disposicion.posiciones.get(arista.de)
              const a = disposicion.posiciones.get(arista.a)
              if (!de || !a) return null
              const x1 = de.x + NODO_W
              const y1 = de.y + NODO_H / 2
              const x2 = a.x
              const y2 = a.y + NODO_H / 2
              const xm = x1 + (x2 - x1) / 2
              const nodoCamino =
                arista.tipo === 'receta'
                  ? null
                  : (porId.get(arista.tipo === 'ascension' || arista.tipo === 'requisito' ? arista.de : arista.a) ?? null)
              const color =
                arista.tipo === 'receta'
                  ? COLOR_ARISTA_RECETA
                  : (colorDeCamino(nodoCamino?.caminoIndex ?? null) ?? COLOR_ARISTA_RECETA)
              const grosor =
                arista.tipo === 'ascension' ? 2.2 : arista.tipo === 'receta' ? 1 : arista.tipo === 'ritual' ? 1.8 : 1.5
              const guiones =
                arista.tipo === 'creacion' ? '6 4' : arista.tipo === 'requisito' || arista.tipo === 'ritual' ? '2 4' : undefined
              return (
                <path
                  key={i}
                  d={`M ${x1} ${y1} C ${xm} ${y1}, ${xm} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={grosor}
                  strokeDasharray={guiones}
                  opacity={aristaVisible(arista) ? (foco || consulta ? 0.9 : 0.38) : 0.06}
                >
                  <title>{`${ETIQUETA_ARISTA[arista.tipo]}: ${arista.via}`}</title>
                </path>
              )
            })}

            {nodos.map((nodo) => {
              const pos = disposicion.posiciones.get(nodo.id)
              if (!pos) return null
              const color = colorDeCamino(nodo.caminoIndex)
              const borde = color ?? COLOR_NEUTRO
              const visible = nodoVisible(nodo.id)
              return (
                <g
                  key={nodo.id}
                  transform={`translate(${pos.x} ${pos.y})`}
                  opacity={visible ? (nodo.activo ? 1 : 0.55) : 0.12}
                  className="cursor-pointer"
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerEnter={() => setHover(nodo.id)}
                  onPointerLeave={() => setHover(null)}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSeleccion((actual) => (actual === nodo.id ? null : nodo.id))
                  }}
                >
                  <rect
                    width={NODO_W}
                    height={NODO_H}
                    rx={nodo.clase === 'avance' ? 4 : 10}
                    fill="#1e1710"
                    stroke={seleccion === nodo.id ? '#e9dcbe' : borde}
                    strokeWidth={nodo.clase === 'secuencia' ? 2.5 : seleccion === nodo.id ? 2 : 1.2}
                    strokeDasharray={
                      nodo.clase === 'avance' ? '7 4' : nodo.clase === 'ritual' ? '2 4' : undefined
                    }
                  />
                  <text
                    x={10}
                    y={nodo.secuencia !== null ? 16 : 23}
                    fill="#e9dcbe"
                    fontSize={12.5}
                    style={{ userSelect: 'none' }}
                  >
                    {nodo.inicial ? '★ ' : ''}
                    {recortar(nodo.nombre, 22)}
                  </text>
                  {nodo.secuencia !== null && (
                    <text x={10} y={31} fill={borde} fontSize={10} style={{ userSelect: 'none' }}>
                      Secuencia {nodo.secuencia}
                    </text>
                  )}
                  <title>
                    {`${nodo.nombre}${nodo.activo ? '' : ' (inactivo)'} — ${nodo.clase}` +
                      (nodo.tipo ? ` · ${nodo.tipo}` : '') +
                      (nodo.espontaneo ? ' · desbloqueo espontáneo' : '')}
                  </title>
                </g>
              )
            })}
          </g>
        </svg>

        {nodoSeleccionado && (
          <aside
            aria-label={`Detalle de ${nodoSeleccionado.nombre}`}
            className="absolute right-3 top-3 max-h-[calc(100%-24px)] w-72 overflow-y-auto rounded-lg border border-line2 bg-panel2/95 p-4 text-sm shadow-xl"
          >
            <h3 className="font-semibold text-parchment">
              {nodoSeleccionado.inicial ? '★ ' : ''}
              {nodoSeleccionado.nombre}
              {!nodoSeleccionado.activo && <span className="text-fog"> (inactivo)</span>}
            </h3>
            <p className="mt-0.5 text-xs uppercase tracking-wider text-fog">
              {nodoSeleccionado.clase}
              {nodoSeleccionado.tipo ? ` · ${nodoSeleccionado.tipo}` : ''}
              {nodoSeleccionado.secuencia !== null ? ` · Secuencia ${nodoSeleccionado.secuencia}` : ''}
            </p>
            {nodoSeleccionado.espontaneo && (
              <p className="mt-1 text-xs text-fog">Se desbloquea de forma espontánea.</p>
            )}
            {entradas.length > 0 && (
              <>
                <h4 className="mt-3 text-xs uppercase tracking-wider text-brass-deep">Le llega de</h4>
                <ul className="mt-1 space-y-1">
                  {entradas.map((arista, i) => (
                    <li key={i} className="text-fog">
                      <span className="text-parchment">{porId.get(arista.de)?.nombre ?? '?'}</span>
                      <span className="text-xs"> — {ETIQUETA_ARISTA[arista.tipo]}: {arista.via}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {salidas.length > 0 && (
              <>
                <h4 className="mt-3 text-xs uppercase tracking-wider text-brass-deep">Conduce a</h4>
                <ul className="mt-1 space-y-1">
                  {salidas.map((arista, i) => (
                    <li key={i} className="text-fog">
                      <span className="text-parchment">{porId.get(arista.a)?.nombre ?? '?'}</span>
                      <span className="text-xs"> — {ETIQUETA_ARISTA[arista.tipo]}: {arista.via}</span>
                    </li>
                  ))}
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
