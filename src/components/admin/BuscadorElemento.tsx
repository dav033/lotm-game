'use client'

import { useMemo, useRef, useState } from 'react'
import { IconoElemento } from '@/components/game/IconoElemento'
import type { ElementoOpcion } from './tiposReceta'

// Buscador compacto de elementos (accesible por teclado: escribir + Enter).
export function BuscadorElemento({
  elementos,
  onPick,
  placeholder,
}: {
  elementos: ElementoOpcion[]
  onPick: (id: string) => void
  placeholder: string
}) {
  const [q, setQ] = useState('')
  const [abierto, setAbierto] = useState(false)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const matches = useMemo(() => {
    const f = q.trim().toLowerCase()
    return elementos.filter((e) => !f || e.name.toLowerCase().includes(f))
  }, [q, elementos])

  const elegir = (id: string) => {
    onPick(id)
    setQ('')
    setAbierto(false)
  }

  return (
    <div className="relative">
      <input
        value={q}
        placeholder={placeholder}
        onChange={(e) => { setQ(e.target.value); setAbierto(true) }}
        onFocus={() => setAbierto(true)}
        onBlur={() => { blurTimer.current = setTimeout(() => setAbierto(false), 150) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (matches[0]) elegir(matches[0].id)
          } else if (e.key === 'Escape') setAbierto(false)
        }}
        className="campo"
        aria-label={placeholder}
      />
      {abierto && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-line2 bg-panel2 shadow-xl">
          {matches.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onMouseDown={(ev) => {
                  ev.preventDefault()
                  if (blurTimer.current) clearTimeout(blurTimer.current)
                  elegir(e.id)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-parchment hover:bg-panel"
              >
                <IconoElemento iconKey={e.iconKey} className="h-4 w-4 text-brass" />
                {e.name}
                {!e.isActive && <span className="text-xs text-fog">(inactivo)</span>}
              </button>
            </li>
          ))}
          {matches.length === 0 && <li className="px-3 py-2 text-sm text-fog">Sin resultados</li>}
        </ul>
      )}
    </div>
  )
}
