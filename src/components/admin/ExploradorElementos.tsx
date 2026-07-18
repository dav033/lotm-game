'use client'

import { useDeferredValue, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Search, X } from 'lucide-react'
import { alternarElementoActivo, eliminarElemento } from '@/server/actions/elementos'
import { ELEMENT_TYPES, etiquetaTipo } from '@/server/domain/tipos'
import { DIFICULTAD_LABELS, type DiagDifficulty } from '@/server/domain/diagnostico'
import { IconoElemento } from '@/components/game/IconoElemento'
import { BotonEliminar } from './BotonEliminar'
import { colorDificultad } from './dificultad'
import { crearStoreFiltros } from './storeFiltros'

// Vista plana y serializable de un elemento para la tabla (la construye el
// servidor a partir de Prisma + el análisis de progresión).
export type ElementoVista = {
  id: string
  slug: string
  name: string
  iconKey: string
  type: string
  tier: number
  isActive: boolean
  isStarter: boolean
  isMajorDiscovery: boolean
  espontaneo: string | null
  secuencia: { numero: number; camino: string } | null
  categorias: { id: string; name: string; isPrimary: boolean }[]
  produceEn: number
  participaEn: number
  profundidad: number | null
  alcanzable: boolean
  dificultad: DiagDifficulty
}

type Filtros = {
  q: string
  tipo: string
  estado: string
  categoria: string
  progresion: string
  orden: 'tier' | 'nombre' | 'profundidad'
}

const FILTROS_INICIALES: Filtros = {
  q: '',
  tipo: '',
  estado: '',
  categoria: '',
  progresion: '',
  orden: 'tier',
}

// Store de filtros (zustand): el filtrado es 100% cliente e instantáneo.
const useFiltros = crearStoreFiltros(FILTROS_INICIALES)

function urlDeFiltros(f: Filtros): string {
  const params = new URLSearchParams()
  if (f.q.trim()) params.set('q', f.q.trim())
  if (f.tipo) params.set('tipo', f.tipo)
  if (f.estado) params.set('estado', f.estado)
  if (f.categoria) params.set('categoria', f.categoria)
  if (f.progresion) params.set('progresion', f.progresion)
  if (f.orden !== 'tier') params.set('orden', f.orden)
  const s = params.toString()
  return s ? `/admin/elementos?${s}` : '/admin/elementos'
}

// Tabla viva de elementos: filtra y ordena al instante en el cliente, y cada
// fila enlaza con sus categorías, su camino y su edición. Las acciones
// (activar/eliminar) siguen siendo Server Actions con revalidación propia.
export function ExploradorElementos({
  elementos,
  categorias,
  inicial,
}: {
  elementos: ElementoVista[]
  categorias: { id: string; name: string }[]
  inicial: Partial<Filtros>
}) {
  const filtros = useFiltros((s) => s.filtros)
  const setFiltros = useFiltros((s) => s.setFiltros)
  const reiniciar = useFiltros((s) => s.reiniciar)
  const qDiferida = useDeferredValue(filtros.q)

  // La URL manda al llegar (enlaces desde categorías, enlaces compartidos).
  const inicialJson = JSON.stringify(inicial)
  useEffect(() => {
    useFiltros.setState({ filtros: { ...FILTROS_INICIALES, ...JSON.parse(inicialJson) } })
  }, [inicialJson])

  // Los filtros se reflejan en la URL sin re-render de Next (URL compartible).
  useEffect(() => {
    const t = setTimeout(() => {
      const destino = urlDeFiltros(filtros)
      const actual = `${window.location.pathname}${window.location.search}`
      if (destino !== actual) window.history.replaceState(null, '', destino)
    }, 300)
    return () => clearTimeout(t)
  }, [filtros])

  const visibles = useMemo(() => {
    const q = qDiferida.trim().toLowerCase()
    const lista = elementos.filter(
      (e) =>
        (!q ||
          e.name.toLowerCase().includes(q) ||
          e.slug.toLowerCase().includes(q)) &&
        (!filtros.tipo || e.type === filtros.tipo) &&
        (!filtros.estado ||
          (filtros.estado === 'activos' ? e.isActive : !e.isActive)) &&
        (!filtros.categoria || e.categorias.some((c) => c.id === filtros.categoria)) &&
        (!filtros.progresion ||
          (filtros.progresion === 'alcanzables' ? e.alcanzable : !e.alcanzable)),
    )
    switch (filtros.orden) {
      case 'nombre':
        return [...lista].sort((a, b) => a.name.localeCompare(b.name, 'es'))
      case 'profundidad':
        return [...lista].sort(
          (a, b) =>
            (a.profundidad ?? Number.POSITIVE_INFINITY) -
              (b.profundidad ?? Number.POSITIVE_INFINITY) ||
            a.name.localeCompare(b.name, 'es'),
        )
      default:
        return [...lista].sort(
          (a, b) => a.tier - b.tier || a.name.localeCompare(b.name, 'es'),
        )
    }
  }, [elementos, qDiferida, filtros.tipo, filtros.estado, filtros.categoria, filtros.progresion, filtros.orden])

  const hayFiltrosActivos =
    filtros.q.trim() !== '' ||
    filtros.tipo !== '' ||
    filtros.estado !== '' ||
    filtros.categoria !== '' ||
    filtros.progresion !== ''

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-fog" aria-hidden />
          <span className="sr-only">Buscar elemento por nombre o slug</span>
          <input
            value={filtros.q}
            onChange={(e) => setFiltros({ q: e.target.value })}
            placeholder="Buscar por nombre o slug…"
            className="campo w-60 pl-9"
          />
        </label>
        <label>
          <span className="sr-only">Filtrar por tipo</span>
          <select
            value={filtros.tipo}
            onChange={(e) => setFiltros({ tipo: e.target.value })}
            className="campo max-w-40"
          >
            <option value="">Todos los tipos</option>
            {ELEMENT_TYPES.map((t) => (
              <option key={t} value={t}>{etiquetaTipo(t)}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filtrar por categoría</span>
          <select
            value={filtros.categoria}
            onChange={(e) => setFiltros({ categoria: e.target.value })}
            className="campo max-w-44"
          >
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filtrar por estado</span>
          <select
            value={filtros.estado}
            onChange={(e) => setFiltros({ estado: e.target.value })}
            className="campo max-w-36"
          >
            <option value="">Todos</option>
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Filtrar por progresión</span>
          <select
            value={filtros.progresion}
            onChange={(e) => setFiltros({ progresion: e.target.value })}
            className="campo max-w-40"
          >
            <option value="">Toda la progresión</option>
            <option value="alcanzables">Alcanzables</option>
            <option value="inalcanzables">Inalcanzables</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Ordenar</span>
          <select
            value={filtros.orden}
            onChange={(e) => setFiltros({ orden: e.target.value as Filtros['orden'] })}
            className="campo max-w-40"
          >
            <option value="tier">Por nivel</option>
            <option value="nombre">Por nombre</option>
            <option value="profundidad">Por profundidad</option>
          </select>
        </label>
        {hayFiltrosActivos && (
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
          {visibles.length} de {elementos.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg mist-card">
        <table className="tabla">
          <thead>
            <tr>
              <th>Elemento</th>
              <th>Categorías</th>
              <th>Tipo</th>
              <th>Nivel</th>
              <th>Profundidad</th>
              <th>Recetas</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((e) => (
              <tr key={e.id} className={e.isActive ? '' : 'opacity-50'}>
                <td>
                  <div className="flex items-center gap-2">
                    <IconoElemento iconKey={e.iconKey} className="h-4 w-4 shrink-0 text-brass" />
                    <Link
                      href={`/admin/elementos/${e.id}`}
                      className="text-parchment hover:text-brass hover:underline"
                    >
                      {e.name}
                    </Link>
                    {e.isStarter && (
                      <span className="rounded border border-brass-deep px-1 text-[10px] text-brass">inicial</span>
                    )}
                    {e.isMajorDiscovery && (
                      <span className="rounded border border-wine px-1 text-[10px] text-parchment">mayor</span>
                    )}
                    {e.secuencia && (
                      <Link
                        href="/admin/caminos"
                        title={`Camino de ${e.secuencia.camino}`}
                        className="rounded border border-line2 px-1 text-[10px] text-fog hover:border-brass hover:text-brass"
                      >
                        seq {e.secuencia.numero}
                      </Link>
                    )}
                    {e.espontaneo && (
                      <span
                        className="rounded border border-line2 px-1 text-[10px] text-fog"
                        title={e.espontaneo}
                      >
                        espontáneo
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <div className="flex max-w-52 flex-wrap gap-1">
                    {e.categorias.length === 0 && <span className="text-xs text-fog">—</span>}
                    {e.categorias.map((c) => (
                      <Link
                        key={c.id}
                        href={`/admin/categorias?editar=${c.id}`}
                        title={c.isPrimary ? 'Categoría principal' : 'Categoría'}
                        className={`rounded border px-1.5 py-px text-[10px] hover:border-brass hover:text-brass ${
                          c.isPrimary ? 'border-brass-deep text-brass' : 'border-line2 text-fog'
                        }`}
                      >
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </td>
                <td className="text-fog">{etiquetaTipo(e.type)}</td>
                <td className="text-fog">{e.tier}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <span className={e.profundidad === null ? 'text-wine' : 'text-parchment'}>
                      {e.profundidad ?? '∞'}
                    </span>
                    <span
                      className={`rounded px-1.5 py-px text-[10px] ${colorDificultad(e.dificultad)}`}
                    >
                      {DIFICULTAD_LABELS[e.dificultad]}
                    </span>
                  </div>
                </td>
                <td className="text-xs text-fog">
                  lo producen {e.produceEn} · participa en {e.participaEn}
                </td>
                <td>
                  {e.isActive ? (
                    <span className="text-brass">activo</span>
                  ) : (
                    <span className="text-fog">inactivo</span>
                  )}
                </td>
                <td>
                  <div className="flex items-center gap-3">
                    <Link href={`/admin/elementos/${e.id}`} className="text-brass underline">
                      Editar
                    </Link>
                    <form action={alternarElementoActivo.bind(null, e.id)}>
                      <button type="submit" className="text-fog underline hover:text-parchment">
                        {e.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                    </form>
                    {!e.isStarter && (
                      <BotonEliminar
                        action={eliminarElemento.bind(null, e.id)}
                        confirmacion={`¿Eliminar «${e.name}»? También se eliminarán las recetas donde participa. Esta acción no se puede deshacer.`}
                        className="text-wine underline hover:text-parchment"
                      >
                        Eliminar
                      </BotonEliminar>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={8} className="italic text-fog">
                  No hay elementos que coincidan con los filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
