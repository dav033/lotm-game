'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

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
}

export type CaminoLeyenda = { nombre: string; index: number }

// Paleta categórica por camino, validada con el validador de dataviz
// (modo oscuro, superficie #161009, todos los pares): azul, ámbar, rosa.
const COLORES_CAMINO = ['#3f96c9', '#c2841f', '#c94f75']
const COLOR_NEUTRO = '#57492f' // line2: nodos sin camino
const COLOR_ARISTA_RECETA = '#7d6f57'

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
  return index !== null && index >= 0 && index < COLORES_CAMINO.length
    ? COLORES_CAMINO[index]
    : null
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
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel/70 p-3 shadow-[inset_0_1px_0_rgba(201,163,92,0.06)]">
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
        <p className="text-xs text-fog lg:ml-auto">
          Arrastra para desplazarte, rueda para acercar, clic en un nodo para fijar sus conexiones.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-fog">
        {caminos.map((camino) => (
          <span key={camino.index} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-3 w-3 rounded-full shadow-[0_0_8px_currentColor]"
              style={{ background: colorDeCamino(camino.index) ?? COLOR_NEUTRO, color: colorDeCamino(camino.index) ?? COLOR_NEUTRO }}
            />
            {camino.nombre}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-3 rounded-full border border-line2" />
          Sin camino
        </span>
        <span className="text-parchment/70">○ elemento · ◎ secuencia · ◇ avance · ⬡ ritual · ★ inicial</span>
      </div>

      <div
        ref={contenedorRef}
        className="relative h-[72vh] min-h-[520px] touch-none overflow-hidden rounded-2xl border border-line2 bg-[#090c12] shadow-[inset_0_0_80px_rgba(0,0,0,0.85),0_20px_60px_-35px_rgba(0,0,0,0.9)]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between border-b border-line/60 bg-ink/55 px-4 py-2 backdrop-blur-sm">
          <div>
            <p className="font-[family-name:var(--font-display)] text-xs uppercase tracking-[0.22em] text-brass">Mapa de progresión</p>
            <p className="text-[10px] text-fog">Las ramas avanzan de izquierda a derecha</p>
          </div>
          <span className="rounded-full border border-line px-2 py-1 text-[10px] uppercase tracking-wider text-fog">
            {nodos.length} habilidades
          </span>
        </div>
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
            <filter id="skill-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="line-glow" x="-20%" y="-100%" width="140%" height="300%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <rect width="100%" height="100%" fill="url(#skill-grid)" />
          <g transform={`translate(${vista.x} ${vista.y}) scale(${vista.k})`}>
            {aristas.map((arista, i) => {
              const de = disposicion.posiciones.get(arista.de)
              const a = disposicion.posiciones.get(arista.a)
              if (!de || !a) return null
              const x1 = de.x + CENTRO_X + RADIO
              const y1 = de.y + CENTRO_Y
              const x2 = a.x + CENTRO_X - RADIO
              const y2 = a.y + CENTRO_Y
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
              const visible = aristaVisible(arista)
              const trazado = `M ${x1} ${y1} C ${xm} ${y1}, ${xm} ${y2}, ${x2} ${y2}`
              return (
                <g key={i} opacity={visible ? (foco || consulta ? 1 : 0.58) : 0.05}>
                  <path
                    d={trazado}
                    fill="none"
                    stroke="#050608"
                    strokeWidth={grosor + 5}
                    strokeLinecap="round"
                  />
                <path
                  d={trazado}
                  fill="none"
                  stroke={color}
                  strokeWidth={grosor}
                  strokeDasharray={guiones}
                  strokeLinecap="round"
                  filter={visible && foco ? 'url(#line-glow)' : undefined}
                >
                  <title>{`${ETIQUETA_ARISTA[arista.tipo]}: ${arista.via}`}</title>
                </path>
                </g>
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
                  {(seleccion === nodo.id || hover === nodo.id) && (
                    <circle
                      cx={CENTRO_X}
                      cy={CENTRO_Y}
                      r={39}
                      fill={borde}
                      opacity={0.22}
                      filter="url(#skill-glow)"
                    />
                  )}
                  {nodo.clase === 'avance' ? (
                    <path
                      d={`M ${CENTRO_X} ${CENTRO_Y - 33} L ${CENTRO_X + 33} ${CENTRO_Y} L ${CENTRO_X} ${CENTRO_Y + 33} L ${CENTRO_X - 33} ${CENTRO_Y} Z`}
                      fill="url(#skill-node)"
                      stroke={seleccion === nodo.id ? '#e9dcbe' : borde}
                      strokeWidth={seleccion === nodo.id ? 3 : 2}
                    />
                  ) : nodo.clase === 'ritual' ? (
                    <path
                      d={`M ${CENTRO_X - 27} ${CENTRO_Y - 20} L ${CENTRO_X} ${CENTRO_Y - 35} L ${CENTRO_X + 27} ${CENTRO_Y - 20} L ${CENTRO_X + 27} ${CENTRO_Y + 20} L ${CENTRO_X} ${CENTRO_Y + 35} L ${CENTRO_X - 27} ${CENTRO_Y + 20} Z`}
                      fill="url(#skill-node)"
                      stroke={seleccion === nodo.id ? '#e9dcbe' : borde}
                      strokeWidth={seleccion === nodo.id ? 3 : 2}
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
                        strokeWidth={nodo.clase === 'secuencia' ? 3 : seleccion === nodo.id ? 3 : 2}
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
                        : nodo.tipo ?? nodo.clase
                      : 'INACTIVO'}
                  </text>
                  {nodo.inicial && nodo.clase !== 'elemento' && (
                    <text x={CENTRO_X - 31} y={CENTRO_Y - 25} fill="#e9dcbe" fontSize={10}>★</text>
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
            className="absolute bottom-3 right-3 top-16 w-[min(18rem,calc(100%-1.5rem))] overflow-y-auto rounded-xl border border-line2 bg-[#111016]/95 p-4 text-sm shadow-[0_18px_60px_rgba(0,0,0,0.65)] backdrop-blur-md"
          >
            <div className="mb-3 h-px bg-gradient-to-r from-transparent via-brass-deep to-transparent" />
            <h3 className="font-[family-name:var(--font-display)] font-semibold text-parchment">
              {nodoSeleccionado.inicial ? '★ ' : ''}
              {nodoSeleccionado.nombre}
              {!nodoSeleccionado.activo && <span className="text-fog"> (inactivo)</span>}
            </h3>
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-brass-deep">
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
