'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, X } from 'lucide-react'
import { ELEMENT_TYPES, etiquetaTipo } from '@/server/domain/tipos'
import {
  NUMERAL_TIER,
  POTENTIAL_TIER_LABELS,
} from '@/server/domain/habilidades'
import { parPreviamenteFallido } from './estadoHabilidades'
import { IconoElemento } from './IconoElemento'
import { useJuegoStore } from './store'
import { type ElementoDescubierto } from './tipos'
import type { PayloadArrastre } from './useArrastre'

type Orden = 'descubrimiento' | 'nombre' | 'nivel'

const FILTROS_TIPO = ['TODOS', ...ELEMENT_TYPES, 'AVANCE']

type IniciarArrastre = (e: React.PointerEvent, payload: PayloadArrastre) => void

// Archivo de lo descubierto: rejilla de fichas arrastrables. Las tarjetas se
// suscriben una a una al store, así que mover el puntero sobre la lista solo
// repinta las dos fichas que ganan o pierden el foco, nunca la rejilla entera.
export function PanelDescubiertos({ iniciarArrastre }: { iniciarArrastre: IniciarArrastre }) {
  const estado = useJuegoStore((s) => s.estado)
  const errorCarga = useJuegoStore((s) => s.errorCarga)
  const cargarEstado = useJuegoStore((s) => s.cargarEstado)

  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('TODOS')
  const [orden, setOrden] = useState<Orden>('descubrimiento')

  const visibles = useMemo(() => {
    if (!estado) return []
    const q = busqueda.trim().toLowerCase()
    const lista = estado.elementos.filter(
      (e) =>
        (filtroTipo === 'TODOS' || e.type === filtroTipo) &&
        (!q || e.name.toLowerCase().includes(q)),
    )
    switch (orden) {
      case 'nombre':
        return [...lista].sort((a, b) => a.name.localeCompare(b.name, 'es'))
      case 'nivel':
        return [...lista].sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name, 'es'))
      default:
        return [...lista].sort((a, b) =>
          a.firstDiscoveredAt < b.firstDiscoveredAt ? -1 : 1,
        )
    }
  }, [estado, busqueda, filtroTipo, orden])

  return (
    <aside aria-label="Elementos descubiertos">
      <h2 className="mb-3 font-[family-name:var(--font-arcana)] text-xl text-brass">
        Archivo personal
      </h2>

      <div className="mb-4 flex flex-col gap-2">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-fog" aria-hidden />
          <span className="sr-only">Buscar elemento por nombre</span>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre…"
            className="w-full rounded-md border border-line bg-panel py-2 pl-9 pr-3 text-sm text-parchment placeholder:text-fog/60 focus:border-brass-deep focus:outline-none"
          />
        </label>
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="sr-only">Filtrar por tipo</span>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="w-full rounded-md border border-line bg-panel px-2 py-2 text-sm text-parchment focus:border-brass-deep focus:outline-none"
            >
              {FILTROS_TIPO.map((t) => (
                <option key={t} value={t}>
                  {t === 'TODOS' ? 'Todos los tipos' : etiquetaTipo(t)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1">
            <span className="sr-only">Ordenar elementos</span>
            <select
              value={orden}
              onChange={(e) => setOrden(e.target.value as Orden)}
              className="w-full rounded-md border border-line bg-panel px-2 py-2 text-sm text-parchment focus:border-brass-deep focus:outline-none"
            >
              <option value="descubrimiento">Por descubrimiento</option>
              <option value="nombre">Por nombre</option>
              <option value="nivel">Por nivel</option>
            </select>
          </label>
        </div>
      </div>

      {!estado && !errorCarga && <p className="text-sm italic text-fog">Abriendo el archivo…</p>}
      {errorCarga && (
        <p className="text-sm text-wine">
          No se pudo cargar tu progreso.{' '}
          <button onClick={() => void cargarEstado()} className="underline hover:text-parchment">
            Reintentar
          </button>
        </p>
      )}

      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-4">
        {visibles.map((el, i) => (
          <TarjetaElemento key={el.id} el={el} indice={i} iniciarArrastre={iniciarArrastre} />
        ))}
      </ul>
      {estado && visibles.length === 0 && (
        <p className="mt-2 text-sm italic text-fog">Ningún elemento coincide con la búsqueda.</p>
      )}
    </aside>
  )
}

function TarjetaElemento({
  el,
  indice,
  iniciarArrastre,
}: {
  el: ElementoDescubierto
  indice: number
  iniciarArrastre: IniciarArrastre
}) {
  const colocar = useJuegoStore((s) => s.colocar)
  const esObjetivo = useJuegoStore(
    (s) =>
      s.arrastre !== null && s.objetivo?.tipo === 'elemento' && s.objetivo.slug === el.slug,
  )
  // Memoria del Aprendiz: esta tarjeta es el destino actual del arrastre y el
  // par (arrastrado, esta tarjeta) ya falló antes. Solo aplica a Elementos
  // normales: los avances enmascarados no participan de esta advertencia.
  const previouslyFailed = useJuegoStore(
    (s) =>
      s.arrastre !== null &&
      s.objetivo?.tipo === 'elemento' &&
      s.objetivo.slug === el.slug &&
      el.kind === 'ELEMENT' &&
      parPreviamenteFallido(
        s.memoriaAprendiz,
        s.abilities.apprenticeMemory.unlocked,
        s.arrastre.payload.slug,
        el.slug,
      ),
  )
  const esNuevo = useJuegoStore((s) => s.recientes.includes(el.slug))
  const modoInteraccion = useJuegoStore((s) => s.modoInteraccion)
  const analizarConVidente = useJuegoStore((s) => s.analizarConVidente)
  const tier = useJuegoStore((s) => s.potencialPorElemento[el.id])
  const enModoVidente = modoInteraccion === 'vidente-objetivo'
  const esAnalizable = el.kind === 'ELEMENT'
  const etiquetaPotencial = tier
    ? `Potencial ${NUMERAL_TIER[tier]}: ${POTENTIAL_TIER_LABELS[tier]}`
    : null

  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: Math.min(indice * 0.022, 0.5), ease: 'easeOut' }}
    >
      <motion.button
        data-drop-elemento={el.slug}
        data-potential-tier={esAnalizable && tier ? tier : undefined}
        data-apprentice-failed={previouslyFailed ? 'true' : undefined}
        onPointerDown={(e) => {
          if (enModoVidente) return
          iniciarArrastre(e, {
            slug: el.slug,
            name: el.name,
            iconKey: el.iconKey,
            origen: { tipo: 'panel' },
          })
        }}
        onClick={(e) => {
          if (enModoVidente) {
            if (esAnalizable) void analizarConVidente(el.id)
            return
          }
          // Solo teclado (Enter/Espacio): el mouse/táctil los gestiona el
          // sistema de arrastre para no colocar dos veces.
          if (e.detail === 0) colocar(el)
        }}
        aria-disabled={enModoVidente && !esAnalizable}
        aria-label={
          enModoVidente
            ? esAnalizable
              ? `Analizar ${el.name} con la Adivinación del Vidente`
              : `${el.name}: los avances enmascarados no pueden analizarse`
            : `${el.name}: arrastra sobre otro elemento para combinar, o pulsa para colocar en el círculo${
                etiquetaPotencial ? `, ${etiquetaPotencial}` : ''
              }${previouslyFailed ? '. Combinación intentada anteriormente sin resultado.' : ''}`
        }
        title={
          enModoVidente && esAnalizable
            ? `Analizar ${el.name}`
            : etiquetaPotencial ?? el.derivationLabel ?? el.description ?? el.name
        }
        animate={esObjetivo ? { scale: 1.07 } : { scale: 1 }}
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 420, damping: 24 }}
        className={`relative flex w-full touch-none select-none flex-col items-center gap-1 rounded-lg mist-card p-2 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brass ${
          esObjetivo ? 'border-brass' : 'hover:border-brass-deep'
        } ${
          enModoVidente
            ? esAnalizable
              ? 'cursor-crosshair border-spectral ring-1 ring-spectral/70'
              : 'cursor-not-allowed opacity-40'
            : ''
        }`}
      >
        {previouslyFailed && (
          <span className="apprentice-memory-mark" aria-hidden="true">
            <X />
          </span>
        )}
        {esNuevo && (
          <span className="badge-nuevo" aria-label="Descubierto recientemente">
            ✦ Nuevo
          </span>
        )}
        {esAnalizable && tier && (
          <span className="badge-potencial" aria-hidden>
            {NUMERAL_TIER[tier]}
          </span>
        )}
        <IconoElemento iconKey={el.iconKey} className="h-5 w-5 text-brass" />
        <span className="text-[11px] leading-tight text-parchment">{el.name}</span>
        {el.sequenceLabel && (
          <span className="rounded-full border border-brass-deep px-1.5 py-px text-[8px] leading-tight text-brass">
            {el.sequenceLabel}
          </span>
        )}
        {el.derivationLabel && (
          <span className="text-[9px] leading-tight text-brass-deep">{el.derivationLabel}</span>
        )}
        {(el.quantity ?? 1) > 1 && (
          <span className="text-[9px] text-fog">Disponibles: {el.quantity}</span>
        )}
      </motion.button>
    </motion.li>
  )
}
