'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { ELEMENT_TYPES, etiquetaTipo } from '@/server/domain/tipos'
import { IconoElemento } from './IconoElemento'
import { type ElementoDescubierto, type EstadoJuego } from './tipos'
import type { DestinoArrastre, PayloadArrastre } from './useArrastre'

type Orden = 'descubrimiento' | 'nombre' | 'nivel'

const FILTROS_TIPO = ['TODOS', ...ELEMENT_TYPES, 'AVANCE']

export function PanelDescubiertos({
  estado,
  errorCarga,
  onReintentar,
  onColocar,
  iniciarArrastre,
  objetivo,
  slugArrastrado,
}: {
  estado: EstadoJuego | null
  errorCarga: boolean
  onReintentar: () => void
  onColocar: (el: ElementoDescubierto) => void
  iniciarArrastre: (e: React.PointerEvent, payload: PayloadArrastre) => void
  objetivo: DestinoArrastre
  slugArrastrado: string | null
}) {
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
      <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg text-parchment">
        Elementos y avances
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

      {!estado && !errorCarga && <p className="text-sm text-fog">Abriendo el archivo…</p>}
      {errorCarga && (
        <p className="text-sm text-wine">
          No se pudo cargar tu progreso.{' '}
          <button onClick={onReintentar} className="underline hover:text-parchment">
            Reintentar
          </button>
        </p>
      )}

      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
        {visibles.map((el) => {
          const esObjetivo =
            objetivo?.tipo === 'elemento' &&
            objetivo.slug === el.slug &&
            slugArrastrado !== null
          return (
            <li key={el.id}>
              <button
                data-drop-elemento={el.slug}
                onPointerDown={(e) =>
                  iniciarArrastre(e, {
                    slug: el.slug,
                    name: el.name,
                    iconKey: el.iconKey,
                    origen: { tipo: 'panel' },
                  })
                }
                onClick={(e) => {
                  // Solo teclado (Enter/Espacio): el mouse/táctil los gestiona
                  // el sistema de arrastre para no colocar dos veces.
                  if (e.detail === 0) onColocar(el)
                }}
                aria-label={`${el.name}: arrastra sobre otro elemento para combinar, o pulsa para colocar en la mesa`}
                title={el.derivationLabel ?? el.description ?? el.name}
                className={`flex w-full touch-none select-none flex-col items-center gap-1.5 rounded-lg mist-card p-3 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brass ${
                  esObjetivo
                    ? 'scale-105 border-brass ring-2 ring-brass'
                    : 'hover:border-brass-deep'
                }`}
              >
                <IconoElemento iconKey={el.iconKey} className="h-7 w-7 text-brass" />
                <span className="text-xs leading-tight text-parchment">{el.name}</span>
                {el.derivationLabel && (
                  <span className="text-[10px] leading-tight text-brass-deep">
                    {el.derivationLabel}
                  </span>
                )}
                {(el.quantity ?? 1) > 1 && (
                  <span className="text-[10px] text-fog">Disponibles: {el.quantity}</span>
                )}
                <span className="text-[10px] uppercase tracking-wider text-fog/70">
                  {etiquetaTipo(el.type)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {estado && visibles.length === 0 && (
        <p className="mt-2 text-sm italic text-fog">Ningún elemento coincide con la búsqueda.</p>
      )}
    </aside>
  )
}
