'use client'

import { useDeferredValue, useMemo } from 'react'
import Link from 'next/link'
import { MoveRight, Search, X } from 'lucide-react'
import { alternarAvanceActivo, eliminarAvance } from '@/server/actions/avances'
import { BotonEliminar } from './BotonEliminar'
import { crearStoreFiltros } from './storeFiltros'

// Vista plana y serializable de un avance para la tabla.
export type AvanceVista = {
  id: string
  internalName: string
  isActive: boolean
  camino: string
  ingredientes: { id: string; name: string; quantity: number }[]
  origen: { numero: number; nombre: string }
  destino: { numero: number; nombre: string }
  enPosesion: number
}

type Filtros = { q: string; camino: string }

const FILTROS_INICIALES: Filtros = { q: '', camino: '' }

// Store de filtros (zustand): filtrado instantáneo en el cliente.
const useFiltros = crearStoreFiltros(FILTROS_INICIALES)

// Tabla viva de avances: busca por nombre, ingrediente o camino sin tocar el
// servidor, y enlaza ingredientes con su elemento y la progresión con Caminos.
export function TablaAvances({
  avances,
  caminos,
}: {
  avances: AvanceVista[]
  caminos: string[]
}) {
  const filtros = useFiltros((s) => s.filtros)
  const setFiltros = useFiltros((s) => s.setFiltros)
  const reiniciar = useFiltros((s) => s.reiniciar)
  const qDiferida = useDeferredValue(filtros.q)

  const visibles = useMemo(() => {
    const q = qDiferida.trim().toLowerCase()
    return avances.filter(
      (a) =>
        (!filtros.camino || a.camino === filtros.camino) &&
        (!q ||
          a.internalName.toLowerCase().includes(q) ||
          a.camino.toLowerCase().includes(q) ||
          a.ingredientes.some((i) => i.name.toLowerCase().includes(q))),
    )
  }, [avances, qDiferida, filtros.camino])

  const hayFiltros = filtros.q.trim() !== '' || filtros.camino !== ''

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-fog" aria-hidden />
          <span className="sr-only">Buscar avance</span>
          <input
            value={filtros.q}
            onChange={(e) => setFiltros({ q: e.target.value })}
            placeholder="Buscar por nombre o ingrediente…"
            className="campo w-64 pl-9"
          />
        </label>
        <label>
          <span className="sr-only">Filtrar por camino</span>
          <select
            value={filtros.camino}
            onChange={(e) => setFiltros({ camino: e.target.value })}
            className="campo max-w-56"
          >
            <option value="">Todos los caminos</option>
            {caminos.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        {hayFiltros && (
          <button
            type="button"
            onClick={reiniciar}
            className="flex items-center gap-1 text-sm text-fog underline hover:text-parchment"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Limpiar filtros
          </button>
        )}
        <span aria-live="polite" className="ml-auto text-xs text-fog">
          {visibles.length} de {avances.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg mist-card">
        <table className="tabla">
          <thead>
            <tr>
              <th>Nombre interno</th>
              <th>Fórmula pública</th>
              <th>Progresión</th>
              <th>En posesión</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((avance) => (
              <tr key={avance.id} className={avance.isActive ? '' : 'opacity-50'}>
                <td className="text-parchment">{avance.internalName}</td>
                <td>
                  <div className="flex flex-wrap items-center gap-1.5 text-fog">
                    {avance.ingredientes.map((i, idx) => (
                      <span key={i.id} className="flex items-center gap-1.5">
                        {idx > 0 && <span aria-hidden>+</span>}
                        <Link
                          href={`/admin/elementos/${i.id}`}
                          className="text-parchment hover:text-brass hover:underline"
                        >
                          {i.name}
                        </Link>
                        {i.quantity > 1 && <span>× {i.quantity}</span>}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="text-fog">
                  <Link href="/admin/caminos" className="group inline-flex flex-wrap items-center gap-1.5 hover:text-brass">
                    <span>
                      {avance.camino} · {avance.origen.numero}: {avance.origen.nombre}
                    </span>
                    <MoveRight className="h-3.5 w-3.5 text-brass-deep group-hover:text-brass" aria-hidden />
                    <span>
                      {avance.destino.numero}: {avance.destino.nombre}
                    </span>
                  </Link>
                </td>
                <td className="text-fog">{avance.enPosesion}</td>
                <td>
                  <div className="flex items-center gap-3">
                    <Link href={`/admin/avances/${avance.id}`} className="text-brass underline">
                      Editar
                    </Link>
                    <form action={alternarAvanceActivo.bind(null, avance.id)}>
                      <button className="text-fog underline hover:text-parchment" type="submit">
                        {avance.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                    </form>
                    <BotonEliminar
                      action={eliminarAvance.bind(null, avance.id)}
                      confirmacion="¿Eliminar este avance y retirarlo de todos los jugadores?"
                      className="text-wine underline hover:text-parchment"
                    >
                      Eliminar
                    </BotonEliminar>
                  </div>
                </td>
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={5} className="italic text-fog">
                  {avances.length === 0
                    ? 'Aún no hay avances configurados.'
                    : 'Ningún avance coincide con los filtros.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
