'use client'

// Piezas de dibujo compartidas por el mapa completo y el explorador:
// nodos y combinaciones memoizadas, defs SVG, muestras de leyenda y el hook
// de pan/zoom imperativo (que no re-renderiza React por frame).

import { memo, useCallback, useEffect, useRef, type CSSProperties, type RefObject } from 'react'
import { ChevronsUp, Sparkles } from 'lucide-react'
import { ELEMENT_ICONS } from '@/components/game/IconoElemento'
import {
  CENTRO_X,
  CENTRO_Y,
  COLOR_INTERSECCION,
  COLOR_RAIZ_DEPENDENCIA,
  MARGEN,
  RADIO,
  curva,
  recortar,
  type Combinacion,
  type NodoArbol,
} from './tipos'

export const detenerPuntero = (e: React.PointerEvent) => e.stopPropagation()

// ---------------------------------------------------------------------------
// Pan/zoom imperativo: la vista vive en un ref y se aplica directamente al
// estilo de la <g> de la escena; arrastrar o hacer zoom no pasa por React.
// ---------------------------------------------------------------------------

export type Vista = { x: number; y: number; k: number }

export function usePanZoom(
  contenedorRef: RefObject<HTMLDivElement | null>,
  escenaRef: RefObject<SVGGElement | null>,
) {
  const vistaRef = useRef<Vista>({ x: MARGEN, y: MARGEN, k: 1 })
  const arrastreRef = useRef<{ x: number; y: number; pointerId: number; movio: boolean } | null>(null)

  const aplicarVista = useCallback((animar: boolean) => {
    const escena = escenaRef.current
    if (!escena) return
    const sinMovimiento =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const { x, y, k } = vistaRef.current
    escena.style.transition =
      animar && !sinMovimiento ? 'transform 480ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none'
    escena.style.transform = `translate(${x}px, ${y}px) scale(${k})`
  }, [escenaRef])

  const fijarVista = useCallback((vista: Vista, animar: boolean) => {
    vistaRef.current = vista
    aplicarVista(animar)
  }, [aplicarVista])

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
      const v = vistaRef.current
      const k = Math.min(2.5, Math.max(0.2, v.k * Math.exp(-e.deltaY * 0.0012)))
      vistaRef.current = {
        k,
        x: cx - ((cx - v.x) * k) / v.k,
        y: cy - ((cy - v.y) * k) / v.k,
      }
      aplicarVista(false)
    }
    contenedor.addEventListener('wheel', alRodar, { passive: false })
    return () => contenedor.removeEventListener('wheel', alRodar)
  }, [contenedorRef, aplicarVista])

  const zoomEscalonado = useCallback((factor: number) => {
    const contenedor = contenedorRef.current
    if (!contenedor) return
    const cx = contenedor.clientWidth / 2
    const cy = contenedor.clientHeight / 2
    const v = vistaRef.current
    const k = Math.min(2.5, Math.max(0.2, v.k * factor))
    vistaRef.current = {
      k,
      x: cx - ((cx - v.x) * k) / v.k,
      y: cy - ((cy - v.y) * k) / v.k,
    }
    aplicarVista(true)
  }, [contenedorRef, aplicarVista])

  const iniciarPan = useCallback((e: React.PointerEvent) => {
    arrastreRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId, movio: false }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }, [])
  const moverPan = useCallback((e: React.PointerEvent) => {
    const inicio = arrastreRef.current
    if (!inicio || inicio.pointerId !== e.pointerId) return
    const v = vistaRef.current
    vistaRef.current = { ...v, x: v.x + e.clientX - inicio.x, y: v.y + e.clientY - inicio.y }
    aplicarVista(false)
    arrastreRef.current = { ...inicio, x: e.clientX, y: e.clientY, movio: true }
  }, [aplicarVista])
  // Devuelve true si el gesto fue un arrastre (para no confundirlo con clic).
  const terminarPan = useCallback((): boolean => {
    const movio = arrastreRef.current?.movio ?? false
    arrastreRef.current = null
    return movio
  }, [])

  return { vistaRef, aplicarVista, fijarVista, zoomEscalonado, iniciarPan, moverPan, terminarPan }
}

// ---------------------------------------------------------------------------
// Defs SVG comunes (gradientes, filtros, retícula).
// ---------------------------------------------------------------------------

export function DefsArbol() {
  return (
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
  )
}

// Muestra en miniatura de un tipo de arista para las leyendas.
export function MuestraArista({
  color,
  guiones,
  grosor = 1.6,
  union = false,
}: {
  color: string
  guiones?: string
  grosor?: number
  union?: boolean
}) {
  return (
    <svg width="36" height="10" aria-hidden className="shrink-0">
      <path
        d="M 1 5 H 27"
        stroke={color}
        strokeWidth={grosor}
        strokeDasharray={guiones}
        fill="none"
        strokeLinecap="round"
      />
      {union && <circle cx="14" cy="5" r="2.6" fill={color} />}
      <path
        d="M 27 2 L 32 5 L 27 8"
        stroke={color}
        strokeWidth={grosor}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Combinación memoizada: solo se vuelve a renderizar si cambian sus props
// (posiciones nuevas, color o resalte); el atenuado global lo resuelve CSS.
// ---------------------------------------------------------------------------

type PropsCombo = {
  combo: Combinacion
  posiciones: Map<string, { x: number; y: number }>
  filtroRama: Set<string> | null
  color: string
  grosor: number
  guiones: string | undefined
  resaltado: boolean
  titulo: string
}

export const ComboLinea = memo(function ComboLinea({
  combo,
  posiciones,
  filtroRama,
  color,
  grosor,
  guiones,
  resaltado,
  titulo,
}: PropsCombo) {
  const entradasPos = combo.entradas
    .map((id) => ({ id, pos: posiciones.get(id) }))
    .filter(
      (p): p is { id: string; pos: { x: number; y: number } } =>
        !!p.pos && (!filtroRama || filtroRama.has(p.id)),
    )
  const salidasPos = combo.salidas
    .map((id) => ({ id, pos: posiciones.get(id) }))
    .filter(
      (p): p is { id: string; pos: { x: number; y: number } } =>
        !!p.pos && (!filtroRama || filtroRama.has(p.id)),
    )
  if (entradasPos.length === 0 || salidasPos.length === 0) return null

  // Ciclo del flujo animado de guiones: múltiplo exacto del patrón para que
  // el bucle no salte.
  const estiloGuiones = guiones
    ? ({
        '--ciclo-guiones': `-${guiones.split(' ').reduce((suma, n) => suma + Number(n), 0) * 2}px`,
      } as CSSProperties)
    : undefined
  const claseTrazo = guiones ? 'arbol-trazo arbol-trazo-guiones' : 'arbol-trazo'

  const tramo = (d: string, key: string) => (
    <g key={key}>
      <path d={d} fill="none" stroke="#050608" strokeWidth={grosor + 5} strokeLinecap="round" />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={grosor}
        strokeDasharray={guiones}
        strokeLinecap="round"
        className={claseTrazo}
        style={estiloGuiones}
      />
    </g>
  )

  const salidasDe = (x1: number, y1: number) =>
    salidasPos.map(({ pos }, i) => {
      const x2 = pos.x + CENTRO_X - RADIO
      const y2 = pos.y + CENTRO_Y
      return (
        <g key={`s${i}`}>
          {tramo(curva(x1, y1, x2, y2), `t${i}`)}
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

  const clase = `arbol-combo${resaltado ? ' arbol-resaltado' : ''}`

  if (entradasPos.length <= 1) {
    const { pos } = entradasPos[0]
    return (
      <g className={clase}>
        {salidasDe(pos.x + CENTRO_X + RADIO, pos.y + CENTRO_Y)}
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
    <g className={clase}>
      {entradasPos.map(({ pos }, i) =>
        tramo(curva(pos.x + CENTRO_X + RADIO, pos.y + CENTRO_Y, jx, jy), `e${i}`),
      )}
      {salidasDe(jx, jy)}
      <circle cx={jx} cy={jy} r={4} fill={color} stroke="#050608" strokeWidth={1.5} className="arbol-union" />
      <title>{titulo}</title>
    </g>
  )
})

// ---------------------------------------------------------------------------
// Nodo memoizado: recibe primitivas estables; el hover ajeno no lo re-renderiza.
// La posición va como transform de estilo, así los reencuadres de la
// disposición se animan con CSS.
// ---------------------------------------------------------------------------

export const OPACIDAD_HALO = { foco: 0.22, dependiente: 0.18, camino: 0.12 } as const

type PropsNodo = {
  nodo: NodoArbol
  x: number
  y: number
  borde: string
  resaltado: boolean
  destacado: boolean
  seleccionado: boolean
  halo: keyof typeof OPACIDAD_HALO | null
  nivelDependencia: number | undefined
  esInterseccion: boolean
  onEntrar: (e: React.PointerEvent<SVGGElement>) => void
  onSalir: (e: React.PointerEvent<SVGGElement>) => void
  onClickNodo: (e: React.MouseEvent<SVGGElement>) => void
  onDobleClick: (e: React.MouseEvent<SVGGElement>) => void
}

export const NodoItem = memo(function NodoItem({
  nodo,
  x,
  y,
  borde,
  resaltado,
  destacado,
  seleccionado,
  halo,
  nivelDependencia,
  esInterseccion,
  onEntrar,
  onSalir,
  onClickNodo,
  onDobleClick,
}: PropsNodo) {
  const trazoContorno = seleccionado ? '#e9dcbe' : borde
  const grosorContorno = destacado ? 3 : 2
  const IconoGlifo =
    nodo.clase === 'elemento' ? (ELEMENT_ICONS[nodo.iconKey ?? ''] ?? Sparkles) : null
  const estilo: CSSProperties = {
    transform: `translate(${x}px, ${y}px)`,
    ...(nodo.activo ? null : { ['--op' as string]: 0.55 }),
  }

  return (
    <g
      className={`arbol-nodo${resaltado ? ' arbol-resaltado' : ''}`}
      data-id={nodo.id}
      style={estilo}
      onPointerDown={detenerPuntero}
      // Sin esto, el pointerup llega al fondo del SVG y deselecciona un
      // instante, lo que sacaría del modo aislado al navegar.
      onPointerUp={detenerPuntero}
      onPointerEnter={onEntrar}
      onPointerLeave={onSalir}
      onClick={onClickNodo}
      onDoubleClick={onDobleClick}
    >
      {seleccionado && (
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
            className="arbol-anillo-seleccion"
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
      {halo && (
        <circle
          cx={CENTRO_X}
          cy={CENTRO_Y}
          r={39}
          fill={borde}
          opacity={OPACIDAD_HALO[halo]}
          filter="url(#skill-glow)"
          pointerEvents="none"
        />
      )}
      {nodo.clase === 'avance' ? (
        <path
          d={`M ${CENTRO_X} ${CENTRO_Y - 33} L ${CENTRO_X + 33} ${CENTRO_Y} L ${CENTRO_X} ${CENTRO_Y + 33} L ${CENTRO_X - 33} ${CENTRO_Y} Z`}
          fill="url(#skill-node)"
          stroke={trazoContorno}
          strokeWidth={grosorContorno}
        />
      ) : nodo.clase === 'ritual' ? (
        <path
          d={`M ${CENTRO_X - 27} ${CENTRO_Y - 20} L ${CENTRO_X} ${CENTRO_Y - 35} L ${CENTRO_X + 27} ${CENTRO_Y - 20} L ${CENTRO_X + 27} ${CENTRO_Y + 20} L ${CENTRO_X} ${CENTRO_Y + 35} L ${CENTRO_X - 27} ${CENTRO_Y + 20} Z`}
          fill="url(#skill-node)"
          stroke={trazoContorno}
          strokeWidth={grosorContorno}
          strokeDasharray="3 3"
        />
      ) : (
        <>
          {nodo.clase === 'secuencia' && (
            <circle cx={CENTRO_X} cy={CENTRO_Y} r={35} fill="none" stroke={borde} strokeWidth={2} opacity={0.65} />
          )}
          <circle
            cx={CENTRO_X}
            cy={CENTRO_Y}
            r={RADIO}
            fill="url(#skill-node)"
            stroke={trazoContorno}
            strokeWidth={nodo.clase === 'secuencia' || destacado ? 3 : 2}
          />
        </>
      )}
      <circle cx={CENTRO_X} cy={CENTRO_Y} r={21} fill="none" stroke={borde} strokeWidth={0.7} opacity={0.45} />
      {nodo.clase === 'secuencia' ? (
        <text
          x={CENTRO_X}
          y={CENTRO_Y + 6}
          fill="#e9dcbe"
          fontSize={18}
          fontWeight="600"
          textAnchor="middle"
          style={{ userSelect: 'none', fontFamily: 'var(--font-display)' }}
        >
          {nodo.secuencia}
        </text>
      ) : nodo.clase === 'ritual' ? (
        <text
          x={CENTRO_X}
          y={CENTRO_Y + 6}
          fill="#e9dcbe"
          fontSize={17}
          fontWeight="600"
          textAnchor="middle"
          style={{ userSelect: 'none', fontFamily: 'var(--font-display)' }}
        >
          ✦
        </text>
      ) : nodo.clase === 'avance' ? (
        <ChevronsUp
          x={CENTRO_X - 11}
          y={CENTRO_Y - 11}
          width={22}
          height={22}
          color="#e9dcbe"
          strokeWidth={1.9}
          pointerEvents="none"
        />
      ) : IconoGlifo ? (
        <IconoGlifo
          x={CENTRO_X - 11}
          y={CENTRO_Y - 11}
          width={22}
          height={22}
          color="#e9dcbe"
          strokeWidth={1.7}
          pointerEvents="none"
        />
      ) : null}
      {nodo.espontaneo && (
        <circle cx={CENTRO_X + 25} cy={CENTRO_Y - 23} r={4} fill="#e9dcbe" stroke={borde} strokeWidth={2} />
      )}
      {nivelDependencia !== undefined && (
        <g aria-label={`Nivel ${nivelDependencia} de dependencia`}>
          <circle cx={CENTRO_X - 39} cy={CENTRO_Y} r={9} fill="#0b1119" stroke={borde} strokeWidth={1.5} />
          <text
            x={CENTRO_X - 39}
            y={CENTRO_Y + 3.5}
            fill={borde}
            fontSize={9}
            fontWeight="700"
            textAnchor="middle"
          >
            {nivelDependencia}
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
            : nivelDependencia !== undefined
              ? `N${nivelDependencia} · ${nodo.tipo ?? nodo.clase}`
              : nodo.tipo ?? nodo.clase
          : 'INACTIVO'}
      </text>
      {nodo.inicial && (
        <text x={CENTRO_X - 31} y={CENTRO_Y - 25} fill="#e9dcbe" fontSize={10}>★</text>
      )}
      <title>
        {`${nodo.nombre}${nodo.activo ? '' : ' (inactivo)'} — ${nodo.clase}` +
          (nodo.tipo ? ` · ${nodo.tipo}` : '') +
          (nodo.espontaneo ? ' · desbloqueo espontáneo' : '') +
          (esInterseccion ? ' · compartido por los caminos seleccionados' : '') +
          (nivelDependencia !== undefined ? ' · depende directa o indirectamente de la selección' : '')}
      </title>
    </g>
  )
})
