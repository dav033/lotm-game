'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { ELEMENT_TYPES, etiquetaTipo } from '@/server/domain/tipos'

// Filtros en vivo de la tabla de elementos: cada tecla actualiza la URL con
// debounce y el servidor re-renderiza la tabla filtrada.
export function FiltrosElementos({
  inicial,
}: {
  inicial: { q: string; tipo: string; estado: string }
}) {
  const router = useRouter()
  const [q, setQ] = useState(inicial.q)
  const [tipo, setTipo] = useState(inicial.tipo)
  const [estado, setEstado] = useState(inicial.estado)
  const [pendiente, startTransition] = useTransition()
  const primeraCarga = useRef(true)

  useEffect(() => {
    // No reescribir la URL con la que ya llegó la página.
    if (primeraCarga.current) {
      primeraCarga.current = false
      return
    }
    const t = setTimeout(() => {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (tipo) params.set('tipo', tipo)
      if (estado) params.set('estado', estado)
      startTransition(() => {
        router.replace(
          params.size > 0 ? `/admin/elementos?${params}` : '/admin/elementos',
          { scroll: false },
        )
      })
    }, 250)
    return () => clearTimeout(t)
  }, [q, tipo, estado, router])

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-fog" aria-hidden />
        <span className="sr-only">Buscar elemento por nombre</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre…"
          className="campo w-56 pl-9"
        />
      </label>
      <label>
        <span className="sr-only">Filtrar por tipo</span>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="campo max-w-44">
          <option value="">Todos los tipos</option>
          {ELEMENT_TYPES.map((t) => (
            <option key={t} value={t}>{etiquetaTipo(t)}</option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">Filtrar por estado</span>
        <select value={estado} onChange={(e) => setEstado(e.target.value)} className="campo max-w-36">
          <option value="">Todos</option>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
        </select>
      </label>
      <span aria-live="polite" className="text-xs text-fog">
        {pendiente ? 'Filtrando…' : ''}
      </span>
    </div>
  )
}
